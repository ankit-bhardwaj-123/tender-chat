# Plan 09: Saved PDFs

Spec: .claude/specs/09-saved-pdfs.md (updated first with the owner's changes below) · Status: approved, waiting for "go" · 2026-11-23

## In short

The top bar gets two buttons: **Save** and **Generate PDF**.

- **Save** makes the PDF on the server, the same way Generate PDF does, and stores the finished file plus a row in a new `saved_pdf` table.
- **Name:** the first save in a tender or subfolder is named after the company ("Sharma Builders"). The next ones are "Sharma Builders 2", "Sharma Builders 3", and so on.
- **Saved PDFs dropdown:** it shows up after the first save. Picking an item opens that stored file in a new tab. Because the file itself is stored, later changes to the company or template can't change it.
- **Generate PDF** stays exactly as it is today (it downloads, nothing is saved).
- The automatic-save status ("Saving… / Saved") is hidden. Autosave itself keeps running.

## Spec changes (owner, 2026-11-23; written into Spec 09 before coding)

- There are two buttons, not one "Save & Generate PDF". Save stores the PDF and doesn't open it. Generate PDF works as now.
- **Saved name:** the company name, then "<company> 2", "<company> 3", … counted per tender or subfolder and per company name. The first free number is used.
- The dropdown appears only after the first save. Picking an item opens it in a new tab, so no pop-up blocker message is needed, because the tab opens straight from the click.
- **Errors:**
  - If the PDF is made but storing it fails: "PDF generated but failed to save. Please try again."
  - If the PDF can't be made: the same messages as Generate PDF.
- **Autosave status:** "Saving…" and "Saved" are hidden. "Not saved · Retry" still shows when an autosave fails, so changes are never lost silently. Say if you want that hidden too.

## Spec problems

None. A folder with subfolders has no editor (Spec 08), so PDFs are only saved in a subfolder or in a tender without subfolders.

## Database

- New table `saved_pdf`:
  - `id`
  - `tender_id`: points to `tender`; on delete cascade
  - `name`
  - `company_name`, `template_name`: as they were when saved
  - `storage_key`: unique
  - `size_bytes`
  - `created_at`
  - index on (`tender_id`, `created_at`)
- Migration: `pnpm db:generate --name saved-pdfs`, then `pnpm db:migrate`.

## API routes

All need a signed-in user; another user's tender or PDF answers 404.

| Method | Path                                   | What it does                            | Sends         | Gets back                                                       |
| ------ | -------------------------------------- | --------------------------------------- | ------------- | --------------------------------------------------------------- |
| GET    | `/api/tenders/[id]/saved-pdfs`         | The tender's saved PDFs, newest first   | —             | `SavedPdf[]` (`id, name, companyName, templateName, createdAt`) |
| POST   | `/api/tenders/[id]/saved-pdfs`         | Make the PDF, store it, name it         | `{ sealTop }` | 201 `SavedPdf`                                                  |
| GET    | `/api/tenders/[id]/saved-pdfs/[pdfId]` | The stored file, `inline`, `<name>.pdf` | —             | `application/pdf`                                               |

## Screens

- **Top bar:** [Saved PDFs ▾] right after Template, where Font used to be (only when there is at least one); on the right [Save] (outline) · [Generate PDF] (primary).
- **Save:**
  - It saves any pending autosave first, then saves the PDF.
  - While it works, it shows a spinner and "Saving PDF…", and can't be clicked again.
  - Done: a green toast "Saved as “Sharma Builders 2”.", and the dropdown list refreshes.
  - Like Generate PDF, it's greyed out until a company and a template are chosen.
- **Saved PDFs dropdown:** a menu button with a `Files` icon and the count. Each item shows the name and, in small grey text, the date and time ("23 Nov 2026, 4:30 pm"). An item is a link with `target="_blank"`, so it opens in a new tab from the click itself.
  - Loading: the button is hidden until the list arrives.
  - Error loading: the button is hidden and no toast is shown, so the editor isn't blocked.
- **Generate PDF:** no change.
- **Autosave status:** shown only when an autosave fails (Not saved · Retry).

## Files

| File                                                   | New / Change | What it does                                                         |
| ------------------------------------------------------ | ------------ | -------------------------------------------------------------------- |
| `.claude/specs/09-saved-pdfs.md`                       | Change       | The owner's changes above                                            |
| `src/types.ts`, `src/shared/dto.ts`                    | Change       | `SavedPdf` type and `toSavedPdf`                                     |
| `src/server/schema.ts` + `drizzle/0007_saved-pdfs.sql` | Change / New | `saved_pdf` table                                                    |
| `src/repositories/saved-pdf.repository.ts`             | New          | insert, list by tender, find one, names in a tender, keys of tenders |
| `src/services/tender-pdf.service.ts`                   | Change       | `makeTenderPdf` also returns the company and template names          |
| `src/services/saved-pdf.service.ts`                    | New          | save (print → store → name → insert), list, open                     |
| `src/services/tender.service.ts`                       | Change       | Deleting a folder also removes its saved PDF files                   |
| `src/app/api/tenders/[id]/saved-pdfs/route.ts`         | New          | GET list, POST save                                                  |
| `src/app/api/tenders/[id]/saved-pdfs/[pdfId]/route.ts` | New          | GET the file                                                         |
| `src/lib/saved-pdfs.ts`                                | New          | `useSavedPdfs(tenderId)`, `savePdf(tenderId, sealTop)`, file URL     |
| `src/components/editor/saved-pdfs-menu.tsx`            | New          | The dropdown                                                         |
| `src/components/editor/editor-top-bar.tsx`             | Change       | Save button, the menu, autosave status only on failure               |

## Build steps

1. **Spec 09:** rewrite "What the user does", "When something goes wrong" and "Done when" with the changes above.
2. **Types:** `src/types.ts` gets `SavedPdf { id, name, companyName, templateName, createdAt }`, and `src/shared/dto.ts` gets `toSavedPdf`.
3. **Schema:** add `savedPdf` to `src/server/schema.ts`, then run `db:generate --name saved-pdfs` and `db:migrate`.
   Check: the migration has `ON DELETE cascade`.
4. **Repository** `src/repositories/saved-pdf.repository.ts` (each function takes `db: Executor = defaultDb`):
   - `insertSavedPdf(values, db)`
   - `findSavedPdfsOfTender(tenderId, db)`, newest first
   - `findSavedPdf(tenderId, pdfId, db)`
   - `findSavedPdfNames(tenderId, db)`
   - `findSavedPdfKeysOfTenders(ids, db)`
5. **`src/services/tender-pdf.service.ts`:** `TenderPdf` gets `companyName` and `templateName`, which `makeTenderPdf` already has at hand. The download route ignores them.
6. **`src/services/saved-pdf.service.ts`:**
   - `nextPdfName(base, names)`: if `base` is free, use it; otherwise use `"<base> N"` with the smallest N ≥ 2 that is free. This is a pure function and gets a unit test.
   - `saveTenderPdf(userId, tenderId, sealTop)`:
     1. Print with `makeTenderPdf`; it throws its usual errors.
     2. Store the file under `uploads/<userId>/<uuid>.pdf`.
     3. In a transaction, lock the tender row (`for update`), read the names, pick `nextPdfName`, and insert.
     4. If step 2 or 3 fails, delete the stored file (if it was written) and throw `unavailable("PDF generated but failed to save. Please try again.")`.
   - `listSavedPdfs(userId, tenderId)`: a 404 if the tender isn't the user's.
   - `openSavedPdf(userId, tenderId, pdfId)`: returns the stream, size and file name. A missing row or file answers 404 "This PDF can't be found.".
7. **`src/services/tender.service.ts`:** in `deleteTender`, also collect `findSavedPdfKeysOfTenders(ids)` and delete those files along with the image files.
8. **Routes:** the two `route.ts` files, written like the images routes. The file GET sends `inline; filename*=…`, `no-store` and `nosniff`. The POST body uses the existing `PdfBody`, and the POST sets `maxDuration = 60` like the PDF route.
9. **`src/lib/saved-pdfs.ts`:**
   - `SAVED_PDFS_KEY(tenderId)` and `useSavedPdfs(tenderId)` (TanStack Query).
   - `savePdf()`: the same error handling as `requestTenderPdf`, except that a 500 with the save message shows that message.
   - `savedPdfUrl(tenderId, pdfId)`.
10. **`src/components/editor/saved-pdfs-menu.tsx`:** it shows nothing until there is at least one PDF. Otherwise it's a `DropdownMenu` with the trigger "Saved PDFs (n)". Each item is `asChild` around `<a href target="_blank" rel="noopener">`, with the name and the formatted `createdAt` (`toLocaleString("en-IN", …)`).
11. **`src/components/editor/editor-top-bar.tsx`:**
    - Add `SavedPdfsMenu` and a Save button. Save runs flush, then `savePdf`, then a toast, then an invalidate.
    - The status `<span>` renders only when `saveStatus === "failed"`.
    - The Save and Generate PDF buttons share the greyed-out rule and `PICK_FIRST` hint, and are both disabled while either one is busy.
12. **Tests**, then all checks and `pnpm route:map`.

## New packages

None.

## Tests

- `tests/unit/saved-pdf-name.test.ts`:
  - "A", then "A 2", "A 3".
  - A gap is filled: with "A" and "A 3" saved, the next is "A 2".
  - Another company's names don't count.
  - Hindi names work.
- `tests/integration/saved-pdfs.test.ts`. It uses the real Chrome printer like `tender-pdf.test.ts`.
  - The first save is named after the company, and the second gets " 2".
  - The list comes back newest first.
  - GET returns the same bytes that were stored.
  - After the letterhead is replaced and the template edited, the old file is byte-for-byte the same.
  - A save failure removes the stored file and answers "PDF generated but failed to save. Please try again." (the storage `save` is mocked to fail).
  - Deleting the tender removes its PDF files.
  - Another user's tender or PDF answers 404; a missing file answers 404.

## Risks

- Each save stores a full PDF, often a few hundred KB, with no limit (as the owner asked). That's fine on Blob, but storage grows over time.
- Two quick clicks on Save are covered: the button is disabled while busy, and the server locks the tender row, so two saves never get the same name.
- Renaming or deleting saved PDFs isn't in this round.

## Done when

- [ ] Save twice → the dropdown appears with "Sharma Builders" and "Sharma Builders 2"; each opens in a new tab
- [ ] Change the letterhead, seal and font of that company and edit the template → the saved PDFs look the same
- [ ] A PDF saved in one subfolder doesn't show in another
- [ ] Generate PDF still downloads as before; "Saving… / Saved" is no longer shown
- [ ] Another user's saved PDF answers 404
- [ ] pnpm typecheck, lint, format:check, test and test:integration pass
- [ ] /check-feature 09 report is ✅ or ⚠️ with only small items
