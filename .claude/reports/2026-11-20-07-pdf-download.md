# Feature check: 07 PDF download (2026-11-20)

## Verdict

⚠️ Ready after small fixes. The overall design is sound: one shared page builder, JS off, three layers stacked, ownership checked. But two of the owner's priorities are not fully met. (1) The printer can still reach the network through `<link rel="prefetch">`, and an `<iframe>` opens a TCP connection. (2) Text boxes lose their line breaks in the PDF because of a quoting bug. Both fixes are a few lines each.

## Scope

Plan `.claude/plans/07-pdf-download.md`, spec `.claude/specs/07-pdf-download.md`.
New: `src/shared/page-document.ts`, `src/shared/pdf-body.ts`, `src/server/adapters/pdf-printer.ts`, `src/server/adapters/print-font.ts`, `src/services/tender-pdf.service.ts`, `src/app/api/tenders/[id]/pdf/route.ts`.
Changed: `src/shared/canvas.ts`, `src/shared/fonts.ts`, `src/lib/editor.ts`, `src/components/editor/{editor-top-bar,editor-page,page-preview,canvas-layer}.tsx`, `next.config.ts`.

## Checks

| Check            | Result                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| format:check     | ✅ pass                                                                                          |
| typecheck        | ✅ pass                                                                                          |
| lint             | ✅ pass                                                                                          |
| test             | ❌ fail (1 of 181): the new text box test, a code bug (Bug 1)                                    |
| test:integration | ❌ fail (5 of 184): all from the new tests and all code bugs (Bugs 2–4); every older test passes |

## Tests written

- `tests/unit/pdf-pages-edges.test.ts` (5 tests: 4 pass, 1 fails on purpose)
  - A text box keeps `white-space:pre-wrap`, `line-height:1.3`, `12pt` and `#000` with a real font stack. **Fails: Bug 1.**
  - `<script>` in a text box is escaped, while `{{rate}}` and emoji are kept as plain text.
  - An item at exactly y=297 goes to the top of page 2.
  - `PdfBody` accepts a number or null, and rejects missing, negative and text values.
- `tests/integration/pdf-printer-sandbox.test.ts` (31 tests: 28 pass, 3 fail on purpose). These run against real Edge/Chrome, a local HTTP server that counts requests and TCP connections, and real temporary files.
  - Control: a `data:` image does end up in the PDF, which proves the image check works.
  - No request and no connection for 21 network tricks: stylesheet, preconnect, dns-prefetch, preload, icon, `@import`, `@font-face`, img, srcset, picture, object, embed, video poster, audio, `<input type=image>`, SVG image, CSS background, script, onerror. **Fails for prefetch (request sent) and iframe (TCP connection opened): Bug 2.**
  - No local file is read through img, iframe, object, embed, stylesheet or CSS `url()` with `file://` (all pass).
  - A meta refresh to a web address or a local file isn't followed and the page still prints. **The web address case fails: Bug 3.**
  - A `data:` iframe with a script prints without running it (passes).
- `tests/integration/tender-pdf-edges.test.ts` (8 tests: 6 pass, 2 fail on purpose)
  - Company set but no template → 400 "Pick a company and a template first."
  - A deleted company or a deleted template still chosen on the tender → 404.
  - A letterhead row whose file is gone from storage → 400 with the letterhead message.
  - Bad body (`sealTop: "120"`, `{}`, broken JSON) → 400.
  - The file name drops `\ : " / ?` and keeps Hindi. **Fails: Bug 4 (backslash kept).**
  - An edited page with a script, an empty blank, `<b>&</b>` and `{{officer}}` inside a value prints 1 page.
  - A prefetch link in `customHtml` makes no request, through the real route. **Fails: Bug 2.**
  - A meta refresh in `customHtml` still prints (passes here, because the timing differs from the bare printer test).

Totals for new tests: 38 passed, 6 failed (all 6 are code bugs). Whole suites: unit 180/181, integration 179/184.

## Bugs (code is wrong)

1. **Medium: text boxes lose line breaks, line height and colour in the PDF.** `src/shared/canvas.ts:118`.
   - What happens: `fontStack()` returns `"Mukta", system-ui, sans-serif`, with double quotes. Those quotes go straight into `style="…font-family:"Mukta"…"`, so the attribute ends at `font-family:`. Everything after it is lost: `line-height:1.3`, `white-space:pre-wrap`, `overflow-wrap` and `color`.
   - What the user sees: a multi-line text box prints as one run-on line, and the line height differs from the preview. Font size only looks right because 12pt equals the 16px default.
   - Reproduce: `pnpm test tests/unit/pdf-pages-edges.test.ts`.
   - Fix: escape the value with `escapeHtml(input.fontStack)` (turns `"` into `&quot;`), or move the text box styling into a class in the `<style>` block (`.text{font-family:…;font-size:12pt;…}`) and keep only the position inline.
