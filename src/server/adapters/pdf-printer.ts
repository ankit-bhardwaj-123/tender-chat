import { PDFDocument } from "pdf-lib";
import { type Browser, type BrowserContext, chromium } from "playwright-core";
import { unavailable } from "@/server/errors";
import { stripScripts } from "@/shared/fill-template";

const BROWSER_CHANNELS = ["msedge", "chrome"] as const;
const NO_NETWORK_ARGS = ["--proxy-server=http://127.0.0.1:9", "--proxy-bypass-list=<-loopback>"];
const PRINT_TIMEOUT_MS = 25_000;
const TOO_LONG = "The PDF took too long. Please try again.";
const NO_PRINTER = "The PDF printer couldn't start. Please try again in a minute.";
const NO_LOCAL_BROWSER = "Microsoft Edge or Google Chrome is needed to print PDFs.";

let browserPromise: Promise<Browser> | null = null;

function runsOnVercel(): boolean {
  return process.env.VERCEL === "1";
}

async function launchServerless(): Promise<Browser> {
  try {
    const serverless = (await import("@sparticuz/chromium")).default;
    return await chromium.launch({
      executablePath: await serverless.executablePath(),
      args: [...serverless.args, ...NO_NETWORK_ARGS],
      headless: true,
    });
  } catch (error) {
    throw unavailable(NO_PRINTER, error);
  }
}

async function launchInstalled(): Promise<Browser> {
  let lastError: unknown = null;
  for (const channel of BROWSER_CHANNELS) {
    try {
      return await chromium.launch({ channel, headless: true, args: NO_NETWORK_ARGS });
    } catch (error) {
      lastError = error;
    }
  }
  throw unavailable(NO_LOCAL_BROWSER, lastError);
}

function launchBrowser(): Promise<Browser> {
  return runsOnVercel() ? launchServerless() : launchInstalled();
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(unavailable(TOO_LONG)), ms);
  });
  try {
    return await Promise.race([work, limit]);
  } finally {
    clearTimeout(timer);
  }
}

async function printPage(context: BrowserContext, html: string): Promise<Uint8Array> {
  const page = await context.newPage();
  await page.route("**/*", (route) =>
    route.request().url().startsWith("data:") ? route.continue() : route.abort(),
  );
  await page.setContent(stripScripts(html), { waitUntil: "load" });
  const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
  return new Uint8Array(pdf);
}

async function getBrowser(): Promise<Browser> {
  browserPromise ??= launchBrowser().then((browser) => {
    browser.on("disconnected", () => {
      browserPromise = null;
    });
    return browser;
  });
  try {
    return await browserPromise;
  } catch (error) {
    browserPromise = null;
    throw error;
  }
}

export async function printHtmlToPdf(html: string): Promise<Uint8Array> {
  const browser = await getBrowser();
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    return await withTimeout(printPage(context, html), PRINT_TIMEOUT_MS);
  } finally {
    await context.close();
  }
}

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

export async function isReadablePdf(bytes: Uint8Array): Promise<boolean> {
  try {
    return (await PDFDocument.load(bytes)).getPageCount() > 0;
  } catch {
    return false;
  }
}

export async function pdfPageCount(content: Uint8Array): Promise<number> {
  return (await PDFDocument.load(content)).getPageCount();
}

export async function stackPages(
  content: Uint8Array,
  overlay: Uint8Array,
  letterhead: Uint8Array,
): Promise<Uint8Array> {
  const output = await PDFDocument.create();
  const contentPages = await output.embedPdf(
    content,
    (await PDFDocument.load(content)).getPageIndices(),
  );
  const overlayPages = await output.embedPdf(
    overlay,
    (await PDFDocument.load(overlay)).getPageIndices(),
  );
  const [background] = await output.embedPdf(letterhead, [0]);
  const count = Math.max(contentPages.length, overlayPages.length);
  for (let index = 0; index < count; index += 1) {
    const base = contentPages[index] ?? overlayPages[index];
    const width = base?.width ?? A4_WIDTH_PT;
    const height = base?.height ?? A4_HEIGHT_PT;
    const page = output.addPage([width, height]);
    const layers = [index === 0 ? background : undefined, contentPages[index], overlayPages[index]];
    for (const layer of layers) {
      if (layer) page.drawPage(layer, { x: 0, y: 0, width, height });
    }
  }
  return output.save();
}
