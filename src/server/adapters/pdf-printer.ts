import { PDFDocument } from "pdf-lib";
import { type Browser, type BrowserContext, chromium, type Page } from "playwright-core";
import { isAppError, unavailable } from "@/server/errors";
import { stripScripts } from "@/shared/fill-template";

const BROWSER_CHANNELS = ["msedge", "chrome"] as const;
const NO_NETWORK_ARGS = ["--proxy-server=http://127.0.0.1:9", "--proxy-bypass-list=<-loopback>"];
const PRINT_TIMEOUT_MS = 25_000;
const TOO_LONG = "The PDF took too long. Please try again.";
const NO_PRINTER = "The PDF printer couldn't start. Please try again in a minute.";
const NO_LOCAL_BROWSER = "Microsoft Edge or Google Chrome is needed to print PDFs.";

let printerPromise: Promise<Printer> | null = null;

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

interface Printer {
  browser: Browser;
  context: BrowserContext;
}

async function printPage(page: Page, html: string): Promise<Uint8Array> {
  await page.route("**/*", (route) =>
    route.request().url().startsWith("data:") ? route.continue() : route.abort(),
  );
  await page.setContent(stripScripts(html), { waitUntil: "load" });
  const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
  return new Uint8Array(pdf);
}

async function startPrinter(): Promise<Printer> {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ javaScriptEnabled: false });
    return { browser, context };
  } catch (error) {
    await browser.close().catch(() => undefined);
    throw unavailable(NO_PRINTER, error);
  }
}

async function getPrinter(): Promise<Printer> {
  if (!printerPromise) {
    const started = startPrinter();
    printerPromise = started;
    void started
      .then((printer) =>
        printer.browser.on("disconnected", () => {
          if (printerPromise === started) printerPromise = null;
        }),
      )
      .catch(() => undefined);
  }
  const current = printerPromise;
  try {
    return await current;
  } catch (error) {
    if (printerPromise === current) printerPromise = null;
    throw error;
  }
}

async function dropPrinter(): Promise<void> {
  const current = printerPromise;
  printerPromise = null;
  const printer = await current?.catch(() => null);
  if (printer) await printer.browser.close().catch(() => undefined);
}

function timedOut(error: unknown): boolean {
  return isAppError(error) && error.message === TOO_LONG;
}

async function printOnce(html: string): Promise<Uint8Array> {
  const { context } = await getPrinter();
  const page = await context.newPage();
  try {
    return await withTimeout(printPage(page, html), PRINT_TIMEOUT_MS);
  } finally {
    await page.close().catch(() => undefined);
  }
}

export async function printHtmlToPdf(html: string): Promise<Uint8Array> {
  try {
    return await printOnce(html);
  } catch (error) {
    await dropPrinter();
    if (timedOut(error)) throw error;
    return printOnce(html);
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
