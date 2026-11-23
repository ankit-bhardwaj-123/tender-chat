# Plan 10: Name and edit saved PDFs

Spec: .claude/specs/10-edit-saved-pdf.md · Status: approved, waiting for "go" · 2026-11-23

## In short

- **Every Save keeps a full copy of what made the PDF.** The values, the page text and the canvas go into a `snapshot` column. The letterhead, seal, template text and canvas images are copied as separate stored files.
- **Edit puts that copy back.** The server writes the copy into the tender, restores any missing images, and marks the tender as "editing PDF X".
- **While editing, the old parts are used everywhere.** The editor preview and the PDF printer take the letterhead, seal, font and template text from the copy instead of from the company.
- **Save opens a dialog.** It has a Name field (suggested name filled in). While editing, it also offers Replace or Save as new.

## Spec problems

1. **"Leaving the page ends editing"** can't be done safely. In development React mounts the page twice, which would end editing at once. A page reload would also end it. Suggestion: editing stays on, saved on the tender, until **Done**. Coming back to the page shows "Editing “…”" again.
2. **"Ask only if there is unsaved work"**: autosave runs within a second, so there is almost never unsaved work, and the current work would be replaced without a word. Suggestion: Edit **always** asks "Replace what's in the editor with “X”?".
3. **After "Save as new" while editing:** the spec doesn't say which PDF is being edited next. Suggestion: editing moves to the new PDF, so the top bar shows "Editing “new name”".

## Database (`pnpm db:generate --name saved-pdf-edit`)

- **`saved_pdf`:** new `snapshot` (jsonb, nullable) and `edited_at` (nullable).
  - `snapshot` holds `companyId, templateId, fontKey, values, canvas`.
  - Null means the PDF was saved before this feature, so it can't be edited.
- **New table `saved_pdf_file`:**
  - Columns: `id`, `saved_pdf_id` (cascade), `kind` (`letterhead | seal | template | image`), `image_id` (nullable), `storage_key` (unique), `content_type`.
  - `template` holds the page HTML that was used: the edited copy, or else the template file.
- **`tender`:** new `editing_pdf_id`, pointing to `saved_pdf`, on delete set null.

## API routes

All need a signed-in user; another user's id answers 404.

| Method | Path                                                | What it does                                             | Sends                | Gets back      |
| ------ | --------------------------------------------------- | -------------------------------------------------------- | -------------------- | -------------- |
| POST   | `/api/tenders/[id]/saved-pdfs`                      | Save a new PDF (now with a name and a copy)              | `{ sealTop, name? }` | 201 `SavedPdf` |
| PUT    | `/api/tenders/[id]/saved-pdfs/[pdfId]`              | Replace: new file and copy, same id                      | `{ sealTop, name? }` | `SavedPdf`     |
| POST   | `/api/tenders/[id]/saved-pdfs/[pdfId]/edit`         | Copy the PDF's content into the tender and start editing | —                    | `Tender`       |
| GET    | `/api/tenders/[id]/saved-pdfs/[pdfId]/parts/[kind]` | The saved letterhead or seal for the preview             | —                    | file           |
| PATCH  | `/api/tenders/[id]`                                 | Now also `{ editingPdfId: null }` (Done)                 |                      | `Tender`       |

- `SavedPdf` gets `editable`, `fontKey`, `hasLetterhead` and `hasSeal`, and `Tender` gets `editingPdfId`.
- Edit on an old PDF answers 400 "Saved before editing was possible.".
- If loading the copy fails, the answer is 500 "This PDF can't be opened for editing.".

## Screens

