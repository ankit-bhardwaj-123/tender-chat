# Feature check: 06-live-pdf-editing (2026-11-20)

## Verdict

⚠️ Ready after small fixes. The backend, the API and the security are solid, and every check passes except 2 unit tests I wrote that fail on purpose to show bugs. Three client-side bugs can silently lose edits: the draft never follows the server, an image upload overwrites canvas changes made while it uploads, and Hindi IME typing into an empty blank isn't saved. Fix those before you tick "everything is still there after a reload".

## Scope

Plan `.claude/plans/06-live-pdf-editing.md` and spec `.claude/specs/06-live-pdf-editing.md`. Files checked:

- Shared: `src/shared/{canvas,tender-body,dto,fill-template}.ts`, `src/types.ts`
- Lib: `src/lib/{page-editing,editor,file-upload}.ts`
- Components: `src/components/editor/{canvas-layer,page-preview,editor-page,editor-top-bar,placeholder-form}.tsx`
- Services: `src/services/{tender,tender-image,upload}.service.ts`
- Repositories: `src/repositories/{tender,tender-image,upload}.repository.ts`
- Routes: `src/app/api/tenders/[id]/route.ts`, `src/app/api/tenders/[id]/images/route.ts`, `src/app/api/tenders/[id]/images/[imageId]/route.ts`
- Database and storage: `src/server/schema.ts`, `drizzle/0005_tender-canvas.sql`, `src/server/adapters/blob-storage.ts`

## Checks

| Check            | Result                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------- |
| format:check     | ✅ pass                                                                                   |
| typecheck        | ✅ pass                                                                                   |
| lint             | ✅ pass                                                                                   |
| test             | ❌ 2 failed / 156 passed. Both failures are new tests that fail on purpose (bugs 4 and 6) |
| test:integration | ✅ 139 passed (11 files)                                                                  |

## Tests written

`tests/unit/live-editing.test.ts` (14 tests, 12 pass, 2 fail on purpose):

- Autosave diff:
  - sends nothing when the draft matches the saved tender, and only the parts that changed when it doesn't
  - a canvas whose keys come back from jsonb in another order counts as unchanged, so there is no endless save
  - **fails:** a value that differs from the server's copy only in Unicode form (NFC) still counts as a change (bug 4)
- Image pre-check (`imageProblem`): JPG/PNG in any letter case up to exactly 5 MB passes; PDF, no extension, empty and 5 MB + 1 byte each give their reason. `checkUploadPath` gives a `tenderImage` Blob upload 5 MB and only `image/jpeg`/`image/png`, and refuses a `.pdf` path.
- Edited page:
  - scripts, `onclick`/`onerror` and `<SCRIPT>` in `customHtml` never reach the preview
  - a `<script>`/`{{b}}` typed into a value is escaped and not filled
  - repeated blanks are listed once, and a deleted blank leaves the form
  - **fails:** `withBody` drops the head and the `<body …>` attributes when the template has no `</body>` (bug 6)
- Canvas: an item dragged off the left or top edge is pulled back onto the sheet, an image on page 2 keeps its `y`, Hindi/emoji/markup stay plain text in a text box, and a canvas with no seal width or a negative seal spot is refused.

`tests/integration/tender-canvas.test.ts` (17 tests, all pass):

- Canvas and edited page:
  - the canvas comes back with the same keys in the same order, from both PATCH and GET
  - markup in a text box is stored unchanged
  - a `customHtml` sent together with a template change is dropped, and unsetting the template clears it
  - a malformed canvas answers 400 and writes nothing, not even the values in the same body
  - another user's PATCH of the page or canvas answers 404 and changes nothing; a signed-out PATCH answers 401
- Images:
  - signed-out GET and DELETE answer 401
  - an image asked for through the owner's other tender, or with a malformed id, answers 404
  - the type comes from the bytes: a PNG named `.jpg` is served as `image/png`, and a GIF named `.png` is refused
  - an empty file and a PNG cut off before its signature ends are refused
  - a `..\..\evil.jpg` name is cleaned, and the storage key is `<uuid>.jpg` built by the server
  - a Hindi file name gets a safe `Content-Disposition` with `private, no-store`
  - a Blob upload reference is saved once and refused the second time; another user's folder or a `.pdf` key is refused
  - deleting the tender removes its `tender_image` rows; another user's delete answers 404 and removes no files

