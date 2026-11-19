# Plan 04: Fonts

Spec: .claude/specs/04-fonts.md · Status: approved, waiting for "go" · 2026-11-19

## In short

Each company gets one font, picked in the Add/Edit company dialog. The 10 fonts are a fixed list in one shared file (`src/shared/fonts.ts`). Their woff2 files come from Fontsource npm packages (the same way the Noto font comes in today) and are copied into `public/fonts/` on `pnpm install`, so they're served by our own app. One `<style>` block declares all 10 fonts (`@font-face`), and the browser only downloads a font file when some text on screen uses it. The company saves a `font_key`, and no key means Poppins.

## Spec problems

None.

## Database

- `company`: add `font_key` (text, can be empty). It's text rather than a fixed list in the database, so taking a font off the list later needs no migration; an unknown key is treated as "no font" (Poppins).
- Existing companies get an empty `font_key`, so they show Poppins (default).
- Migration: `pnpm db:generate --name company-font`, then `pnpm db:migrate`.

## API routes

Same routes as today; only the bodies grow. All need a signed-in user, and another user's id answers 404.

| Method | Path                  | What it does  | Sends                | Gets back                                |
| ------ | --------------------- | ------------- | -------------------- | ---------------------------------------- |
| POST   | `/api/companies`      | Create        | `{ name, fontKey? }` | `Company` (201), now with `fontKey`      |
| PATCH  | `/api/companies/[id]` | Rename / font | `{ name, fontKey? }` | `Company`                                |
| GET    | both list and one     | as today      | —                    | `Company` with `fontKey: string \| null` |

`fontKey`: one of the 10 keys, or `null` to remove it. If it's left out, the font stays as it is (Round 5 will need this). An unknown key answers 400 "Unknown font.".

## Screens

- **Company dialog**: a **Font** field under the name. It is a dropdown (the existing shadcn `Select`). The first option is "No font (Poppins)", then the 10 fonts in spec order. Each option shows the font name written in that font, plus "नमस्ते निविदा" in that font. The closed dropdown also shows the chosen font in its own style. Saving sends the name and font together; the success and error toasts work as today.
- **Company list row**: the summary line becomes e.g. "Letterhead · Seal · Mukta", or "… · Poppins (default)" when no font is set.
- Loading/empty/error states of the page don't change. While a font file is still downloading, the browser shows a system font (`font-display: swap`), then switches.

## Files

| File                                              | New / Change | What it does                                                                     |
| ------------------------------------------------- | ------------ | -------------------------------------------------------------------------------- |
| `package.json`                                    | Change       | add the 10 `@fontsource/*` packages                                              |
| `scripts/copy-reader-assets.mjs`                  | Change       | also copy the 10 fonts' woff2 files into `public/fonts/`                         |
| `src/shared/fonts.ts`                             | New          | the font list, the default, the lookup and the `@font-face` CSS builder          |
| `src/server/schema.ts`                            | Change       | `company.fontKey`                                                                |
| `drizzle/*`                                       | Generated    | migration `company-font`                                                         |
| `src/types.ts`                                    | Change       | `Company.fontKey: string \| null`                                                |
| `src/shared/company-body.ts`                      | Change       | `fontKey` optional, `null` or a known key                                        |
| `src/shared/dto.ts`                               | Change       | `toCompany` passes `fontKey` (an unknown key becomes `null`)                     |
| `src/repositories/company.repository.ts`          | Change       | insert with a font; `updateCompanyName` → `updateCompany` (name + optional font) |
| `src/services/company.service.ts`                 | Change       | `createCompany` / `renameCompany` → `updateCompany` take the font                |
| `src/app/api/companies/route.ts`, `[id]/route.ts` | Change       | pass `body.fontKey` on                                                           |
| `src/lib/companies.ts`                            | Change       | `saveCompanyName` → `saveCompany(id, { name, fontKey })`                         |
| `src/components/shell/font-faces.tsx`             | New          | renders the one `<style>` with all `@font-face` rules                            |
| `src/app/(app)/layout.tsx`                        | Change       | renders `<FontFaces />` once for every signed-in page                            |
| `src/components/companies/font-field.tsx`         | New          | the Font dropdown with the samples                                               |
| `src/components/companies/company-dialog.tsx`     | Change       | adds the Font field and sends the font on save                                   |
| `src/components/companies/company-list.tsx`       | Change       | shows the font name in the summary                                               |

## Build steps

1. **Packages** (`package.json`): add `@fontsource/{poppins,noto-serif-devanagari,mukta,khand,eczar,tiro-devanagari-hindi,yatra-one,anek-devanagari,laila,gotu}` at `5.3.0` and run `pnpm install`.
   Check: each package has `files/<id>-devanagari-400-normal.woff2`.
2. **Copy script** (`scripts/copy-reader-assets.mjs`):
   - Add a list of the 10 Fontsource ids, each with its weights: `[400, 700]`, or `[400]` for Yatra One, Gotu and Tiro Devanagari Hindi.
   - For each font, weight, and the `devanagari` and `latin` subsets, copy `<id>-<subset>-<weight>-normal.woff2` into `public/fonts/`. If a file is missing, fail loudly.
     Check: `pnpm install` leaves 34 new files in `public/fonts/`.
