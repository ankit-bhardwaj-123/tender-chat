# Project plan: Tender quotation editor

Status: agreed scope as of 2026-11-18. Nothing is built yet. This file says **what** we build and **how**, using `../tender-chat-v2` as the source we copy from. Each major feature is then built spec-driven (section 11).

## 1. What the app is

A contractor signs in with Google and sees only their own tenders. A tender is a **name plus one editor screen**: choose type, company, template and font at the top, fill the placeholder form on the left, see and edit a live A4 preview on the right, and download a PDF.

Built now: **Quotation, Hindi, PDF preview and PDF download.**
Later: Notesheet (Word preview and Word download), signature image.

## 2. Scope

| Now                                                              | Later                                 |
| ---------------------------------------------------------------- | ------------------------------------- |
| Google sign-in, tenders separated per user                       | Email/password, email sending         |
| Sidebar: search, new tender, tender list, user menu              | —                                     |
| Companies: name, letterhead (PDF), seal (JPG), default font      | Signature image, more company details |
| Templates page: each user uploads HTML templates (Hindi/English) | Notesheet templates                   |
| Font dropdown (10 fonts); a change saves to the company          | —                                     |
| Placeholder form from the chosen template                        | —                                     |
| Live preview: zoom, add text/image, edit or remove anything      | —                                     |
| PDF download                                                     | Word preview and download (Notesheet) |

Not in this project: tender document upload, PDF/Word reading, OCR, auto-fill, rate table, steps bar, template PDF, AI.

## 3. Screen

```
┌ Sidebar ─────────┬ [Type ▼] [Company ▼] [Template ▼] [Font ▼] ─────────────────┐
│ Search tenders   │ LEFT: placeholder form       │ RIGHT: live A4 preview    │
│ + New tender     │ fields of the chosen template  │ letterhead + seal +       │
│ Tender A         │ (one box per placeholder)    │ filled template + blocks    │
│ Tender B         │                              │ zoom · fit · add text ·   │
│ ...              │                              │ add image · edit/remove   │
│ User ▾ Profile · │                              │ any text or image         │
│ Companies ·      │ [Save]        [Download PDF] │                           │
│ Sign out         │                              │                           │
└──────────────────┴──────────────────────────────┴───────────────────────────┘
```

### Top bar, in this order

| #   | Dropdown | Options                                             | Default            |
| --- | -------- | --------------------------------------------------- | ------------------ |
| 1   | Type     | Quotation; Notesheet shown disabled ("coming soon") | Quotation          |
| 2   | Company  | The user's active companies                         | First company      |
| 3   | Template | The user's active templates                         | First template     |
| 4   | Font     | 10 fonts                                            | The company's font |

Options 2–4 depend on the type. When Notesheet arrives, they switch to notesheet companies, templates and fonts.

Font is the last dropdown. It shows the **selected company's font**, not the first font in the list. Picking another font there saves it as that company's font straight away.

## 4. Key decisions

1. **Templates are HTML, output is PDF.** Each template is an HTML file (Hindi or English) with `{{placeholders}}`. The browser fills it for the preview, and the server prints the same HTML to PDF with Chrome (as v2 does). Because the preview is HTML, every word and image can be edited, and one font setting can restyle the whole page.
2. **Templates are uploaded by each user** on a Templates page (user menu), like companies and like v2's Templates page: a name, a language (Hindi or English) and one HTML file. No template PDF, no rate basis. Another user's template answers 404. A tender stores the template's id.
3. **Placeholders are read from the HTML.** There is no field list file. Each template can have any number of placeholders (or none), and the left form gets one box per placeholder, named after it.
4. **Everything on the page is editable or removable except the letterhead**, whether it comes from the template, a placeholder value, or the company:
   - Template text and images: edited in place (`contenteditable`). The edits are saved as the tender's own copy of the HTML, and the original template never changes. A "Reset template text" button discards them.
   - Placeholder values: typed in the form or straight in the preview, and the two stay in sync (v2's `[data-field]`).
   - Seal (JPG): a canvas block. It can be moved, resized or removed, and added back with "Add seal".
   - Letterhead (PDF): always shown under page 1 and always printed in the PDF (decided 2026-11-20). It can't be turned off, covered or retyped; to change it, the user uploads a new letterhead on the Companies page. A font change doesn't reach the letterhead.
   - Added text and images: canvas blocks, as in v2.
5. **Fonts are embedded.** All 10 are Unicode fonts that support Devanagari, served as woff2 from the app and included in the Vercel build, so the preview and the PDF look the same. Kruti Dev / DevLys can't be used because they are not Unicode. A font loads only when it is chosen.
6. **The font belongs to the company, not the tender.** Each company has one font, set on the company form (Companies page) and changed or removed there. Removing it means "no font chosen", so the first font in the list is used. Changing the font in the editor's top bar saves it to the company as well, so every tender of that company, and its PDF, uses the new font. A tender does not store a font of its own.
7. **Ownership:** every query is filtered by the signed-in user, and another user's tender or company answers **404**, never 403 (v2's `server/ownership.ts`).