Totals: 29 new tests, 27 pass and 2 fail on purpose.

## Bugs (code is wrong)

1. **Medium: the draft never follows the server, so a refetch makes autosave send old data back.** In `src/components/editor/editor-page.tsx:67-72` the draft is copied from `tender.data` only when the tender id or template id changes. After that, `draftChanges(draft, tender.data)` treats any newer server copy as "local edits to save".
   - Repro A (one tab): type in a blank, and within 0.8 s click another tender. The leave flush saves it, but `sendOnLeave` (`src/lib/editor.ts:205`) doesn't update the query cache. Wait 10 s or more and come back. The cached old copy seeds the draft, the refetch brings the new one, and autosave PATCHes the old values back. The edit is gone.
   - Repro B (two tabs): edit in tab A, then focus tab B. React Query refetches on window focus, and tab B at once saves its older draft over tab A's edits. Switching back makes tab A do the same, so the tabs keep overwriting each other.
   - Fix:
     - In `sendOnLeave`/flush, also `queryClient.setQueryData(tenderKey(id), (old) => old && { ...old, ...changes })`.
     - In `EditorPage`, copy the draft from `tender.data` again when `tender.data.updatedAt` changes while `changes` is empty. This needs a `savedAt` kept in `DraftState`, adjusted during render as the key is now.
     - Optionally set `refetchOnWindowFocus: false` in `useTender`.
2. **Medium: an image upload overwrites canvas changes made while it uploads.** In `src/components/editor/page-preview.tsx:231-236`, `addImage` captures `canvas` when the upload starts and calls `onCanvas({ ...canvas, items: [...canvas.items, item] })` when it ends. Repro: pick a 4 to 5 MB image on a slow network (DevTools "Slow 4G"), then drag the seal or type in a text box during the upload. The change goes back when the image appears. Fix: let `onCanvas` take an updater, `(update: (canvas: TenderCanvas) => TenderCanvas)`, and in `editor-page` use `setState((previous) => …update(previous.draft.canvas))`, as `changeValues` already does. The same applies to `addTextAt` (line 164) and `remove`/`changeItem` in `canvas-layer.tsx`, which are safe today only because each one re-renders first.
3. **Medium (found by reading; check it by hand): Hindi typed with an IME into an empty grey blank isn't saved.** In `src/lib/page-editing.ts:147-150`, an empty blank only becomes filled on a cancelable `insertText`. IME input (Windows Hindi IME, Google Input Tools, every Android keyboard) arrives as `insertCompositionText`, which can't be cancelled. The text is typed in next to the blank's name. `sync` then skips the field because it is still `data-empty` (line 115), and `htmlFromPage` turns the span back into `{{name}}`. The page shows the text, but neither the form nor the database gets it, and it is gone after a reload. Fix: in `sync`, treat a `data-empty` field whose text is not its name as filled: delete `data-empty` and use the text without the name. Or empty the field on `compositionstart`.
4. **Low: "Saving…" sticks when the server changes the text to NFC.** The server stores values as NFC (`tender.service.ts:67`), but the draft keeps the typed form, and `sameValues` (`src/lib/editor.ts:140`) compares the raw strings. Hindi nukta letters such as क़ ज़ फ़ (U+0958–U+095F, often pasted from Word) always change under NFC, so the note shows "Saving…" forever. Fix: compare `.normalize("NFC")` in `sameValues`, or normalise in `changeValues`. The failing test in `live-editing.test.ts` shows it.
5. **Low: a save that is still in flight can land after a template change.** `changeTemplate` (`editor-top-bar.tsx:83`) doesn't wait for the autosave queue (`editor.ts:230`). On a slow network an older PATCH with the old template's `customHtml` can be applied after the template PATCH, so the old edits stick to the new template. Its late response can also set the cache back to the old `templateId`. The leave flush (`editor.ts:244`) also runs alongside the queue, so an older queued save can land after it. Fix: have `useAutosave` return `flush(): Promise<void>` (cancel the timer, then wait for `queue.current`). Await it in `run()` before the company or template PATCH. Chain the unmount flush on the queue too.
6. **Low: the first page edit drops the template's head when it has no `</body>`.** `withBody` (`src/lib/page-editing.ts:54`) falls back to "styles plus body" when there is no closing body tag. `<meta charset>`, `<title>` and the `<body style=…>` padding are lost, so the layout can change after the first keystroke. Fix: when `<body …>` exists but `</body>` doesn't, return `source.slice(0, open end) + inner`.
7. **Low: the leave flush checks the size in characters, but keepalive's limit is 64 KiB of bytes.** In `src/lib/editor.ts:210`, Hindi takes 3 bytes per character in UTF-8, so a `customHtml` of about 25,000 characters already goes over the limit. `fetch` then rejects, and the error is swallowed, which loses the last 0.8 s of edits when the tab is closed or reloaded. Fix: `new TextEncoder().encode(body).length < 60000`.
8. **Low: a placeholder inside an attribute is baked into the page.** `htmlFromPage` puts back only `[data-field]` spans. A `{{x}}` inside an attribute (for example `title="{{x}}"`) is saved as its current value at the first page edit and leaves the form. Note it in the template guidance, or keep the original attribute text in a `data-` attribute.

