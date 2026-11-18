# Plan 03: Templates

Spec: .claude/specs/03-templates-spec.md · Status: approved, waiting for "go" · 2026-11-18

## In short

A Templates page (user menu → Templates; the page stub already exists) lists the user's templates. A dialog adds or edits one: a name, a language (Hindi or English) and one HTML file. We copy v2's template code and trim it: no template PDF, no rate basis, no `{{rate_table}}` check. When an HTML file is saved, the server reads its `{{placeholders}}` once and keeps the list on the template, so the list page can show them in small blue text without opening every file. HTML files use the same file store as company files (local `storage/` in dev, private Vercel Blob in production).

## Spec problems

- **View in a new tab:** showing an uploaded HTML file as a normal web page on our site would let a script inside it run as the signed-in user. So the View link serves the HTML with a "sandbox" header (`Content-Security-Policy: sandbox`), and the browser shows the page but blocks its scripts and cookies. The user still sees it in a new tab, as the spec says. No change to what the user sees.
- **Placeholders "read from the HTML":** they are read on upload and kept with the template, instead of opening the file on every list load. Same result, just faster.

## Database

- `template`: id, user_id (cascades on user delete), name, language `hi | en` (default `hi`), status `active | void` (default active), storage_key (unique), file_name, size_bytes, placeholders (a text list, default empty), created_at, updated_at. Index on (user_id, created_at).
- Migration: `pnpm db:generate --name templates`, then `pnpm db:migrate`.

## API routes

All need a signed-in user (401). Another user's id, a voided template or a malformed id answers 404 "Template not found.".

| Method | Path                       | What it does                                 | Sends                                                                           | Gets back        |
| ------ | -------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------- | ---------------- |
| GET    | `/api/templates`           | My active templates, oldest first            | —                                                                               | `Template[]`     |
| POST   | `/api/templates`           | Create with its HTML file                    | form `name`, `language`, `file`; or JSON with `file: { key, fileName }` on Blob | `Template` (201) |
| GET    | `/api/templates/[id]`      | One template                                 | —                                                                               | `Template`       |
| PATCH  | `/api/templates/[id]`      | Change name and/or language                  | `{ name?, language? }`                                                          | `Template`       |
| DELETE | `/api/templates/[id]`      | Mark void                                    | —                                                                               | 204              |
| PUT    | `/api/templates/[id]/file` | Replace the HTML file                        | form `file`, or `{ file: { key, fileName } }` on Blob                           | `Template`       |
| GET    | `/api/templates/[id]/file` | Open the HTML (sandboxed, private, no cache) | —                                                                               | the HTML         |

`Template` = `{ id, name, language, fileName, size, placeholders: string[], createdAt, updatedAt }`.

## Screens

- **`/settings/templates`**: title "Templates", "+ Add template" button and the list card. Loading: skeleton rows. Empty: a file icon, "No templates yet" and "+ Add template". Error: "Couldn't load your templates." with Retry.
- **Template row**: icon tile; the name with a small language badge (हिन्दी / English) and the file name; below the name, in the same row, the placeholder names in small blue text joined with " · " (or "No placeholders" in grey). A ⋯ menu with View (new tab), Edit and Delete. Delete asks "Delete this template?" (alert dialog), then a toast "Template deleted.".
- **Template dialog** (add and edit): Name box (required), Language select (Hindi first, the default), and an HTML file field (`.html,.htm`; required when adding). A saved file shows its name, size and an "Open" link. Save: create sends all three at once; edit saves name/language, then uploads a new file if one was picked, with "Saving…" / "Uploading…" on the button. Done: toast "Template added." / "Template updated." and the dialog closes. Error: a red toast with the server's message (the spec's table) or "Something went wrong, please try again."; the dialog stays open.

## Files

