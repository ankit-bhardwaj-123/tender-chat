---
name: pdf-download
description: Use when changing how tender-chat makes the tender PDF (Generate PDF button, POST /api/tenders/[id]/pdf, Chrome printing, letterhead stacking, print fonts) or anything the preview and the PDF share (pageDocument, canvas pages, seal position).
---

# PDF download (Spec 07, done 2026-11-20)

Spec `.claude/specs/07-pdf-download.md`, plan `.claude/plans/07-pdf-download.md`, check report `.claude/reports/2026-11-20-07-pdf-download.md`.

## Key files

- `src/shared/page-document.ts:7` `pageDocument(html, values, fontKey, fontUrl, extraCss)`: the one page builder for both preview and print. `PREVIEW_CSS` at `:4`.
- `src/shared/canvas.ts:90-157` `CanvasPagesInput`, `sealLeft`, `sealTopOf`, `canvasPageCount`, `canvasPagesHtml` (canvas items + seal as transparent A4 sheets). Limits at `:14-18` (`SEAL_MARGIN_MM`, `MAX_PDF_PAGES` 20, `MAX_CANVAS_ITEMS` 200, `MAX_TOP_MM`).
- `src/shared/pdf-body.ts:4` `PdfBody { sealTop: number | null }` (mm, capped at `MAX_TOP_MM`).
- `src/shared/fonts.ts` `fontFaceCss(urlFor, only?)`: one font's faces only when given.
- `src/shared/fill-template.ts` `stripScripts` also removes `<meta http-equiv=refresh>`.
- `src/server/adapters/print-font.ts:20` `printFontUrl(font)`: woff2 from `node_modules/@fontsource/<key>/files/` as `data:` URLs, cached per font.
- `src/server/adapters/pdf-printer.ts`: `printHtmlToPdf` `:85`, `isReadablePdf` `:98`, `pdfPageCount` `:106`, `stackPages` `:110`.
- `src/services/tender-pdf.service.ts:87` `makeTenderPdf(userId, tenderId, sealTop)`.
- `src/app/api/tenders/[id]/pdf/route.ts:12` POST, `maxDuration = 60`, `attachment; filename*=UTF-8''…`, `private, no-store`.
- `src/lib/editor.ts`: `PDF_FAILED` `:45`, `requestTenderPdf` `:352`, `downloadTenderPdf` `:373`; `Autosave.flush()` returns `true` only when everything saved (`:293`).
- `src/components/editor/editor-top-bar.tsx:118` `generatePdf`; button and `#pdf-needs` tip at `:237-246`.
- `src/components/editor/page-preview.tsx:263` reports the measured seal top (`onSealTop`); `editor-page.tsx:64-68` keeps it in a ref and hands `readSealTop` to the top bar.
- `next.config.ts:36-60` `printerFiles` (font woff2 + chromium) in `outputFileTracingIncludes` for the pdf route.

## Data flow

1. Click Generate PDF → `flush()`; false → toast "Not saved, so the PDF wasn't made. Please try again."
2. POST `{ sealTop }`. `sealTop` is sent only when `canvas.seal.y` is null (seal never moved), so the PDF uses the spot the preview measured.
3. Service: `getTender` (ownership, 404) → no company/template 400 → company/template not found 404 → letterhead bytes (no row or missing file 400 "letterhead file is missing", unreadable PDF 400 "can't be read") → source = `customHtml ?? template file` → seal and images as data URLs in parallel (missing ones dropped).
4. Print 1: `pageDocument(..., PRINT_CSS)`; `PRINT_CSS` hides `[data-empty]` with `visibility:hidden` so empty blanks keep their space.
5. Print 2: `canvasPagesHtml` with `pageCount` = content pages; an item goes on page `floor(y/297)`.
6. `stackPages`: per page, letterhead (page 1 only) → content → overlay; page count = max of the two.
7. Browser saves the blob through a temporary `<a download>`; status ≥ 500 or network error → "PDF can't be made, please try again."; other errors show the server message.

## Rules and gotchas

- The letterhead is required: no on/off and no cover boxes (decided 2026-11-20). Generate PDF is disabled until a company and a template are chosen.
- The PDF is never stored; it's made fresh from the database each click.
- Sandbox: context with `javaScriptEnabled: false`, `page.route` aborts everything except `data:`, and Chrome launches with a dead proxy (`--proxy-server=http://127.0.0.1:9`, `--proxy-bypass-list=<-loopback>`) so prefetch/iframes can't reach the network. 25 s print timeout.
- Local printing uses installed Edge or Chrome (playwright-core channels); Vercel (`VERCEL=1`) uses `@sparticuz/chromium`. Integration tests need Edge or Chrome on the machine.
- Text-box styles escape the font stack (`escapeHtml`); its quotes once cut the style short.
- Caps: `CanvasBody` (save) caps items at 200; the 20-page cap is applied when building pages, not in `readCanvas` (`StoredCanvas` is lenient), so an old over-limit tender isn't wiped on load.
- File name: tender name minus control chars and `/\:*?"<>|`, fallback `Quotation.pdf`.
- `reportUnexpected` logs only non-`AppError`s, so missing files aren't logged as crashes.
- Setting `templateId` in a PATCH clears `customHtml`; tests save `customHtml` in a second PATCH.
- Chrome never splits a text line, so a line on a dashed preview line moves to the next PDF page.
- `pnpm build` exits 1 only on the Next.js 16.4.3 security notice; compile and nft trace are fine.
- Import chain note: top bar → `lib/editor` → `page-document` → `fill-template` is one over the ≤ 3 rule (left as is).

## Tests

- Unit: `tests/unit/{page-document,canvas-pages,pdf-pages-edges,pdf-stack,pdf-request}.test.ts`.
- Integration (real Chrome + `tender_chat_test`): `tests/integration/{tender-pdf,tender-pdf-edges,pdf-printer-sandbox}.test.ts`.

```sh
pnpm test
pnpm test:integration
pnpm build   # check .next/server/app/api/tenders/[id]/pdf/route.js.nft.json lists fonts + chromium
```