## 5. Rules for switching and defaults

- **New tender:** Quotation, the first company and the first template are picked and saved straight away. The font is the company's font (the first font in the list if the company has none).
- **No company yet:** the preview has no letterhead or seal and uses the first font, the Font dropdown is disabled (there's no company to save the font to), and the top bar offers "Add company".
- **Changing the company:** swaps the letterhead, seal and font (to the new company's font) and keeps everything else. A seal the user removed stays removed.
- **Changing the template:** asks first, then discards the edited template text. Values whose key exists in the new template are kept.
- **Changing the font:** changes the font only, and saves it straight away as the company's font (for all of that company's tenders).
- **Saving:** a Save button, plus a save on download. Changes are kept in the database, never only in the browser.

## 6. Data model (draft; the specs make it final)

- **Better Auth:** `user`, `session`, `account`, `verification`, copied unchanged.
- **`company`:** id, user_id, name, font_key (nullable; null means the first font), status `active | void`, timestamps. Delete means void.
- **`company_file`:** company_id, kind `letterhead | seal`, file key, file name, size. Primary key (company_id, kind). Letterhead must be a PDF; seal must be a JPG, checked by its file signature.
- **`tender`:**
  - id, user_id, name, status
  - type `quotation`
  - company_id (nullable)
  - template_id (nullable)
  - values (jsonb: key → text)
  - canvas (jsonb: blocks, including the seal block)
  - custom_html (nullable)
  - timestamps
- **`template`:** id, user_id, name, language `hi | en`, status `active | void`, HTML file key, file name, size, timestamps. Delete means void.
- **`tender_image`:** id, tender_id, file key, for images added on the canvas.

Fonts are code files, not a table.

## 7. Routes (draft)

| Route                                                                                                                | Purpose                                               |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `/login`                                                                                                             | Continue with Google                                  |
| `/`                                                                                                                  | Home: empty state + "New tender"                      |
| `/t/[tenderId]`                                                                                                      | The editor screen                                     |
| `/settings/profile`, `/settings/companies`                                                                           | User menu pages                                       |
| `GET/POST /api/tenders`, `GET/PATCH/DELETE /api/tenders/[id]`                                                        | Tender list (with search), create, read, save, delete |
| `GET/POST /api/companies`, `GET/PATCH/DELETE /api/companies/[id]`, `PUT/GET/DELETE /api/companies/[id]/files/[kind]` | Companies, letterhead, seal                           |
| `GET/POST /api/templates`, `GET/PATCH/DELETE /api/templates/[id]`, `GET/PUT /api/templates/[id]/file`                | Templates and their HTML file                         |
| `POST/GET/DELETE /api/tenders/[id]/images[/imageId]`                                                                 | Canvas images                                         |
| `GET /api/tenders/[id]/preview-parts`                                                                                | Letterhead page + seal for the preview                |
| `POST /api/tenders/[id]/pdf`                                                                                         | Print and download the PDF                            |

## 8. Folder layout (Next.js `src/` layout, flat inside)

v2's root folders move under `src/`. A v2 path `services/x.ts` becomes `src/services/x.ts`, and `@/*` points to `src/*`.

```
src/app/            (auth)/login, (app)/page, (app)/t/[tenderId], (app)/settings/*, api/**
src/components/     shell/, companies/, editor/, ui/
src/lib/            browser helpers and hooks (auth, companies, tenders, editor, zoom)
src/services/       tender, company, template, image, preview, pdf
src/repositories/   tender, company, upload
src/server/         schema, auth, env, http, errors, ownership, file-type, adapters/
src/shared/         dto, fill-template, canvas, fonts, zod bodies
drizzle/            migrations (generated)
public/fonts/       woff2 files (copied at install)
scripts/            route-map, copy-reader-assets
tests/              unit/, integration/, contract/
```

Database: Neon Postgres. The owner gives `DATABASE_URL` in `.env.local`; there is no Docker.

## 9. Reuse map from `../tender-chat-v2`

Copy the file, then trim it to the scope above. Never edit v2 itself.

| Area        | Copy from v2                                                                                                                                                                                                                                   | Change                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Config      | `package.json`, `tsconfig.json`, `eslint.config.mjs`, `prettier.config.mjs`, `.editorconfig`, `.gitignore`, `.prettierignore`, `components.json`, `next.config.ts`, `drizzle.config.ts`, `vitest*.mts`, `playwright.config.ts`, `.env.example` | Drop the reader/OCR/docx/tesseract packages and their asset copying; new project name       |
| Auth        | `server/auth.ts`, `server/session.ts`, `lib/auth.ts`, `app/api/auth/[...all]`, `app/(auth)/login`, `components/auth/*` (login only), `components/auth/require-session.tsx`                                                                     | Google only; drop signup/forgot/reset/verify pages                                          |
| Server core | `server/env.ts`, `http.ts`, `errors.ts`, `ownership.ts`, `logger.ts`, `report-error.ts`, `file-type.ts`, `adapters/*` (storage, postgres, pdf-printer, print-font)                                                                             | Drop `local-file-lister.ts`; the font comes from the company                                |
| Schema      | `server/schema.ts`                                                                                                                                                                                                                             | Keep the auth tables, company, company_file; new `tender`, `tender_image`; fresh migrations |
| Shell       | `components/shell/*`, `app/(app)/layout.tsx`, `lib/shell-layout.ts`, `components/ui/*`                                                                                                                                                         | Add tender search; drop the steps bar                                                       |
| Companies   | `services/company.service.ts`, `repositories/company.repository.ts`, `app/api/companies/**`, `components/companies/*`, `lib/companies.ts`, `shared/company-body.ts`                                                                            | Only name + letterhead (PDF) + seal (JPG)                                                   |
| Uploads     | `services/upload.service.ts`, `repositories/upload.repository.ts`, `lib/file-upload.ts`, `app/api/uploads/token`                                                                                                                               | none                                                                                        |
| Preview     | `components/tender/quotation-preview.tsx`, `quotation-canvas.tsx`, `letterhead-page.tsx`, `lib/quotation.ts` (zoom, mm maths), `shared/quotation-canvas.ts`, `shared/quotation-layout.ts` (`fillLayout`, `escapeHtml`)                         | Rename to `editor`; add the font setting and seal block; drop the rate table                |
| Templates   | `services/template.service.ts`, `repositories/template.repository.ts`, `app/api/templates/**`, `components/templates/*`, `lib/templates.ts`, `shared/template-body.ts`, `app/(app)/settings/templates/page.tsx`                                | Only name + language + HTML; drop the PDF, rate basis and the `{{rate_table}}` check        |
| Images      | `services/quotation-image.service.ts`, `app/api/tenders/[id]/quotation/images/**`                                                                                                                                                              | Move to `/api/tenders/[id]/images`                                                          |
| PDF         | `services/quotation-pdf.service.ts`, `services/quotation-preview.service.ts`, `server/adapters/pdf-printer.ts`, `outputFileTracingIncludes` in `next.config.ts`                                                                                | Use the company's font instead of the forced Noto (v2 ADR-14)                               |
| Tooling     | `scripts/route-map/*`, `.claude/commands/{spec-create,plan-create,execute-plan,git-push}.md`                                                                                                                                                   | Point them at this project                                                                  |
| Tests       | `tests/integration/global-setup.ts`, `users.ts`, `isolation.test.ts`, `companies.test.ts`, `tests/fakes/*`, the relevant unit tests                                                                                                            | Trim to what's copied                                                                       |

**Don't copy:** `lib/reader/*`, `components/viewer/*`, `components/documents/*`, `shared/{cfb,word97,kruti-dev,legacy-fonts,text-quality,tender-autofill,document-pages,page-ranges,quotation-math}.ts`, `services/{document,template-layout}.service.ts`, the steps components, `mock/`, and v2's `drizzle/` migrations.

## 10. Build order (each round = one major feature, built spec-driven)

| Round | Feature                                         | Done when                                                                                                                                                                            |
| ----- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | **Project and repo setup** (next step, no spec) | Copied config, `pnpm install`, Neon `DATABASE_URL` in `.env.local`, `src/` layout, `pnpm dev` shows a blank page, typecheck/lint/test pass; git and CI are set up later by the owner |
| 1     | **Auth + shell**                                | Google sign-in; sidebar with search, new tender, rename/delete; user menu; tenders separated per user (404 test)                                                                     |
| 2     | **Companies**                                   | Companies page: add/edit/remove, letterhead PDF, seal JPG                                                                                                                            |
| 3     | **Templates**                                   | Templates page: add/edit/remove, name, language, HTML file; placeholder names shown per template                                                                                     |
| 4     | **Fonts**                                       | Font registry with the 10 fonts (section 12); `company.font_key`; a font picker on the company form (choose, change, remove) with a sample of each font                              |
| 5     | **Editor: top bar + form + live preview**       | The four dropdowns with defaults (Font = the company's font, and a change saves to the company); form from the placeholders; live filled preview over the letterhead; zoom; save     |
| 6     | **Editor: full editing**                        | Edit/remove template text and images in place, seal block, add text/image, reset template text                                                                                       |
| 7     | **PDF download**                                | Same look as the preview, the company's font embedded, works locally and on Vercel                                                                                                   |
| Later | Notesheet (Word), signature, English            | —                                                                                                                                                                                    |

## 11. How we work (rules carried over from v2)

- **Spec-driven for every major feature:**
  1. `/spec-create` writes `.claude/specs/NN-<slug>.md` (what and why).
  2. `/plan-create` writes `.claude/plans/NN-<slug>.md` (how, with pseudo-code).
  3. On "go", write the code and run the checks.
- **Progress is tracked by the owner by hand.** There is no `specs/` folder (raw.md, design.md, tasks.json) and no spec tracker; never create them.
- **The spec is the contract.** If the plan turns out wrong while coding, stop, show the change, and wait for a yes.
- **Small changes need no spec:** a CHANGELOG entry.
- **Code style:** function-based code, no classes except `extends Error`. Route → service → repository; repositories take `db: Executor = defaultDb`.
- **Comments and types:** no comments in code; plain written-out `interface` types.
- **Frontend limits:** import chain ≤ 3 of our own files, hooks ≤ 2 deep, components ≤ 3 deep, flat folders.
- **No field validation the owner didn't ask for.**
- **CHANGELOG:** an entry with every change (a dated bullet under `## [Unreleased]`, grouped Added / Changed / Fixed / Removed).
- **Project skill:** a `.claude/skills/<feature>/SKILL.md` only once a feature is finished.
- **Git and v2:** commit or push only when the owner asks; never edit `../tender-chat-v2`.

## 12. Open items

- **Fonts (decided 2026-11-19):** the 10 fonts, in dropdown order (all Google Fonts with Devanagari, Open Font License). The first one is the default:
  1. Poppins
  2. Noto Serif Devanagari
  3. Mukta
  4. Khand
  5. Eczar
  6. Tiro Devanagari Hindi
  7. Yatra One
  8. Anek Devanagari
  9. Laila
  10. Gotu

  Yatra One, Gotu and Tiro Devanagari Hindi come in one weight only, so bold text in them is drawn by the browser (faux bold). Which weights we ship for the others gets decided in the Round 4 spec.

- **Templates (decided 2026-11-18, Spec 03):** HTML only, uploaded by each user; a PDF of the original is at most a picture to compare against and is never stored. No ready-made sample templates; the owner uploads them later.
- **Product name and repo name** are to be decided in Round 0.
- **Letterhead (decided 2026-11-20):** required for now. No on/off switch and no cover boxes; a wrong letterhead is fixed by uploading a new one on the Companies page.