2. **High (the owner's main security ask): the printer still reaches the network.** `src/server/adapters/pdf-printer.ts:58-63`.
   - What happens: `page.route` only sees requests that go through the page. Chrome's prefetch does not, so `<link rel="prefetch" href="http://…">` in `customHtml` sends a real GET from the server. On Vercel it could hit internal addresses. This is a blind SSRF: the user can't read the response, but they can trigger the request and track when PDFs are made.
   - An `<iframe src="http://…">` also opens a TCP connection, without sending a request.
   - Reproduce: `pnpm test:integration tests/integration/pdf-printer-sandbox.test.ts -t "prefetch|a frame"`.
   - Fix, verified in a scratch script against Edge: launch the browser with a dead proxy, so nothing can leave even if the route misses it. That gave 0 requests and 0 connections for prefetch, iframe and refresh. `newContext({ offline: true })` and a CSP `<meta>` each only fixed the prefetch.
     ```ts
     const NO_NETWORK_ARGS = [
       "--proxy-server=http://127.0.0.1:9",
       "--proxy-bypass-list=<-loopback>",
     ];
     chromium.launch({ channel, headless: true, args: NO_NETWORK_ARGS });
     chromium.launch({
       executablePath,
       args: [...serverless.args, ...NO_NETWORK_ARGS],
       headless: true,
     });
     ```
     Keep `page.route` as a second wall.
3. **Low: a `<meta http-equiv="refresh">` in an edited page can make the print fail.** `src/server/adapters/pdf-printer.ts:63-64`.
   - What happens: the refresh starts a navigation that the route aborts. `page.pdf` then throws "Printing failed", which reaches the user as a 500 "Something went wrong. Please try again." It depends on timing (through the route it printed in my run). The user can only break their own PDF.
   - Fix: strip `<meta http-equiv="refresh">` along with scripts in `stripScripts` (`src/shared/fill-template.ts:27`), for example `.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, "")`. In the scratch script this both blocked the connection and let the page print.
4. **Low: a backslash is kept in the file name.** `src/services/tender-pdf.service.ts:25`.
   - What happens: in `[…/\:*?"<>|]` the `\:` is just an escaped colon, so `\` is never removed. A tender named `a\b` downloads as `a\b.pdf`. Browsers usually swap it for `_`, but the spec says it is removed.
   - Fix: `/[\u0000-\u001f\u007f/\\:*?"<>|]/g`.
   - Reproduce: `pnpm test:integration tests/integration/tender-pdf-edges.test.ts -t backslash`.

## Security

- **High: network reachable through prefetch and iframe** (Bug 2 above).
- **Low (abuse): one request can force a very long PDF.**
  - Where: `src/shared/pdf-body.ts:4`, together with `src/shared/canvas.ts` `CanvasBody` (`size` max 100000, no item count limit).
  - What happens: `sealTop: 100000`, or a canvas item at y=100000, makes `canvasPagesHtml` build 337 sheets. Images are read one at a time (`tender-pdf.service.ts:61`) and each can be 5 MB as base64, so a canvas with many images gives a huge HTML string. The 25 s limit caps the printing time, but not memory.
  - Fix: cap `sealTop` (for example `max(PAGE_HEIGHT_MM * 20)`), clamp item `y` the same way in `CanvasBody`, and cap `items` (for example `.max(50)`).
- **Low: a corrupt or encrypted letterhead gives a vague error.**
  - Where: `pdf-printer.ts:114`. The upload only checks the `%PDF-` signature (`company.service.ts:48`).
  - What happens: `embedPdf` throws, and the user gets a 500 "Something went wrong" that won't go away on retry.
  - Fix: catch the error around the letterhead embed and answer 400 "The letterhead file can't be read. Upload it again in Companies.", or test-load the PDF with pdf-lib when it is uploaded.

Checked and safe: 401 without a session (checked before the id and the body); another user's tender, and a deleted company or template, answer 404 with no leak; company, template and image lookups are filtered by user or tender; zod body plus `parseId`; JS is really off (inline scripts, `onerror` and a `data:` iframe script all stayed silent); no `file://` reads through img, iframe, object, embed, stylesheet or CSS; text box text and the file name header are escaped; `no-store`; errors are `{ error: { message } }`; `next.config.ts` CSP is unchanged (only the font glob changed).

## Edge cases

| Case                                        | Handled? | Note                                                                                                                                                                                             |
| ------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No company / no template                    | Yes      | Button greyed out; server answers 400 (tested both)                                                                                                                                              |
| Company without letterhead, or file deleted | Yes      | 400 with the spec message (tested both)                                                                                                                                                          |
| Deleted company or template still chosen    | Yes      | 404 "Company/Template not found." (tested)                                                                                                                                                       |
| Missing seal or image file                  | Yes      | Skipped (existing test)                                                                                                                                                                          |
| Font key that doesn't exist                 | Yes      | `fontOf` falls back to Poppins                                                                                                                                                                   |
| Empty blank                                 | Yes      | Hidden but keeps its space (existing tests)                                                                                                                                                      |
| Hindi, `<b>&</b>`, `{{x}}` in values        | Yes      | Prints (tested)                                                                                                                                                                                  |
| Multi-line text box                         | No       | Bug 1                                                                                                                                                                                            |
| Seal never moved, measure not ready yet     | Partly   | `sealTopOf` falls back to 237 mm (`canvas.ts:102`), but the preview hides the seal until it is measured, so the two differ. Rare; you could send nothing and skip the seal, or keep it as it is. |
| Item exactly on / across a page line        | Partly   | Starts page 2 at 0 mm (tested). Items across the line are clipped (known risk in the plan)                                                                                                       |
| Save fails before the PDF                   | Yes      | `flush()` returns false → "Not saved…" toast (`editor.ts:293-298`)                                                                                                                               |
| Double click                                | Yes      | Button disabled while `making`                                                                                                                                                                   |
| Server 500 (not 504)                        | Partly   | Shows the server text "Something went wrong. Please try again.", not the spec's "PDF can't be made, please try again." The plan chose to pass the message through; see Plan match.               |
| Two tabs                                    | Yes      | The PDF reads the database after this tab's flush                                                                                                                                                |
| Huge `sealTop` / item y                     | No       | See Security (abuse)                                                                                                                                                                             |
| Meta refresh in edited page                 | Partly   | Bug 3                                                                                                                                                                                            |

## Quality and owner's rules

- `tender-pdf.service.ts:38,49`: a missing letterhead, seal or image goes through `reportError`, which logs a level-50 "unexpected error" with a stack, even though these are expected cases (I saw it in the test log). Consider logging only real storage failures, or a quieter warning.
- `editor-top-bar.tsx:237`: the "Pick a company and a template first." tip is a `title` on a span around a disabled button. Keyboard and screen-reader users never get it, because a disabled button can't be focused. Consider showing the text next to the button, or using the shadcn Tooltip with `aria-describedby`. This is the same pattern as the old "Coming soon" tip.
- `tender-pdf.service.ts:99-100`: `fontStack(font)` and `fontFaceCss(fontUrl, font)` are worked out again although `pageDocument` already builds them. This is minor; you could compute them once.
- Import chain: `editor-top-bar → lib/editor → shared/page-document → shared/fill-template` adds one hop compared with before. Check it against your ≤ 3 rule. If it counts, `previewDocument` could import `fill-template` directly as before and `page-document` could be used only on the server.
- Otherwise the rules hold: no comments, plain interfaces, no classes, route → service → repository, no setState in effects (`page-preview.tsx:262` only calls a ref setter), theme tokens only, and no new packages.

## Plan match

- Matches the plan, with two small differences:
  - The `next.config.ts` glob uses `{400,700}` instead of `*` (the same files today).
  - `sealTopOf` and `canvasPageCount` were added to `canvas.ts` beyond the plan; both are sensible.
- Spec vs plan: for a generic server error, the spec table says "PDF can't be made, please try again.", but the plan passes the server's message through. Pick one. Mapping any 5xx to `PDF_FAILED` in `requestTenderPdf` (`editor.ts:364`) would match the spec.
- `pnpm build` and the `nft.json` font check from plan step 8 were not rerun here (per the brief).

## Doing well

- One `pageDocument` builder is used by both the preview and the print, so preview/PDF drift is limited to the canvas layer. The `[data-empty]{visibility:hidden}` trick keeps the layout the same.
- JS-off plus a `data:`-only route held up against more than 25 probes. Only browser-level prefetch slipped through, and no local file could be read at all.
- `flush()` returning a boolean is a clean way to stop the download on a failed save. `stackPages` is small and properly unit tested.

## Next steps

1. Add the dead-proxy launch args in `pdf-printer.ts` (Bug 2), then rerun `tests/integration/pdf-printer-sandbox.test.ts`.
2. Fix the text box style quoting in `canvas.ts:118` (Bug 1) and check a multi-line text box in a real PDF.
3. Strip meta refresh in `stripScripts` (Bug 3) and add the backslash to the file name regex (Bug 4).
4. Cap `sealTop`, canvas `y` and the number of items (abuse).
5. Decide on the generic 5xx message (spec vs plan), and the accessible tip on the disabled button.
6. Add a CHANGELOG line for these tests (I'm not allowed to edit `CHANGELOG.md`). Suggested: "2026-11-20: Spec 07 check: tests for PDF text boxes, printer network/file sandbox and PDF route edges; 6 fail on purpose for Bugs 1–4. Report: `.claude/reports/2026-11-20-07-pdf-download.md`. (`tests/unit/pdf-pages-edges.test.ts`, `tests/integration/{pdf-printer-sandbox,tender-pdf-edges}.test.ts`)"