## Security

Nothing found above low:

- **Low:** `customHtml` and canvas `text` have no size limit, and there is no cap on images per tender (`tender-body.ts:11-12`, `canvas.ts:17`, `tender-image.service.ts:59`). This was accepted in the plan's Risks, but a cap is cheap, for example `customHtml` ≤ 4 MB, ≤ 500 items and ≤ 50 images.
- **Note for Round 7:** `customHtml` is stored exactly as the client sends it, scripts included (only the preview strips them). The PDF printer must treat it as untrusted: no JavaScript, no network, `stripScripts` again.

Checked and safe:

- the iframe keeps `sandbox="allow-same-origin"` with no `allow-scripts`, even while editable
- pasting and dropping in the page are plain text only, and text boxes are `plaintext-only` set through `textContent`
- values are escaped through `valueHtml`, and `customHtml` goes through `stripScripts` (test added)
- every image route answers 401 without a session and 404 for another user's or another tender's image (tests)
- the type is decided by the bytes; the 0, 5 MB and 5 MB + 1 limits hold
- keys are built by the server, with no traversal, and file names are cleaned
- the Blob `tenderImage` kind, path pattern and content types are checked, and Blob stays private
- GET answers `nosniff` and `private, no-store`
- errors are `{ error: { message } }`, and CSP is untouched

## Edge cases

| Case                                                       | Handled? | Note                                                                         |
| ---------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| Autosave order (two saves in a row)                        | ✅       | They are queued one after another                                            |
| Save in flight during a template or company change         | ⚠️       | Bug 5                                                                        |
| Edits waiting when a template change is confirmed          | ✅       | Autosave pauses; values and canvas go with the template PATCH                |
| Template change clears `customHtml` on the server          | ✅       | Even when sent in the same body (test)                                       |
| Leave or refresh within 0.8 s                              | ⚠️       | Flushed, but the cache stays old (bug 1) and the byte limit is wrong (bug 7) |
| Two tabs on one tender                                     | ❌       | Bug 1, repro B                                                               |
| Deleting a whole blank                                     | ✅       | It leaves the form; Reset brings it back                                     |
| Repeated placeholders                                      | ✅       | Typing in one updates the other; listed once (test)                          |
| IME / Android typing into an empty blank                   | ❌       | Bug 3 (check by hand)                                                        |
| `<script>`, `{{x}}`, emoji, Hindi in values and text boxes | ✅       | Tests                                                                        |
| NFC-changing Hindi letters                                 | ⚠️       | Bug 4                                                                        |
| Seal auto spot, seal deleted, then company changed         | ✅       | `shown:false` and `x/y` survive a company change (existing test)             |
| Images and text boxes on page 2                            | ✅       | `y` is measured down the whole sheet; the page count grows                   |
| Canvas edits during an image upload                        | ❌       | Bug 2                                                                        |
| Template with no `</body>`                                 | ❌       | Bug 6                                                                        |
| Image file gone from storage                               | ✅ / ⚠️  | The grey "Image not found" box shows, but GET answers 500, not 404           |
| Deleted image still on the canvas when a save fails        | ✅       | The grey box shows and can be deleted                                        |
| 5 MB exactly / 5 MB + 1                                    | ✅       | Tests (server and client pre-check)                                          |

