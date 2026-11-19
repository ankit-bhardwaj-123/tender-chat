# Plan 05: Editor (top bar, form and live preview)

Spec: .claude/specs/05-editor.md · Status: approved, waiting for "go" · 2026-11-19

## In short

The tender page `/t/[tenderId]` becomes the editor: a top bar (Type, Company, Template, Font), a placeholder form on the left and a live A4 preview on the right, with a draggable divider between them.

The preview is copied from v2 and trimmed:

- The filled template HTML sits in a sandboxed iframe (a page-inside-the-page where scripts can't run).
- The company's letterhead PDF is drawn under page 1 by `react-pdf`, and the seal image sits at a fixed spot bottom right.
- One `!important` font rule makes the company's font win over the template's own fonts.

The browser fetches the template HTML, letterhead and seal from routes we already have, so no new "preview parts" route is needed. The tender saves its type, company, template and typed values; the font saves on the company (Spec 04).

## Spec problems

- **"Flows onto page 2, 3…":** v2 doesn't cut the HTML into separate pages on screen. It shows one tall sheet with a dashed line every 297 mm, and Chrome does the real page cutting when it prints the PDF (Round 7). I suggest we do the same: a long template shows page 2 below a dashed line. Cutting the HTML into real separate sheets in the browser is much harder and can split a table row badly.

## Database

- `tender` gets four new columns:
  - `type`: an enum (fixed list) `quotation`, default `quotation`.
  - `company_id`: can be empty; points to `company` (cleared if the company row is deleted).
  - `template_id`: can be empty; points to `template` (cleared the same way).
  - `values`: jsonb (stored JSON), placeholder name → text, default `{}`.
- Existing tenders get Quotation, no company, no template and no values.
- Migration: `pnpm db:generate --name tender-editor`, then `pnpm db:migrate`.

## API routes

All need a signed-in user. Another user's tender answers 404.

| Method | Path                  | What it does                                                                             | Sends                                         | Gets back      |
| ------ | --------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------- | -------------- |
| POST   | `/api/tenders`        | Create; the server picks the first active company and template (or none)                 | `{ name }`                                    | `Tender` (201) |
| GET    | `/api/tenders/[id]`   | Read                                                                                     | —                                             | `Tender`       |
| PATCH  | `/api/tenders/[id]`   | Change any of these; fields left out stay as they are (the sidebar rename keeps working) | `{ name?, companyId?, templateId?, values? }` | `Tender`       |
| PATCH  | `/api/companies/[id]` | Already exists; the editor's Font dropdown sends `{ name, fontKey }`                     | —                                             | `Company`      |

`Tender` = `{ id, name, type, companyId, templateId, values, createdAt, updatedAt }`.

- A `companyId` or `templateId` that isn't the user's own active one answers 404 "Company not found." / "Template not found.". `null` clears it.
- Template HTML, the letterhead and the seal come from `GET /api/templates/[id]/file` and `GET /api/companies/[id]/files/{letterhead,seal}`, which already exist.

## Screens

- **Editor page:**
  - **Loading:** skeletons for the top bar, the form and the page.
  - **Not found:** "Tender not found" + "Go to the start page". **Other error:** "Couldn't load the tender." + Try again (as today's `tender-page.tsx`).
- **Top bar** (`border-b px-4 py-2`, `h-8` selects):
  - **Type:** Quotation, with Notesheet disabled ("coming soon").
  - **Company:** the user's companies. With none, an "Add company" link to `/settings/companies`. A deleted company shows "Pick a company".
  - **Template:** the same, with "Add template" and "Pick a template".
  - **Font:** the 10 fonts, each written in its own font. It shows `fontOf(company.fontKey)` and is disabled without a company.
  - **Save** button on the right: "Saving…" while busy. It's disabled when nothing has changed.
- **Form** (left, scrolls): one auto-growing textarea per placeholder, in template order, labelled with the placeholder name and `lang="hi"`.
  - **Empty** (the template has no placeholders): "This template has no blanks.".
  - **No template:** "Pick a template to see its blanks.".
- **Preview** (right):
  - **Header:** −, NN %, +, "Fit width".
  - **Body:** a grey scroll area with the scaled A4 sheet. Layers: letterhead (page 1), dashed page lines, the iframe, the seal.
  - **Template file fails to load:** "Couldn't load the template." + Retry inside the sheet.
  - **Letterhead fails to load:** a small note "Couldn't load the letterhead." + Retry.
  - **No template:** an empty sheet with an "Add template" link.
- **Change-template dialog:** the existing `AlertDialog`, "Change template? Values for blanks the new template doesn't have will be removed." with Cancel / Change.
- **Narrow screens** (under 768 px): the form, then the preview, stacked; no divider.

## Files

| File                                            | New / Copy / Change                   | What it does                                                                                                                                      |
| ----------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/fill-template.ts`                   | New (from v2 `fillLayout`)            | `escapeHtml`, `fillTemplate(html, values, options)`, `fontOverrideCss(fontStack, fontFaceCss)`                                                    |
| `src/shared/tender-body.ts`                     | Change                                | `UpdateTenderBody` (all optional) replaces `RenameTenderBody`                                                                                     |
| `src/types.ts`, `src/shared/dto.ts`             | Change                                | wider `Tender` and `toTender`                                                                                                                     |
| `src/server/schema.ts`, `drizzle/*`             | Change, Generated                     | the four `tender` columns, `tender_type` enum                                                                                                     |
| `src/repositories/tender.repository.ts`         | Change                                | `createTender` with company/template; `updateTenderName` → `updateTender(changes)`                                                                |
| `src/services/tender.service.ts`                | Change                                | first company/template on create; ownership checks on change; `updateTender`                                                                      |
| `src/app/api/tenders/route.ts`, `[id]/route.ts` | Change                                | pass the new body on                                                                                                                              |
| `src/lib/editor.ts`                             | New (from v2 `lib/quotation.ts`)      | `useTender`, `saveTender`, `useTemplateHtml`, zoom (`ZOOM_STEPS`, `nextZoom`, `fitWidthScale`, `usePreviewZoom`), `A4` px constants, `keptValues` |
| `src/components/ui/textarea.tsx`                | Copy from v2                          | the shadcn textarea                                                                                                                               |
| `src/components/editor/editor-page.tsx`         | New                                   | loads tender/companies/templates; holds the draft values; Save; leave guard; the split                                                            |
| `src/components/editor/editor-top-bar.tsx`      | New                                   | the four dropdowns, Save, change-template dialog                                                                                                  |
| `src/components/editor/placeholder-form.tsx`    | New                                   | the textareas                                                                                                                                     |
| `src/components/editor/page-preview.tsx`        | New (from v2 `quotation-preview.tsx`) | zoom header, scaled sheet, iframe, in-place value patching, seal, page lines                                                                      |
| `src/components/editor/letterhead-page.tsx`     | Copy from v2                          | `react-pdf` page 1, loaded with `next/dynamic` `ssr:false`                                                                                        |
| `src/app/(app)/t/[tenderId]/page.tsx`           | Change                                | renders `EditorPage`                                                                                                                              |
| `src/components/shell/tender-page.tsx`          | Remove                                | replaced by `editor-page.tsx`                                                                                                                     |

## Build steps

1. **`src/shared/fill-template.ts`:**
   - `escapeHtml` is copied from v2 `shared/quotation-layout.ts:94`.
   - `fillTemplate(html, values, { mark, fontCss })`:
     - Removes `<script>…</script>` and `on…=` attributes.
     - Finds blanks with the same pattern and name clean-up as `findPlaceholders` (`src/shared/placeholders.ts`), so Hindi names with spaces match.
     - Text is escaped, and line breaks become `<br>`.
     - With `mark`, a blank in body text becomes `<span data-field="name">value</span>`. An empty value becomes a light grey box holding the name. Blanks inside tag attributes get the plain escaped value.
     - Puts `fontCss` in a `<style>` at the start of `<head>` (or adds a head if there is none).
   - `fontOverrideCss(stack, faces)` returns the `@font-face` rules plus `html, body, body * { font-family: <stack> !important; }`.
   - Check: unit tests.
2. **Types and body:**
   - `Tender` gets `type`, `companyId`, `templateId` and `values` (`Record<string, string>`).
   - `UpdateTenderBody` holds:
     - `name?` (string)
     - `companyId?` / `templateId?` (uuid or null)
     - `values?` (record of strings)
   - `toTender` maps the new columns, and `values` defaults to `{}`.
3. **Database:** add the columns in `schema.ts`, then run `pnpm db:generate --name tender-editor` and `pnpm db:migrate`.
   Check: the SQL only adds 4 columns and 1 enum.
4. **Repository:**
   - `createTender(userId, { name, companyId, templateId })`.
   - `updateTender(userId, tenderId, changes)` writes only the fields given, plus `updatedAt`.
5. **Service** (`tender.service.ts`):
   - **`createTenderItem`:** `findCompaniesByUser(userId)[0]` and `findTemplatesByUser(userId)[0]` pick the first of each (the same order as the dropdowns).
   - **`updateTender`:**
     - Cleans the name as today.
     - A given `companyId` must pass `findCompanyById(userId, id)`, else 404 "Company not found.". The same goes for `templateId` with the template repository.
     - Values are NFC-normalised, and keys that are empty after trimming are dropped.
     - Then `updateTender` in the repository; no row means 404.
   - `renameTender` is folded into `updateTender`.
6. **Routes:** POST stays `{ name }`. PATCH reads `UpdateTenderBody` and calls `updateTender`.
   Check: the integration tests, plus the sidebar rename still works.
7. **`src/lib/editor.ts`:**
   - **Tender:** `useTender(id)` (key `["tender", id]`, 404 → "not_found", as `tender-page.tsx` does). `saveTender(id, changes)` does a PATCH and then `setQueryData`.
   - **Template HTML:** `useTemplateHtml(template)` (key `["template-html", id, updatedAt]`) fetches the text of the template file.
   - **Zoom:** `ZOOM_STEPS`, `nextZoom` and `usePreviewZoom` are copied from v2 `lib/quotation.ts:33-38, 291-331`. `fitWidthScale(boxWidth)` is `(boxWidth − 32) / 794`.
   - **Sizes:** `A4_WIDTH_PX = 794`, `A4_HEIGHT_PX = 1123`.
   - **`keptValues(values, placeholders)`:** keeps only the names the new template has.
8. **`letterhead-page.tsx`:** copy v2's file (react-pdf `Document` + `Page` 1 at 794 px, no text or annotation layers). Add `onLoadError` to show the "Couldn't load the letterhead." note.
9. **`page-preview.tsx`** (props: `html`, `values`, `fontKey`, `letterheadUrl`, `sealUrl`, `htmlError`, `onRetry`):
   - **Building the page:** `fillTemplate(html, values, { mark: true, fontCss })` goes into `<iframe sandbox="allow-same-origin" srcDoc=…>`. It is rebuilt only when the template or the font changes.
   - **While typing:** an effect sets each `[data-field]` span's content from `values`, so the iframe isn't reloaded (v2 `quotation-preview.tsx:177-192`, without the caret skip, because editing on the page is Round 6).
   - **Size:** after load, it measures `scrollHeight`, then `pages = ceil(height / 1123)`. The sheet is `pages × 1123` px tall, with dashed lines at each 1123 px.
   - **Seal:** an `<img>` at about 25 mm from the right and bottom of page 1, 35 mm wide.
   - **Zoom:** the sheet is scaled with `transform: scale()`, and the header has −/+/Fit (v2 `:414-422`).
10. **`placeholder-form.tsx`:** for each placeholder, a `Field` + `FieldLabel` + `Textarea` with `field-sizing: content`, `onChange(name, text)`.
11. **`editor-top-bar.tsx`:**
    - Four `Select`s. Type is Quotation, with Notesheet disabled.
    - **Company change:** `saveTender({ companyId })`.
    - **Template change:** confirm, then `saveTender({ templateId, values: keptValues(draft, newTemplate.placeholders) })`.
    - **Font change:** `saveCompany(company.id, { name: company.name, fontKey })`, then refresh `COMPANIES_KEY`.
    - **Save** button: `saveTender({ values: draft })`, then toast "Saved.". On error, toast "Something went wrong, please try again.".
12. **`editor-page.tsx`:**
    - **Data:** `useTender`, `useCompanies` and `useTemplates`. The chosen company and template are looked up by id among the active ones; if missing, they are `null` and the dropdown shows "Pick a …".
    - **Draft:** the draft values come from `tender.values`, keyed by `tender.updatedAt`, so a reload or a template change resets them. "Dirty" means the draft differs from the saved values.
    - **Leave guard:** `beforeunload` while dirty, plus a confirm on sidebar navigation using the existing shell `onNavigate` if possible (see Risks).
    - **Layout:** a desktop `ResizablePanelGroup` (form 25–70 %, saved in localStorage `tender-chat:editor-split`), stacked on mobile.
    - Mount it from `t/[tenderId]/page.tsx`, and delete `tender-page.tsx`.
13. **Tests and checks:** see below, then run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm test:integration`.

## New packages

None. `react-pdf` 11 and `pdfjs-dist` 6.3.289 are already installed, and the CSP already allows the pdf.js worker (`worker-src 'self' blob:`).

## Tests

- **`tests/unit/fill-template.test.ts`:**
  - Fills and escapes values, including `<script>` as text.
  - Line breaks become `<br>`.
  - Hindi and spaced names match `findPlaceholders`.
  - An empty blank shows the grey name box only with `mark`.
  - A blank inside an attribute isn't wrapped.
  - Scripts and `onclick` are removed.
  - The font override is the first thing in `<head>`, and HTML without `<head>` still works.
- **`tests/unit/editor.test.ts`:** `keptValues`, `nextZoom` at each end, `fitWidthScale`.
- **`tests/contract/tender-body.test.ts`:** `UpdateTenderBody` takes any subset. It refuses a non-uuid company and non-string values.
- **`tests/integration/tender-editor.test.ts`:**
  - Create picks the first company and template; with neither, both are `null`.
  - PATCH values, then GET returns them.
  - PATCH with only a name keeps everything else.
  - Another user's company or template, or a voided one, answers 404 and nothing changes.
  - `null` clears.
  - Another user's tender answers 404 on GET and PATCH.

## Risks

- **Sidebar navigation guard:** Next's app router has no built-in "leave page?" hook. `beforeunload` covers reload and close. For clicking another tender in the sidebar, we'd need a confirm in the shell's link handler. If that touches too much shell code, I'll stop and show you first.
- **Template CSS** that sets `html`/`body` sizes or backgrounds could hide the letterhead. As in v2, we force `html { width: 210mm; background: transparent }`.
- **Font change re-renders the iframe.** That is fine, because only the font changes, and typed values are re-filled from the draft.
- **Large `values`:** there's no size cap, since you didn't ask for one. The existing request-size limit still applies.

## Done when

- [ ] Every "Done when" line from the spec works in the browser
- [ ] pnpm typecheck, lint, format:check, test and test:integration pass
- [ ] /check-feature 05 report is ✅ or ⚠️ with only small items
