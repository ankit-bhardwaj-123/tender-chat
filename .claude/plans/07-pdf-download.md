# Plan 07: PDF download

Spec: .claude/specs/07-pdf-download.md · Status: draft, waiting for "go" · 2026-11-20

## In short

Generate PDF saves any pending change first. It then asks the server for the PDF, and the browser downloads it as `<tender name>.pdf`. The server builds the **same HTML page as the preview**, using the same shared function, and prints it with Chrome (v2's printer) with JavaScript off and all network access blocked. The canvas (text boxes, images, the seal) is printed as a second, transparent PDF, one A4 sheet per page. pdf-lib then stacks three layers on each page: the letterhead (page 1 only) at the bottom, then the page, then the canvas. Fonts and images are put inside the HTML as `data:` URLs (the file's bytes written into the page), so Chrome needs nothing from the network.

## Spec problems

1. **The seal's default spot is measured in the browser and never saved.** When the user hasn't moved the seal, the preview places it 2 lines below the last text by measuring the live page. Suggestion: when Generate PDF is clicked, the browser sends that measured number (mm) with the request. The PDF then puts the seal exactly where the preview shows it, and nothing extra is saved.
2. **"A missing letterhead stops the download":** a company with **no letterhead uploaded at all** is treated the same way, with the same message, because the letterhead is required.

## Database

No changes.

## API routes

| Method | Path                    | What it does                                                  | Sends                              | Gets back                                                                |
| ------ | ----------------------- | ------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| POST   | `/api/tenders/[id]/pdf` | Builds the tender's PDF from what is saved; nothing is stored | `{ sealTop: number \| null }` (mm) | `application/pdf`, `attachment; filename*=<tender name>.pdf`, `no-store` |

It needs a signed-in user. Another user's tender, a bad id, or a voided company or template answers 404. `maxDuration = 60`.

## Screens

**Top bar, Generate PDF button** (`editor-top-bar.tsx`):

- **Greyed out:** with a tip "Pick a company and a template first." when either is missing.
- **Loading:** a spinner and "Making PDF…", and it can't be clicked twice.
- **Error:** a red toast with the server's message, or "Not saved, so the PDF wasn't made. Please try again." if the save first failed, or "PDF can't be made, please try again." for a network error or a 504.
- **Done:** the file downloads and the button goes back to normal.

## Files

