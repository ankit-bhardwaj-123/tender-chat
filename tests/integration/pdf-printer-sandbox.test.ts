import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { printHtmlToPdf } from "@/server/adapters/pdf-printer";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PNG_DATA = `data:image/png;base64,${PNG_BASE64}`;
const BIG = 'style="display:block;width:80mm;height:80mm"';

let server: Server;
let origin = "";
let connections = 0;
const requested: string[] = [];
let folder = "";
let pngUrl = "";
let pageUrl = "";
let cssUrl = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    requested.push(req.url ?? "");
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(Buffer.from(PNG_BASE64, "base64"));
  });
  server.on("connection", () => {
    connections += 1;
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  folder = await mkdtemp(path.join(os.tmpdir(), "pdf-sandbox-"));
  const png = path.join(folder, "secret.png");
  const page = path.join(folder, "secret.html");
  const css = path.join(folder, "secret.css");
  await writeFile(png, Buffer.from(PNG_BASE64, "base64"));
  await writeFile(page, `<html><body><img src="${PNG_DATA}" ${BIG}></body></html>`);
  await writeFile(css, `body{background:url("${PNG_DATA}")}`);
  pngUrl = pathToFileURL(png).href;
  pageUrl = pathToFileURL(page).href;
  cssUrl = pathToFileURL(css).href;
});

beforeEach(() => {
  connections = 0;
  requested.length = 0;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(folder, { recursive: true, force: true });
});

async function imageCount(pdf: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(pdf);
  return doc.context.enumerateIndirectObjects().filter(([, object]) => {
    const dict = object instanceof PDFRawStream ? object.dict : object;
    return (
      dict instanceof PDFDict &&
      dict.get(PDFName.of("Subtype")) === PDFName.of("Image") &&
      dict.get(PDFName.of("Width"))?.toString() === "1" &&
      dict.get(PDFName.of("Height"))?.toString() === "1"
    );
  }).length;
}

function page(body: string, head = ""): string {
  return `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;
}

describe("pdf printer sandbox", () => {
  it("prints an image given as a data URL", async () => {
    const pdf = await printHtmlToPdf(page(`<img src="${PNG_DATA}" ${BIG}>`));
    expect(await imageCount(pdf)).toBeGreaterThan(0);
  }, 60000);

  it.each([
    ["a stylesheet", () => `<link rel="stylesheet" href="${origin}/style.css">`],
    ["a preconnect", () => `<link rel="preconnect" href="${origin}">`],
    ["a DNS prefetch", () => `<link rel="dns-prefetch" href="${origin}">`],
    ["a prefetch", () => `<link rel="prefetch" href="${origin}/prefetch">`],
    ["a preload", () => `<link rel="preload" as="image" href="${origin}/preload.png">`],
    ["an icon", () => `<link rel="icon" href="${origin}/favicon.png">`],
    ["an import", () => `<style>@import url("${origin}/import.css");</style>`],
    [
      "a font",
      () =>
        `<style>@font-face{font-family:X;src:url("${origin}/font.woff2")}p{font-family:X}</style>`,
    ],
    ["an image", () => `<img src="${origin}/img.png" ${BIG}>`],
    ["a srcset", () => `<img srcset="${origin}/srcset.png 1x" ${BIG}>`],
    ["a picture source", () => `<picture><source srcset="${origin}/s.png"><img ${BIG}></picture>`],
    ["a frame", () => `<iframe src="${origin}/frame"></iframe>`],
    ["an object", () => `<object data="${origin}/object.png" type="image/png"></object>`],
    ["an embed", () => `<embed src="${origin}/embed.png" type="image/png">`],
    ["a video poster", () => `<video poster="${origin}/poster.png"></video>`],
    ["an audio", () => `<audio src="${origin}/audio.mp3" preload="auto"></audio>`],
    ["an image input", () => `<input type="image" src="${origin}/input.png">`],
    [
      "an SVG image",
      () =>
        `<svg width="99" height="99"><image href="${origin}/svg.png" width="99" height="99"/></svg>`,
    ],
    [
      "a CSS background",
      () => `<div style="width:50mm;height:50mm;background:url('${origin}/bg.png')"></div>`,
    ],
    ["a script", () => `<script>new Image().src="${origin}/script.png"</script>`],
    ["an onerror", () => `<img src="x" onerror="this.src='${origin}/onerror.png'">`],
  ])(
    "makes no network request for %s",
    async (_name, html) => {
      const pdf = await printHtmlToPdf(page(`<p>x</p>${html()}`));
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(requested).toEqual([]);
      expect(connections).toBe(0);
      expect(await imageCount(pdf)).toBe(0);
    },
    60000,
  );

  it.each([
    ["an image", () => `<img src="${pngUrl}" ${BIG}>`],
    ["a frame", () => `<iframe src="${pageUrl}" style="width:150mm;height:150mm"></iframe>`],
    ["an object", () => `<object data="${pngUrl}" type="image/png" ${BIG}></object>`],
    ["an embed", () => `<embed src="${pngUrl}" type="image/png" ${BIG}>`],
    ["a stylesheet", () => `<link rel="stylesheet" href="${cssUrl}"><p>x</p>`],
    [
      "a CSS background",
      () => `<div style="width:80mm;height:80mm;background:url('${pngUrl}')"></div>`,
    ],
  ])(
    "reads no local file through %s",
    async (_name, html) => {
      const pdf = await printHtmlToPdf(page(html()));
      expect(await imageCount(pdf)).toBe(0);
    },
    60000,
  );

  it.each([
    ["a web address", () => `${origin}/refresh`],
    ["a local file", () => pageUrl],
  ])(
    "prints a page whose meta refresh points to %s without following it",
    async (_name, url) => {
      const pdf = await printHtmlToPdf(
        page(`<p>x</p>`, `<meta http-equiv="refresh" content="0;url=${url()}">`),
      );
      expect(requested).toEqual([]);
      expect(connections).toBe(0);
      expect(await imageCount(pdf)).toBe(0);
    },
    60000,
  );

  it("prints a data URL frame without running its script", async () => {
    const frame = `data:text/html,${encodeURIComponent(`<script>document.write('<img src="${PNG_DATA}" style="width:80mm;height:80mm">')</script>`)}`;
    const pdf = await printHtmlToPdf(
      page(`<iframe src="${frame}" style="width:150mm;height:150mm"></iframe>`),
    );
    expect(await imageCount(pdf)).toBe(0);
  }, 60000);
});