- **Save dialog (new, `save-pdf-dialog.tsx`):**
  - A Name field, filled with the suggested name.
  - While editing, two radio choices: **Replace “X”** (picked first; fills X's name) and **Save as a new PDF** (fills the next suggested name).
  - The button shows "Saving PDF…" while it works, and the dialog closes on success. A red toast shows on error.
  - An empty name is sent empty, and the server uses the suggested name.
- **Saved PDFs menu:** each row gets **Open** (link, new tab) and **Edit**. Edit is greyed out on old PDFs, with the title "Saved before editing was possible.".
  - Clicking Edit asks first, then starts editing.
  - While the server copies the content back, the editor shows the busy overlay "Opening “X” for editing…".
- **Top bar while editing:**
  - The Company and Template dropdowns are disabled.
  - A pill shows "Editing “X”" with a **Done** button (outline, small).
  - Done sends PATCH `editingPdfId: null` and refreshes the tender.
- **Editor while editing:**
  - The letterhead and seal URLs point to `parts/…`.
  - The font is the copy's `fontKey`, and the page source is the tender's edited copy.
  - "Reset template text" is hidden, because the original template isn't the PDF's template.

## Files

| File                                                                                | New / Change | What it does                                                                                   |
| ----------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| `src/shared/pdf-name.ts`                                                            | New          | `nextPdfName`, moved from the service so the dialog can suggest names                          |
| `src/shared/pdf-body.ts`                                                            | Change       | `SavePdfBody { sealTop, name? }`                                                               |
| `src/shared/tender-body.ts`, `src/shared/dto.ts`, `src/types.ts`                    | Change       | `editingPdfId`; the new `SavedPdf` fields                                                      |
| `src/server/schema.ts` + `drizzle/0008_…`                                           | Change / New | The columns and table above                                                                    |
| `src/repositories/saved-pdf.repository.ts`                                          | Change       | Files of a PDF, replace row and files, keys including copy files                               |
| `src/repositories/tender.repository.ts`                                             | Change       | `editingPdfId` in changes; `restoreFromSnapshot` update                                        |
| `src/repositories/tender-image.repository.ts`                                       | Change       | Insert with a given id                                                                         |
| `src/services/pdf-parts.service.ts`                                                 | New          | `loadParts(userId, tender)`: from the copy when editing, else from company and template        |
| `src/services/tender-pdf.service.ts`                                                | Change       | Prints from `loadParts`                                                                        |
| `src/services/saved-pdf.service.ts`                                                 | Change       | Save with name and copy, replace, edit, parts file                                             |
| `src/services/tender.service.ts`                                                    | Change       | A company or template change, or `editingPdfId: null`, ends editing; delete removes copy files |
| `src/app/api/tenders/[id]/saved-pdfs/[pdfId]/route.ts`                              | Change       | Add PUT                                                                                        |
| `src/app/api/tenders/[id]/saved-pdfs/[pdfId]/edit/route.ts`                         | New          | POST                                                                                           |
| `src/app/api/tenders/[id]/saved-pdfs/[pdfId]/parts/[kind]/route.ts`                 | New          | GET                                                                                            |
| `src/lib/saved-pdfs.ts`                                                             | Change       | `savePdf(name)`, `replacePdf`, `editPdf`, `stopEditing`, `partUrl`                             |
| `src/components/editor/save-pdf-dialog.tsx`                                         | New          | The dialog                                                                                     |
| `src/components/editor/saved-pdfs-menu.tsx`                                         | Change       | Open and Edit per row, with a confirm                                                          |
| `src/components/editor/editor-top-bar.tsx`, `src/components/editor/editor-page.tsx` | Change       | Editing pill and lock; parts URLs, font, no Reset                                              |
| `src/components/editor/page-preview.tsx`                                            | Change       | A `canReset` prop                                                                              |

## Build steps

1. **Shared:**
   - Move `nextPdfName` to `src/shared/pdf-name.ts`, and update the service and its test import.
   - Add `SavePdfBody` and `editingPdfId: z.null().optional()`.
   - Add the new DTO fields.
2. **Schema:** change `schema.ts`, then `db:generate --name saved-pdf-edit` and `db:migrate`. `tender.editing_pdf_id` uses `AnyPgColumn` for the two-way reference.
   Check: the SQL has `ON DELETE set null` and `cascade`.
3. **Repositories:**
   - `findSavedPdfFiles(pdfId)`.
   - `replaceSavedPdf(pdfId, row, files, tx)`: update the row, delete the old file rows, insert the new ones, and return the old keys.
   - `findSavedPdfKeysOfTenders` now also returns copy keys.
   - `insertTenderImageWithId`.
   - `restoreTender(userId, tenderId, fields, tx)`.
4. **`pdf-parts.service.ts`:** `loadParts` returns `{ source, letterhead, seal, images, fontKey, companyName, templateName, companyId, templateId }` as bytes plus content types.
   - When `tender.editingPdfId` is set, it reads `saved_pdf_file` rows.
   - Otherwise it uses today's company, template and tender-image lookups, moved here from `tender-pdf.service.ts`.
   - The letterhead checks (missing or unreadable) stay the same.
5. **`tender-pdf.service.ts`:** `makeTenderPdf` takes its parts from `loadParts`, and returns the parts too, so a save can copy them without reading them twice.
6. **`saved-pdf.service.ts`:**
   - **Save:**
     1. Print.
     2. Store the PDF and one file per part (`uploads/<user>/<uuid>.<ext>`).
     3. In one transaction, lock the tender, work out the name (the given one, else `nextPdfName`), and insert the row, its copy and its file rows.
     4. When editing, set `tender.editingPdfId` to the new PDF.
     5. On any failure, delete the stored files and answer "PDF generated but failed to save. Please try again.".
   - **Replace:** the same steps, then `replaceSavedPdf` and `edited_at = now()`. The old keys are deleted after the commit, so a failure leaves the old PDF whole.
   - **Edit:**
     1. Check it's the user's PDF and has a copy.
     2. In one transaction, for each image file whose id the tender no longer has, copy the file and insert a `tender_image` with that id.
     3. Then `restoreTender`: company, template (null if gone), values, `customHtml` = the copy's template HTML, canvas, and `editingPdfId`.
   - **`openPart(kind)`** streams the letterhead or seal file.
7. **`tender.service.ts`:**
   - `checkedChanges` takes `editingPdfId: null`. A `companyId` or `templateId` change also sets it to null.
   - Delete gathers the copy keys too.
8. **Routes:** PUT, edit POST and parts GET, written like the existing saved-pdf routes.
9. **`src/lib/saved-pdfs.ts`:** the four calls plus `partUrl`. Each updates the `["tender", id]` and saved-PDF caches.
10. **Components:**
    - `save-pdf-dialog.tsx`, then the menu rows.
    - The top bar: the pill, Done and the lock. Save opens the dialog.
    - `editor-page.tsx`: when `tender.editingPdfId` matches a saved PDF in the list, use its `fontKey`, the `partUrl`s and `canReset={false}`.
    - `page-preview.tsx`: hide Reset when `!canReset`.
11. **Tests**, then every check and `pnpm route:map`.

## New packages

None.

## Tests

- `tests/unit/saved-pdf-name.test.ts`: change the import to `@/shared/pdf-name`.
- `tests/integration/saved-pdf-edit.test.ts` (real Chrome):
  - A given name is kept; an empty name gets the suggested one.
  - After the company's letterhead is replaced, Edit gives back the old values, and `parts/letterhead` gives the old bytes.
  - An image deleted after saving comes back on Edit.
  - **Replace:** same id, new file, `editedAt` set, and the old files are gone.
  - **Save as new while editing:** the new PDF uses the old letterhead, and editing moves to it.
  - Done clears `editingPdfId`.
  - An old PDF without a copy answers 400 on Edit.
  - A stranger gets 404 for edit, replace and parts.
  - Deleting the tender removes the PDF and copy files.
- `tests/integration/saved-pdfs.test.ts`: still passes. The first-save name is unchanged when no name is sent.

## Risks

- Each save now stores the letterhead, seal and images again, so storage grows faster. Copies could be shared later if needed.
- This is the largest round so far, touching about 20 files. If you'd rather, it can be split into 10a (name dialog + keeping copies) and 10b (Edit, Replace, Done).
- The spec problems above need your yes.

## Done when

- [ ] Every "Done when" line in Spec 10 works in the browser
- [ ] pnpm typecheck, lint, format:check, test and test:integration pass
- [ ] /check-feature 10 report is ✅ or ⚠️ with only small items