| File                                                                                                                        | New / Copy / Change | What it does                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| `src/types.ts`                                                                                                              | Change              | `Template`, `TemplateLanguage`, `UploadKind`                                                   |
| `src/shared/template-body.ts`                                                                                               | Copy from v2, trim  | zod bodies: create `{ name, language }`, edit `{ name?, language? }`; name trimmed, NFC, 1–200 |
| `src/shared/placeholders.ts`                                                                                                | New                 | `findPlaceholders(html)`: names inside `{{ }}`, once each, in page order (Round 5 reuses it)   |
| `src/shared/dto.ts`                                                                                                         | Change              | `toTemplate(row)`                                                                              |
| `src/server/schema.ts`                                                                                                      | Change              | `template` table, two enums, relation to `user`                                                |
| `src/server/adapters/blob-storage.ts`                                                                                       | Change              | add `html`/`htm` → `text/html; charset=utf-8`                                                  |
| `src/services/upload.service.ts`                                                                                            | Change              | v2's per-kind limits: `companyFile` (10 MB, pdf/jpg/jpeg) and `template` (2 MB, html/htm)      |
| `src/repositories/upload.repository.ts`                                                                                     | Change              | `isStorageKeyUsed` also checks `template.storage_key`                                          |
| `src/repositories/template.repository.ts`                                                                                   | Copy from v2, trim  | list, find, insert, update, lock, void; all filter by user and active                          |
| `src/services/template.service.ts`                                                                                          | Copy from v2, trim  | rules, HTML checks, placeholders, 404s, file swap                                              |
| `src/app/api/templates/route.ts`, `[id]/route.ts`, `[id]/file/route.ts`                                                     | Copy from v2, trim  | the routes above                                                                               |
| `src/app/api/uploads/token/route.ts`, `src/app/api/companies/[id]/files/[kind]/route.ts`, `src/services/company.service.ts` | Change              | pass the upload kind                                                                           |
| `src/lib/file-upload.ts`                                                                                                    | Change              | each part carries its kind (v2's `clientPayload`)                                              |
| `src/lib/templates.ts`                                                                                                      | Copy from v2, trim  | `useTemplates`, create, edit, replace file, delete, `templateFileUrl`, `LANGUAGES`             |
| `src/lib/companies.ts`                                                                                                      | Change              | send kind `companyFile`                                                                        |
| `src/components/ui/select.tsx`                                                                                              | Copy from v2        | language select (uses the installed `radix-ui`)                                                |
| `src/components/templates/template-list.tsx`, `template-dialog.tsx`, `delete-template-dialog.tsx`                           | Copy, trim / New    | list, dialog, delete confirm                                                                   |
| `src/app/(app)/settings/templates/page.tsx`                                                                                 | Change              | shows `TemplateList`                                                                           |

## Build steps

1. `src/types.ts`, `src/shared/template-body.ts`, `src/shared/placeholders.ts`, `src/shared/dto.ts`:
   - Plain `Template` interface; `TemplateLanguage = "hi" | "en"`; `UploadKind = "companyFile" | "template"`.
   - Bodies: language is `hi` or `en`; name trimmed, NFC, 1–200 characters.
   - `findPlaceholders`: find every `{{ … }}`, trim the inside, skip empty ones, keep each name once in the order first seen. Hindi names work too.
   - `toTemplate` maps the row; placeholders default to an empty list.
     Check: `pnpm typecheck`.
2. `src/server/schema.ts` → migration:
   - Add `template_language` and `template_status` enums and the `template` table as in "Database"; add the relation to `user`.
   - `pnpm db:generate --name templates`, `pnpm db:migrate`.
     Check: the migration has only the table, two enums and the index.
3. Uploads (`upload.service.ts`, `upload.repository.ts`, `blob-storage.ts`, `lib/file-upload.ts`, token route, company callers):
   - Copy v2's `UPLOAD_LIMITS` shape with the two kinds; `uploadKey`, `checkUploadPath` and `receiveUpload` take the kind.
   - The browser sends the kind with each Blob upload; the token route reads it and refuses an unknown kind.
   - Company code passes `companyFile`; nothing else about companies changes.
     Check: `pnpm test` and `pnpm test:integration` still pass for companies.
4. `src/repositories/template.repository.ts`:
   - Every query filters by user_id and status active; all take `db: Executor = defaultDb`.
   - Update returns the new row; lock reads the row `for update`; void sets status `void`.
     Check: used by the integration tests in step 9.
5. `src/services/template.service.ts`:
   - HTML check, in this order: name must end `.html`/`.htm` → "Upload the layout as an HTML file (.html)."; empty → "The HTML layout is empty."; over 2 MB → "An HTML layout must be at most 2 MB."; not valid UTF-8 → "Save the HTML layout as UTF-8 text.".
   - Read placeholders from the decoded text with `findPlaceholders`.
   - Create: check, insert with file and placeholders; on any error, discard the upload.
   - Replace file: confirm ownership, check, then in a transaction lock and update; delete the old stored file after; on error, discard the new one.
   - Open file: returns the HTML text. Missing or foreign → `notFound("Template not found.")`.
     Check: integration tests.
6. Routes `src/app/api/templates/**`:
   - Each handler: `handle` → `requireUserId` → `parseId` → service → JSON. Only HTTP handlers are exported.
   - File GET sends `text/html; charset=utf-8`, `Content-Security-Policy: sandbox`, `Cache-Control: private, no-store`, `nosniff`.
     Check: `pnpm route:map` lists the new routes.
7. `src/lib/templates.ts`:
   - Copy v2's file, drop rate basis and the PDF; keep `useTemplates` (react-query, key `["templates"]`), create, edit, replace file, delete, `templateFileUrl`, `languageLabel`.
     Check: `pnpm typecheck`.
8. `select.tsx`, the three components and the page:
   - `template-list.tsx`: like `company-list.tsx`; row as in "Screens" with the blue placeholder line (`text-xs text-blue-600`, dark `text-blue-400`).
   - `template-dialog.tsx`: Name, Language select, HTML file field (reuse `components/companies/file-field.tsx` with `accept=".html,.htm"`).
   - `delete-template-dialog.tsx`: same style as `delete-company-dialog.tsx`.
     Check: in the browser, every spec "Done when" line.
9. Tests (below). Then `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm test:integration`.

## New packages

None (`radix-ui`, `@vercel/blob`, `@tanstack/react-query` and `zod` are installed).

## Tests

- `tests/unit/placeholders.test.ts`: finds names in order; a repeated name (`work_name`) shows once; spaces inside `{{ }}` are trimmed; Hindi names work; no placeholders → empty list; `{{}}` is skipped.
- `tests/contract/template-body.test.ts`: name trimmed; empty or over 200 characters refused; language only `hi`/`en`.
- `tests/integration/templates.test.ts`: create, list, rename, change language, delete (void hides it); placeholders saved on create and updated on replace; open returns the HTML with the sandbox header; old stored file gone after replace; PDF, empty, over 2 MB and non-UTF-8 files refused with the right message; HTML with no placeholders accepted; needs sign-in (401).
- `tests/integration/isolation.test.ts`: another user's template and its file answer 404 on every route.
- `tests/unit/uploads.test.ts`: update for the upload kinds (html key for `template`, refusal of an unknown kind).

## Risks

- The upload change touches the company upload code. The company tests guard it in step 3.
- Blob upload runs only on Vercel; the local check covers the form path. The owner should try one upload on the deployed app.
- A placeholder written with odd spacing or line breaks inside `{{ }}` is still found, but if someone writes `{ {name} }` it isn't. Fine for now.
- What a tender does with a deleted template is left to Round 5.

## Done when

- [ ] Every "Done when" line from the spec works in the browser
- [ ] pnpm typecheck, lint, format:check, test and test:integration pass
- [ ] /check-feature 03 report is ✅ or ⚠️ with only small items