3. **Font list** (`src/shared/fonts.ts`):
   - `interface Font { key, label, family, weights }`. `FONTS` holds the 10 fonts in spec order, with the key the same as the Fontsource id (e.g. `poppins`).
   - `DEFAULT_FONT_KEY = "poppins"`, `FONT_KEYS`, `isFontKey(value)`.
   - `fontOf(key | null)` returns the matching font, or the first font if there's no key or the key is unknown.
   - `fontStack(font)` gives a CSS font stack: `"<family>", system-ui, sans-serif`.
   - `fontFaceCss(urlFor)` builds one `@font-face` rule per font × weight × subset, with `font-display: swap` and the Fontsource `unicode-range` for Devanagari and Latin, so only the needed files download.
     Check: unit test.
4. **Database** (`src/server/schema.ts`): add `fontKey: text("font_key")` to `company`. Run `pnpm db:generate --name company-font` and `pnpm db:migrate`.
   Check: the migration only adds one column that can be empty.
5. **Types and body** (`src/types.ts`, `src/shared/company-body.ts`):
   - Add `fontKey: string | null` to `Company`.
   - The body gets `fontKey` as optional and nullable, and it must pass `isFontKey`, else "Unknown font.".
     Check: contract test.
6. **DTO** (`src/shared/dto.ts`): `CompanyDbRow` gets `fontKey`, and `toCompany` sends `isFontKey(row.fontKey) ? row.fontKey : null`.
7. **Repository** (`company.repository.ts`):
   - `insertCompany(userId, name, fontKey, db)`.
   - Rename `updateCompanyName` to `updateCompany(userId, companyId, changes, db)`, where `changes` is `{ name, fontKey? }`. A `fontKey` left out isn't written.
8. **Service and routes**: `createCompany(userId, name, fontKey)` and `updateCompany(userId, companyId, changes)`, with the same 404 as today. Both routes pass `body.fontKey`.
   Check: integration tests.
9. **Browser helper** (`src/lib/companies.ts`): `saveCompany(companyId | null, { name, fontKey })` posts or patches both values.
10. **Font faces** (`font-faces.tsx`, `(app)/layout.tsx`): a small component that renders `<style>{fontFaceCss(file => "/fonts/" + file)}</style>`, placed once inside the app layout.
    Check: the network tab shows no font downloads on a page with no font text.
11. **Font field** (`font-field.tsx`): a `Select` with the value `"none"` or a font key. Each item has `style={{ fontFamily: fontStack(font) }}` and shows the label plus "नमस्ते निविदा". It takes `value`, `onChange` and `disabled`.
12. **Dialog and list** (`company-dialog.tsx`, `company-list.tsx`):
    - The dialog keeps `fontKey` in its state (it starts from `company?.fontKey ?? null`), shows `FontField` under the name and sends it through `saveCompany`.
    - `companySummary` adds `fontOf(fontKey).label`, plus " (default)" when `fontKey` is `null`.
      Check: by hand in the browser.
13. **Tests**: see below. Then run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm test:integration`.

## New packages

The owner's yes is needed. All are `@fontsource/*` at `5.3.0`, the same publisher and version as the `@fontsource/noto-sans-devanagari` we already use, and all are Open Font License:
`poppins`, `noto-serif-devanagari`, `mukta`, `khand`, `eczar`, `tiro-devanagari-hindi`, `yatra-one`, `anek-devanagari`, `laila`, `gotu`. Each package only gives us the font files; no code runs from them.

## Tests

- `tests/unit/fonts.test.ts`: 10 fonts in spec order, with Poppins first.
  - `fontOf(null)` and `fontOf("gone")` return Poppins.
  - Yatra One, Gotu and Tiro have only weight 400.
  - `fontFaceCss` has one rule per font × weight × subset, and every file it names exists in `public/fonts/`.
- `tests/contract/company-body.test.ts`: `fontKey` can be left out, can be `null`, or can be a known key.
  - `"comic-sans"`, `""` and `5` are rejected.
  - The old name tests still pass.
- `tests/integration/companies.test.ts`:
  - Create with Mukta, then PATCH to Laila, then PATCH `null`, then GET shows `null`.
  - PATCH with only a name keeps the font.
  - A company created without a font has `null`.
  - An unknown key answers 400.
  - Another user's PATCH with a font answers 404, and the font doesn't change.
- `tests/integration/company-edges.test.ts`: a row whose `font_key` was written straight into the database as an unknown key comes back as `null`.

## Risks

- **Size:** 34 woff2 files of about 30–150 KB each (around 3 MB) in `public/fonts/`. That's fine for Vercel, and each viewer downloads only what's on screen.
- **Faux bold** for Yatra One, Gotu and Tiro (agreed in the spec).
- **Fontsource file names:** if any package names its files differently, step 2 fails loudly at install and we fix the list.
- **Not in this round:** `next.config.ts` `outputFileTracingIncludes` still lists only Noto. Bundling the 10 fonts for the PDF belongs to Round 7.
- The app's own UI font (Inter + Noto Sans via `next/font`) doesn't change.

## Done when

- [ ] Every "Done when" line from the spec works in the browser
- [ ] pnpm typecheck, lint, format:check, test and test:integration pass
- [ ] /check-feature 04 report is ✅ or ⚠️ with only small items
