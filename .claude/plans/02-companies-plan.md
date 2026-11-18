# Plan 02: Companies

Spec: .claude/specs/02-companies-spec.md · Status: approved, waiting for "go" · 2026-11-18

## In short

A Companies page (user menu → Companies) lists the user's companies. A dialog adds or edits one: a name, a letterhead PDF and a seal JPG. Files go to the same file store as v2 (local `storage/` folder in dev, private Vercel Blob in production). We copy v2's company code and its upload helpers, and trim them to name + letterhead + seal. Every query filters by the signed-in user, so another user's company answers 404.

## Spec problems

- None that block the build. The spec's questions are settled as suggested ("use your suggestions"): file names with an "open" link (no thumbnails), JPG only for the seal, name required, files can be added later, no company limit. What a tender does with a deleted company is left to Round 4.
- Vercel refuses request bodies over 4.5 MB, but files may be 10 MB. So in production the browser sends the file straight to Blob first and then tells our API its key (v2's `/api/uploads/token` route). Locally the file goes in a normal form upload. This is how v2 works; no new package.

## Database

- `company`: id, user_id (cascades on user delete), name, status `active | void` (default active), created_at, updated_at. Index on (user_id, created_at).
- `company_file`: company_id (cascades), kind `letterhead | seal`, storage_key (unique), file_name, content_type, size_bytes, created_at. Primary key (company_id, kind), so one of each per company.
- Migration: `pnpm db:generate --name companies`, then `pnpm db:migrate`.

## API routes

All need a signed-in user (401). Another user's id, a voided company or a malformed id answers 404 "Company not found.".

| Method | Path                               | What it does                              | Sends                                                 | Gets back         |
| ------ | ---------------------------------- | ----------------------------------------- | ----------------------------------------------------- | ----------------- |
| GET    | `/api/companies`                   | My active companies, oldest first         | —                                                     | `Company[]`       |
| POST   | `/api/companies`                   | Create                                    | `{ name }`                                            | `Company` (201)   |
| GET    | `/api/companies/[id]`              | One company                               | —                                                     | `Company`         |
| PATCH  | `/api/companies/[id]`              | Rename                                    | `{ name }`                                            | `Company`         |
| DELETE | `/api/companies/[id]`              | Mark void                                 | —                                                     | 204               |
| PUT    | `/api/companies/[id]/files/[kind]` | Upload or replace the letterhead or seal  | form `file`, or `{ file: { key, fileName } }` on Blob | `Company`         |
| GET    | `/api/companies/[id]/files/[kind]` | Open the file (inline, private, no cache) | —                                                     | the file          |
| DELETE | `/api/companies/[id]/files/[kind]` | Remove the file                           | —                                                     | `Company`         |
| POST   | `/api/uploads/token`               | Blob only: a one-time upload token        | Blob's own body                                       | Blob's own answer |

`Company` = `{ id, name, createdAt, updatedAt, files: { letterhead: CompanyFile | null, seal: CompanyFile | null } }`, `CompanyFile` = `{ fileName, size }`. `[kind]` other than `letterhead`/`seal` answers 404.

## Screens

- **`/settings/companies`**: title "Companies", "+ Add company" button, and the list card. Loading: skeleton rows. Empty: a building icon, "No companies yet" and "+ Add company". Error: "Couldn't load your companies." with Retry.
- **Company row**: icon tile, name, and a small summary ("Letterhead · Seal", "No seal", "No files yet"). A ⋯ menu with Edit and Delete. Delete asks "Delete this company?" (alert dialog), then a toast "Company deleted.".
- **Company dialog** (add and edit): a Name box (required), then two file fields: Letterhead (PDF) and Seal (JPG). A saved file shows its name, size, an "Open" link (new tab) and a Remove button; a picked file shows its name before saving. Save: creates or renames, then removes and uploads files one by one, with "Saving…" / "Uploading 1 of 2…" on the button. Done: toast "Company added." / "Company updated." and the dialog closes. Error: a red toast with the server's message ("Letterhead must be a PDF.", "Seal must be a JPG.", "A file must be at most 10 MB.") or "Something went wrong, please try again."; the dialog stays open with what was already saved.

## Files

| File                                                                                                             | New / Copy / Change    | What it does                                                                    |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| `src/types.ts`                                                                                                   | Change                 | `Company`, `CompanyFile`, `CompanyFileKind`, `UploadRef`                        |
| `src/shared/company-body.ts`                                                                                     | New (from v2, trimmed) | zod body `{ name }` (trimmed, 1–200 chars)                                      |
| `src/shared/dto.ts`                                                                                              | Change                 | `toCompany(row, files)`                                                         |
| `src/server/schema.ts`                                                                                           | Change                 | `company`, `company_file`, two enums, relations                                 |
| `src/server/http.ts`                                                                                             | Change                 | add `readUploads` and `encodeFileName` from v2                                  |
| `src/server/adapters/file-storage.ts`, `local-storage.ts`, `blob-storage.ts`                                     | Copy from v2           | save / read / size / delete files                                               |
| `src/repositories/company.repository.ts`                                                                         | Copy, trim             | list, find, insert, rename, void, file find/lock/upsert/delete; no tender joins |
| `src/repositories/upload.repository.ts`                                                                          | Copy, trim             | `isStorageKeyUsed` (company files only)                                         |
| `src/services/upload.service.ts`                                                                                 | Copy, trim             | one limit: company file 10 MB, `pdf`/`jpg`/`jpeg`; receive, read head, discard  |
| `src/services/company.service.ts`                                                                                | Copy, trim             | rules, file-type check, 404s                                                    |
| `src/app/api/companies/route.ts`, `[id]/route.ts`, `[id]/files/[kind]/route.ts`                                  | Copy, trim             | the routes above                                                                |
| `src/app/api/uploads/token/route.ts`                                                                             | Copy                   | Blob upload token                                                               |
| `src/lib/file-upload.ts`                                                                                         | Copy, trim             | `sendWithFiles` (form locally, Blob in production)                              |
| `src/lib/companies.ts`                                                                                           | Copy, trim             | `useCompanies`, save, upload, remove, delete calls                              |
| `src/components/companies/company-list.tsx`, `company-dialog.tsx`, `file-field.tsx`, `delete-company-dialog.tsx` | Copy, trim / New       | the page's list, dialog, file box, delete confirm                               |
| `src/app/(app)/settings/companies/page.tsx`                                                                      | Change                 | shows `CompanyList`                                                             |
| `tests/integration/companies.test.ts`, `users.ts`, `tests/contract/company-body.test.ts`                         | Copy, trim / Change    | tests below                                                                     |

## Build steps

1. `src/types.ts`, `src/shared/company-body.ts`, `src/shared/dto.ts`:
   - Write the plain `Company`, `CompanyFile`, `UploadRef` interfaces and `CompanyFileKind = "letterhead" | "seal"`.
   - Body: name is trimmed, NFC-normalised, 1–200 characters.
   - `toCompany` puts the matching file rows under `files.letterhead` / `files.seal`.
     Check: `pnpm typecheck`.
2. `src/server/schema.ts` → migration:
   - Add the two enums and two tables as in "Database"; add relations to `user`.
   - Run `pnpm db:generate --name companies` and `pnpm db:migrate`.
     Check: the migration file has only the two tables, two enums and the index.
3. Storage adapters and `src/server/http.ts`:
   - Copy the three adapters unchanged. Add `readUploads` (form or JSON ref) and `encodeFileName` to `http.ts`.
     Check: `pnpm typecheck`.
4. `src/repositories/company.repository.ts` and `upload.repository.ts`:
   - Every company query filters by user_id and status active; all take `db: Executor = defaultDb`.
   - Void sets status `void`. File upsert replaces the row for (company, kind). Delete returns the old storage key.
     Check: used by the integration tests in step 9.
5. `src/services/upload.service.ts` and `company.service.ts`:
   - Upload: keep `receiveUpload`, `readUploadHead`, `discardUpload`, `checkUploadPath` for the single company-file limit.
   - File check: empty → "The file is empty."; over 10 MB → "A file must be at most 10 MB."; letterhead must start with `%PDF-` else "Letterhead must be a PDF."; seal must start with `FF D8 FF` else "Seal must be a JPG.".
   - Upload in a transaction: confirm ownership, lock the old row, upsert, then delete the old stored file. On any error, discard the new upload.
   - Missing or foreign company → `notFound("Company not found.")`.
     Check: integration tests.
6. Routes `src/app/api/companies/**` and `src/app/api/uploads/token/route.ts`:
   - Each handler: `handle` → `requireUserId` → `parseId` → service → JSON. Only HTTP handlers are exported.
   - File GET sends `Content-Type`, `Content-Disposition: inline`, `Cache-Control: private, no-store`, `nosniff`.
     Check: `pnpm route:map` lists the new routes.
7. `src/lib/file-upload.ts`, `src/lib/companies.ts`:
   - Trim the extension table to the company file. Keep `useCompanies` (react-query, key `["companies"]`), `saveCompanyName`, `uploadCompanyFile`, `removeCompanyFile`, `deleteCompany`, `companyFileUrl`.
     Check: `pnpm typecheck`.
8. Components and the page:
   - `company-list.tsx`: list card, row ⋯ menu, empty/loading/error states; opens the dialog and the delete confirm.
   - `company-dialog.tsx`: one Name box and two `FileField`s; the save order from "Screens"; no v2 sections or details.
   - `file-field.tsx`: drop the thumbnail; `accept` is `.pdf` or `.jpg,.jpeg`.
   - `delete-company-dialog.tsx`: same style as `components/shell/delete-tender-dialog.tsx`.
     Check: in the browser, every spec "Done when" line.
9. Tests (see below). Then `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm test:integration`.

## New packages

None (`@vercel/blob` and `@tanstack/react-query` are already installed).

## Tests

- `tests/contract/company-body.test.ts`: name is trimmed; empty or over 200 characters is refused.
- `tests/integration/companies.test.ts`: create, list, rename and delete (void hides it from list and GET); upload a letterhead PDF and a seal JPG, open them with the right type, replace one and the old stored file is gone; a JPG as letterhead and a PDF as seal are refused with the right message; over 10 MB and empty files are refused; remove a file; unknown kind answers 404; needs sign-in (401).
- `tests/integration/isolation.test.ts`: another user's company and its files answer 404 on every route.
- `tests/integration/users.ts`: add v2's `uploadedFiles` / `deleteStoredFiles` helpers (tests use the local file store).

## Risks

- Blob upload only runs on Vercel, so the local check covers the form path only. The owner should try one upload on the deployed app.
- The PDF check reads only the first bytes, so a broken PDF that starts with `%PDF-` is accepted. It shows up in Round 4 when the letterhead is drawn. Fine for now.
- Deleting a company keeps its stored files (it is only voided). Cleaning them up is not in this spec.

## Done when

- [ ] Every "Done when" line from the spec works in the browser
- [ ] pnpm typecheck, lint, format:check, test and test:integration pass
- [ ] /check-feature 02 report is ✅ or ⚠️ with only small items
