# Plan 06: Live PDF editing

Spec: .claude/specs/06-live-pdf-editing.md · Status: approved, waiting for "go" · 2026-11-20

## In short

The preview page becomes editable like a Word page. We copy v2's way of doing it:

- The template iframe's body gets `contentEditable` (the browser's built-in "you can type here" mode). Our page listens to its typing events from outside; scripts inside the iframe still can't run.
- Typing inside a blank sends the value to the form. Typing anywhere else turns the page back into template HTML (blanks put back as `{{name}}`), and the tender saves it as its own copy (`customHtml`).
- Text boxes, images and the seal are items drawn over the page (the canvas). Each one has a position and size in mm, and you can select, drag, resize and delete it.
- The Save button goes. A small autosave sends the changes about 0.8 s after the last edit, and the top bar shows "Saving… / Saved / Not saved (Retry)". Generate PDF sits greyed out where Save was.

## Spec problems

- **"Click an empty spot adds a text box":** the whole template page can now be typed in, so a click near text has to place the cursor. We treat a click as "empty" only when it lands on the bare page, at least one line away from any text. A click close to text puts the cursor there instead, and the Add text button always works.
- **Deleting a whole blank:** if a selection takes in a `{{blank}}` and is deleted, that blank is gone from this tender's page and its box leaves the form. Reset template text brings it back. (v2 blocked such deletes, but you asked for "delete anything".)

## Database

- `tender` gets two new columns:
  - `custom_html`: text, can be empty. Empty means "use the template as uploaded".
  - `canvas`: jsonb. It holds the items: `{ items: [{ id, kind: text|image, x, y, width, height, text, imageId }], seal: { shown, x, y, width } }`. A seal `x`/`y` of null means "auto spot, 2 lines under the text", as today. Default `{ items: [], seal: { shown: true, x: null, y: null, width: 35 } }`. `y` is measured down the whole tall sheet, so page 2 starts at 297 mm.
- New table `tender_image`: id, tender (deleted with it), storage key (unique), file name, content type, size, created at.
- Migration: `pnpm db:generate --name tender-canvas`, then `pnpm db:migrate`.

## API routes

All need a signed-in user. Another user's tender or image answers 404.

| Method | Path                                 | What it does                                                          | Sends                                                          | Gets back                              |
| ------ | ------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| PATCH  | `/api/tenders/[id]`                  | Already there. Now also takes the edited page and the items           | adds `customHtml?` (string or null) and `canvas?`              | `Tender` (with `customHtml`, `canvas`) |
| POST   | `/api/tenders/[id]/images`           | Upload one image (a JPG or PNG of at most 5 MB, checked by its bytes) | form `file` (or a Blob upload reference, as for company files) | `{ id, fileName }` (201)               |
| GET    | `/api/tenders/[id]/images/[imageId]` | Show the image                                                        | —                                                              | the image                              |
| DELETE | `/api/tenders/[id]/images/[imageId]` | Remove the image and its stored file                                  | —                                                              | 204                                    |

- A PATCH that changes `templateId` also clears `customHtml` on the server, so the old template's edits can never stick to the new template.
- Deleting a tender also removes its stored image files.

## Screens

- **Top bar:** the Save button is replaced by a greyed-out **Generate PDF** button (tooltip "Coming soon"). Next to it, a save note: "Saving…", "Saved", or a red "Not saved" with **Retry**.
- **Preview header:** the zoom controls, plus **Add text**, **Add image**, **Add seal** (shown only when the seal was deleted and the company has one) and **Reset template text** (disabled when nothing was edited; it asks first).
- **Page:** click any text and type. One click on an item gives it a blue border, a drag handle and a corner resize handle (resize for images and the seal), plus a small trash button. Delete or Backspace removes a selected item. A text box is typed into straight away.
- **Image upload:** a spinner on the Add image button while it uploads. A failure shows the red toast "Image can't upload: <reason>".
- **Image not found:** a grey box with "Image not found" in its place, which can be deleted.
- **Form:** lists the blanks that are still on this tender's page, read from the edited copy if there is one.
- **Leaving the page:** any waiting save is sent first. The "Leave without saving?" question goes away.