## Quality and owner's rules

- **Choices to confirm** (not in the spec):
  - Delete/Backspace never removes a text box (`canvas-layer.tsx:137`); the spec says "Pressing Delete removes it" for every item. Text boxes need the trash button.
  - An empty text box is removed on blur (`canvas-layer.tsx:238`), including when the window loses focus.
  - Dragging a text box works only from its border or the Move handle. Clicking the text places a cursor.
- **Import chain:** `page.tsx → editor-page → page-preview → canvas-layer → lib/editor → lib/file-upload` is 6 of our own files, against the limit of ≤ 3. This is the same open question as the 02 and 05 reports (do `lib`/`shared` count as leaves?). Component depth (`EditorPage → PagePreview → CanvasLayer`) is fine.
- **Theme tokens:** `text-white` on the trash button (`canvas-layer.tsx:161`) should be a token. Use `text-primary-foreground`, or the soft `variant="destructive"` from the skill. `text-black` (line 221) on the white sheet is acceptable as "paper ink", but say so in the skill.
- **Toast text:** "Image can't upload: Image must be a JPG or PNG" repeats "Image", has a capital mid-sentence and no full stop (skill: short sentences ending in "."). Lower-case the server reason and add "." in `page-preview.tsx:239`.
- **Save note accessibility:** the `role="status"` note (`editor-top-bar.tsx:183`) announces "Saving… Saved" on every pause in typing. Announce only "Not saved" (put `aria-live` on that part only). Also, Retry shows no "Saving…" while it retries (`editor.ts:259`).
- **Keyboard:** items can't be moved with the arrow keys, and the Move button only works with a pointer. This is low priority.
- **Plain types, no classes, no comments, repositories take `db: Executor = defaultDb`, no setState inside effects:** none found. The setState calls during render are React's allowed "adjust state while rendering" pattern.

## Plan match

- `placeholder-form.tsx` was listed as Change but is unchanged. The edited page's blanks are read in `editor-page.tsx:156-160` instead, which gives the same behaviour.
- `newTextBox(x, y)` and `newImage(imageId)` take an extra `id` first. That's fine.
- The "Delete or Backspace removes a selected item" line in Screens is not true for text boxes (see the choices above).
- Otherwise it matches the plan: the routes, methods, 201/204 answers, the database shape, the default canvas, clearing `customHtml` on a real template change, and removing files with the tender.

## Doing well

- The server side is tight. Ownership goes through `findTenderById` before every image read or delete, and the type is decided by bytes through `readUploadHead`. A failed upload is cleaned up with `discardUpload`, and the template-change rule lives in one place (`tender.service.ts:100`).
- The editable page keeps the sandbox: listeners are attached from the parent, so the iframe never needs `allow-scripts`, and paste is plain text only.
- The canvas is stable through the database (zod gives the keys back in one order) and kept small. Autosave sends only the parts that changed, and the queue keeps saves in order.

## Next steps

1. Fix bug 1: copy the draft from the server again when nothing is waiting to save, and update the cache on the leave flush. Then test two tabs and "leave within 1 s, come back after 10 s" by hand.
2. Fix bug 2 by passing a canvas updater to `onCanvas`.
3. Check Hindi IME typing into an empty grey blank by hand, then fix bug 3 in `sync`.
4. Fix bugs 4 and 6 so the 2 failing tests pass. Both are one-line fixes.
5. Add `flush()` to `useAutosave` and await it before a company or template change (bug 5), and count keepalive bytes (bug 7).
6. Decide on Delete for text boxes, the import-chain rule, and limits for `customHtml`, items and images.
7. Add a CHANGELOG entry for this check (the checker may not edit `CHANGELOG.md`).