| File                                       | New / Copy / Change | What it does                                                                                                      |
| ------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/shared/page-document.ts`              | New                 | `PREVIEW_CSS` + `pageDocument(html, values, fontKey, fontUrl, extraCss)`: the one page builder                    |
| `src/shared/fonts.ts`                      | Change              | `fontFaceCss` takes an optional font, to output that font's faces only                                            |
| `src/shared/canvas.ts`                     | Change              | `sealLeft(seal)` (moved out of canvas-layer) and `canvasPagesHtml(...)` (the canvas, page by page)                |
| `src/shared/pdf-body.ts`                   | New                 | zod body `{ sealTop: number \| null }`                                                                            |
| `src/server/adapters/print-font.ts`        | Copy from v2        | Reads the company font's woff2 files from `node_modules/@fontsource/<key>/files` as `data:` URLs, cached per font |
| `src/server/adapters/pdf-printer.ts`       | Copy from v2        | `printHtmlToPdf` (Chrome, JS off, only `data:` allowed, 25 s limit) + `stackPages(content, overlay, letterhead)`  |
| `src/services/tender-pdf.service.ts`       | New                 | Loads the tender, template, company, files and images, builds both HTML pages, prints, stacks                     |
| `src/app/api/tenders/[id]/pdf/route.ts`    | New                 | POST handler                                                                                                      |
| `src/lib/editor.ts`                        | Change              | `previewDocument` uses `pageDocument`; `flush` returns whether it saved; `downloadTenderPdf()`                    |
| `src/components/editor/page-preview.tsx`   | Change              | Reports the measured seal top (`onSealTop`)                                                                       |
| `src/components/editor/canvas-layer.tsx`   | Change              | Uses `sealLeft` from shared                                                                                       |
| `src/components/editor/editor-page.tsx`    | Change              | Keeps the seal top in a ref and passes it to the top bar                                                          |
| `src/components/editor/editor-top-bar.tsx` | Change              | The working Generate PDF button                                                                                   |
| `next.config.ts`                           | Change              | `printerFiles` takes all 10 fonts' woff2 files from `@fontsource/*/files`                                         |

## Build steps

1. `src/shared/page-document.ts` + `src/shared/fonts.ts`:
   - Move `PREVIEW_CSS` and the body of `previewDocument` here as `pageDocument`. It fills the template with `mark: true`, adds the font rule, then adds `PREVIEW_CSS` + `extraCss` before `</head>`.
   - `fontFaceCss(urlFor, font?)`: given a font, only that font's faces.
   - `previewDocument` in `src/lib/editor.ts` becomes one call to it, with `/fonts/` URLs.
   - Check: the existing preview and fill-template tests still pass, and the preview looks the same in the browser.
2. `src/shared/canvas.ts`:
   - `sealLeft(seal)` = saved x, or 210 − 25 − width.
   - `canvasPagesHtml({ canvas, sealTop, sealUrl, imageUrls, fontCss, fontStack, pageCount })` writes `@page{size:A4;margin:0}` and one 210×297 mm transparent sheet per page.
   - It puts each item on page `floor(y / 297)` at `y − page×297`. Text gets the font stack, 12pt, line height 1.3, keeps line breaks, black. Images are contained in their box. The seal has its width and an automatic height.
   - An item with no image URL (missing file) is left out. The seal is left out when `shown` is false or its file is missing.
   - Check: unit tests for page splitting, the default seal spot, and skipped items.
3. `src/server/adapters/print-font.ts` and `pdf-printer.ts`: copy from v2.
   - The font reader takes a font key (no forced Noto).
   - The printer keeps v2's launch (Edge/Chrome locally, `@sparticuz/chromium` on Vercel), its blocking of everything but `data:`, the 25 s limit and its messages.
   - Replace v2's two merge functions with one `stackPages`. It makes the larger of the two page counts, and on each page draws the letterhead (page 1 only), then the content page, then the canvas page, skipping a layer when that page doesn't exist.
   - Check: a unit test of `stackPages` with tiny pdf-lib PDFs counts pages and layers.
4. `src/services/tender-pdf.service.ts` `makeTenderPdf(userId, tenderId, sealTop)`:
   - `getTender` handles ownership and the 404. If there is no company or no template, answer 400 "Pick a company and a template first."
   - Read the source: `customHtml` if set, otherwise the template file. Read the company's letterhead; no row or a missing file answers 400 "The letterhead file is missing. Upload it again in Companies."
   - Read the seal and each used tender image as `data:` URLs. Any that fail are dropped.
   - Content HTML = `pageDocument(source, values, fontKey, fontDataUrl, PRINT_CSS)`. `PRINT_CSS` = `@page{size:A4;margin:0}`, `html{overflow:visible}`, and `[data-empty]{visibility:hidden}`, so an empty blank keeps its space but prints nothing, the same as the preview's layout.
   - Print the content and count its pages. Print the canvas sheets (count = max of content pages and the lowest item's page). `stackPages`, then return the bytes and the name (tender name with `/\:*?"<>|` and control characters removed, then `.pdf`).
   - Check: integration tests (below).
5. `src/app/api/tenders/[id]/pdf/route.ts`:
   - `requireUserId`, `parseId`, `readJson(PdfBody)`, then the service.
   - Respond with the PDF headers, using `encodeFileName`. `export const maxDuration = 60`.
   - Check: a 401 without a session, and a 404 for another user.
6. `src/lib/editor.ts`:
   - `flush()` resolves `true` when nothing is left unsaved, `false` on failure.
   - `downloadTenderPdf(tenderId, sealTop)` POSTs the request. A 504 or a network error throws "PDF can't be made, please try again."; any other error throws the server's message. It then saves the blob through a temporary `<a download>` link and frees the URL.
7. Components:
   - `page-preview` calls `onSealTop(mm | null)` when its measure changes.
   - `editor-page` keeps it in a ref and passes `sealTop` (a getter) to the top bar.
   - `canvas-layer` uses `sealLeft`.
   - The top bar runs: `pdfBusy`, then `await onFlushSave()` (false shows the "Not saved…" toast), then `downloadTenderPdf`, then the toast on error, then `pdfBusy=false`. The seal top is sent only when `seal.y` is null. It does **not** call `onChanging`.
8. `next.config.ts`:
   - `printerFiles` font glob becomes `./node_modules/@fontsource/*/files/*-{latin,devanagari}-*-normal.woff2`.
   - Check: `pnpm build` passes, and `.next/server/app/api/tenders/[id]/pdf/route.js.nft.json` lists the font files.
9. Tests, then CHANGELOG (Spec 07).

## New packages

None. `playwright-core` 1.63.0, `@sparticuz/chromium` 153.0.0 and `pdf-lib` 1.17.1 are already installed.

## Tests

- `tests/unit/page-document.test.ts`:
  - the preview and print documents carry the same CSS and font rule
  - empty blanks are hidden in print
  - only the company font's faces are included
- `tests/unit/canvas-pages.test.ts`:
  - an item at y=310 lands on page 2 at 13 mm
  - the default seal x
  - a missing image is skipped
  - a hidden seal is left out
- `tests/unit/pdf-stack.test.ts`: `stackPages` page count and letterhead on page 1 only.
- `tests/unit/pdf-request.test.ts`: a 504 or a network error gives "PDF can't be made…", and the server message passes through.
- `tests/integration/tender-pdf.test.ts` (real Chrome, as in v2):
  - a filled tender gives a valid PDF of the right page count, named `<tender name>.pdf`
  - edited `customHtml` with a `<script>` prints without running it
  - a long template gives 2 pages
  - a missing seal or image file still prints
  - no company, no template, or no letterhead gives 400 with the spec's message
  - another user's tender gives 404, and no session gives 401

## Risks

- **Page breaks:** Chrome won't cut a line of text in half, so a line that sits on a dashed line in the preview moves to the next page in the PDF. Items lying across a dashed line are cut at the page edge.
- **Vercel:** the first PDF after an idle spell can take 10–20 s while Chrome starts. The 25 s print limit and `maxDuration` 60 cover it, but it should be checked on the live site.
- **Fonts:** single-weight fonts (Yatra One, Gotu, Tiro) print bold as faux bold, as in the preview.
- **Integration tests:** they need Edge or Chrome installed on the machine running them.

## Done when

- [ ] Every "Done when" line from the spec works in the browser
- [ ] pnpm typecheck, lint, format:check and test pass
- [ ] /check-feature 07 report is ✅ or ⚠️ with only small items