## Files

| File                                                                                  | New / Copy / Change                                             | What it does                                                                                                          |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/shared/canvas.ts`                                                                | Copy v2 `quotation-canvas.ts`                                   | Zod body for the canvas, the default canvas, a new text box and new image, keeping items on the sheet                 |
| `src/shared/tender-body.ts`, `src/shared/dto.ts`, `src/types.ts`                      | Change                                                          | `customHtml`, `canvas` and `TenderImage` types; the `tenderImage` upload kind                                         |
| `src/server/schema.ts` + `drizzle/`                                                   | Change                                                          | The two new columns and the `tender_image` table                                                                      |
| `src/repositories/tender.repository.ts`                                               | Change                                                          | Save the new columns, and use the database clock for `updatedAt` (fix 6 from the Round 5 check)                       |
| `src/repositories/tender-image.repository.ts`                                         | Copy v2                                                         | Insert, find, list and delete image rows                                                                              |
| `src/services/tender.service.ts`                                                      | Change                                                          | New fields, clear `customHtml` on a template change, remove image files on delete                                     |
| `src/services/tender-image.service.ts`                                                | Copy v2 `quotation-image`                                       | Ownership, the 5 MB JPG/PNG check by bytes, save, open, remove                                                        |
| `src/services/upload.service.ts`                                                      | Change                                                          | Add `tenderImage`: 5 MB, jpg/jpeg/png                                                                                 |
| `src/app/api/tenders/[id]/images/route.ts`, `.../[imageId]/route.ts`                  | Copy v2                                                         | The three image routes                                                                                                |
| `src/lib/editor.ts`                                                                   | Change                                                          | `useAutosave`, the image upload/delete/URL helpers                                                                    |
| `src/lib/page-editing.ts`                                                             | Copy v2 parts of `lib/quotation.ts` and `quotation-preview.tsx` | Hook the iframe's typing events, turn the page back into template HTML, spot an "empty" click                         |
| `src/components/editor/canvas-layer.tsx`                                              | Copy v2 `quotation-canvas.tsx`, trimmed                         | The items over the page: select, drag, resize, delete, image-not-found box                                            |
| `src/components/editor/page-preview.tsx`                                              | Change                                                          | Editable iframe, new header buttons, canvas layer, the seal moves into it; measuring by `ResizeObserver` (fix 1)      |
| `src/components/editor/editor-page.tsx`, `editor-top-bar.tsx`, `placeholder-form.tsx` | Change                                                          | Drop Save and the leave guard, hold `customHtml` and `canvas`, show the save note, list the blanks of the edited page |
| `src/shared/fill-template.ts`                                                         | Change                                                          | Fixes 3, 4 and 5 from the Round 5 check (only with your yes, see Risks)                                               |

## Build steps

1. `src/shared/canvas.ts` and the types:
   - Write the canvas types, the zod body, the default canvas, `newTextBox(x, y)`, `newImage(imageId)`, and keeping an item inside the sheet width.
   - Add `customHtml` and `canvas` to `UpdateTenderBody`, `Tender` and `toTender`.
     Check: the contract tests pass.
2. `schema.ts` and the migration: add the columns and the table, then `db:generate` and `db:migrate`.
   Check: the migration runs on Neon and on `tender_chat_test`.
3. Repositories: save `customHtml` and `canvas`, use `now()` for `updatedAt`, and add the image row functions. Every function takes `db: Executor = defaultDb`.
4. Services:
   - Tender: pass the new fields through. When `templateId` really changes, set `customHtml` to null. On delete, read the image keys first, then remove the files.
   - Images: copy v2. A `tenderImage` upload kind with a 5 MB limit. Allow only bytes that start like a JPG or a PNG; otherwise answer "Image must be a JPG or PNG.", or "Image must be at most 5 MB." when it is too big.
     Check: integration tests.
5. Routes: POST, GET and DELETE for images, copied from the company file route (same headers: `nosniff`, `private, no-store`).
6. `src/lib/editor.ts`:
   - `useAutosave(tenderId, changes)`: wait 0.8 s after the last change, then PATCH only what changed. Keep the status (saving, saved or failed) and let Retry resend.
   - On page hide, send any waiting change with `keepalive`.
   - Add `uploadTenderImage`, `deleteTenderImage` and `tenderImageUrl`.
7. `src/lib/page-editing.ts`, copied from v2:
   - `attachEditing(page, handlers)` makes the body editable and pastes plain text only.
   - Typing in a grey empty blank replaces its name with the first letter.
   - Enter in a blank adds a line break.
   - It reports field edits and page edits.
   - `htmlFromPage(page, source)` puts the blanks back as `{{name}}`.
   - `isEmptySpot(page, x, y)` decides whether a click is far from text.
8. `canvas-layer.tsx`:
   - Draw each item in mm × scale. Pointer drag moves an item (v2's `setPointerCapture`), and a corner handle resizes it.
   - Delete/Backspace on a selected item removes it, and deleting an image also calls `deleteTenderImage`.
   - The text box is `contentEditable` with plain text, in the company font.
   - The seal uses its saved spot, or the auto spot.
9. `page-preview.tsx`:
   - Hook `attachEditing` when the iframe loads, and show the header buttons.
   - An empty-spot click calls `newTextBox` there.
   - Add image opens a file picker, uploads, then adds the item. Its errors go to the toast.
   - Reset asks first, then sets `customHtml` to null.
   - Measure with a `ResizeObserver` on the iframe body.
10. `editor-page.tsx`, `editor-top-bar.tsx` and `placeholder-form.tsx`:
    - Hold the values, `customHtml` and `canvas` as the draft, and feed it to `useAutosave`.
    - Remove Save and the leave guard.
    - Add the greyed Generate PDF button and the save note.
    - The form reads its blanks from `customHtml ?? template html`.
    - A template change confirms and keeps the canvas.
11. Tests (below), then `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm test:integration`.

## New packages

None. Dragging uses plain pointer events, as in v2.

## Tests

- `tests/unit/canvas.test.ts`: default canvas, new text box and new image, keeping items on the sheet, the zod body refusing bad items.
- `tests/unit/page-editing.test.ts`: `htmlFromPage` puts blanks back and keeps the head and styles (string-level cases).
- `tests/contract/tender-body.test.ts`: `customHtml` and `canvas` are accepted, and bad shapes are refused.
- `tests/integration/tender-images.test.ts`: JPG and PNG upload, a wrong type, 5 MB + 1 byte, GET and DELETE, another user's tender or image answers 404, deleting a tender removes its files.
- `tests/integration/tender-editor.test.ts` (add to it): `customHtml` and `canvas` save and load; a template change clears `customHtml` and keeps `canvas`; a company change keeps both.

## Risks

- **Round 5 check fixes:** fixes 1 (page count) and 6 (`now()`) are folded in, because we rewrite those parts anyway. Fixes 3, 4 and 5 (`fill-template.ts`) are listed too. Say "no" if you want them left out. Fix 2 (leave guard) goes away with autosave.
- **Empty-spot clicks** may sometimes add a text box when you meant to click into text, or the reverse. We tune the "one line away" distance by hand.
- **No size limit** on `customHtml` or the number of images, because none was asked for. A huge paste would make large saves.
- **Image types and size** (JPG/PNG, 5 MB) are the suggested defaults from the spec's open question.
- **Round 7** must print `customHtml` plus the canvas items. This plan stores them in a shape the PDF can use directly.

## Done when

- [ ] Every "Done when" line from the spec works in the browser
- [ ] pnpm typecheck, lint, format:check and test pass
- [ ] /check-feature 06 report is ✅ or ⚠️ with only small items
