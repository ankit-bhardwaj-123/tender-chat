---
name: tender-chat
description: Use for any work in tender-chat (the tender quotation editor) - what the app is, simple words for its parts, what is built and what is next, folders, owner rules, the spec → plan → build → check workflow, and where to copy from tender-chat-v2.
---

# tender-chat: the whole project in simple words

## What the app is

A contractor makes a **quotation** (a price letter sent for a government tender) in Hindi and downloads it as a PDF.

1. They sign in with Google and see only their own tenders.
2. They create a **tender**: just a name plus one editor screen.
3. In the editor's top bar they pick, in order:
   - **Type**: Quotation (Notesheet comes later, as Word)
   - **Company**: a name, a letterhead PDF and a seal JPG
   - **Layout**: one of 4–5 ready Hindi letter designs
   - **Font**: one of 10 Hindi fonts

   The first option of each is picked automatically.

4. The left side is a **form** with one box per **placeholder** (a `{{name}}` blank in the layout). The right side is a **live preview** of the A4 page that updates as they type.
5. In the preview they can zoom, add text and images, and edit or remove anything: layout text, values, the seal, or the letterhead (turn it off or cover parts of it).
6. They click **Download PDF**.

## Words we use

| Word         | Meaning                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tender       | One job the contractor quotes for. A name plus its saved editor state.                                                                           |
| Company      | A contractor's firm: name, letterhead (PDF), seal (JPG).                                                                                         |
| Layout       | A built-in Hindi HTML letter with `{{placeholders}}`, plus its field list (key, Hindi label, type). The same for all users; lives in `layouts/`. |
| Placeholder  | A blank like `{{officer_name}}` that the form fills.                                                                                             |
| Canvas block | Something placed on top of the page: text, image, the seal, or a cover box. Positions are in mm.                                                 |
| Custom HTML  | The tender's own edited copy of the layout text. The original layout never changes.                                                              |

## Status (update this after every feature)

| Round | Feature                                                                                           | Status          |
| ----- | ------------------------------------------------------------------------------------------------- | --------------- |
| 0     | Project setup (copied from v2, `src/` layout, Neon, GitHub repo `ankit-bhardwaj-123/tender-chat`) | done 2026-11-18 |
| 1     | Auth (Google sign-in) + sidebar shell                                                             | next            |
| 2     | Companies (name, letterhead, seal)                                                                | —               |
| 3     | Layouts + fonts list (the owner provides them)                                                    | —               |
| 4     | Editor: top bar, form, live preview, zoom, save                                                   | —               |
| 5     | Editor: full editing (edit/remove anything, seal, cover box)                                      | —               |
| 6     | PDF download                                                                                      | —               |
| Later | Notesheet (Word), signature, English                                                              | —               |

What exists now: config, packages, `src/app/layout.tsx`, a placeholder `src/app/page.tsx`, `src/components/ui/{sonner,tooltip}.tsx` and `src/lib/utils.ts`. There is no database schema, API or auth yet.

## Folders

- `src/app`: pages and `api/**/route.ts`
- `src/components`: `shell/`, `companies/`, `editor/`, `ui/`
- `src/lib`: browser helpers and hooks
- `src/services`: business rules
- `src/repositories`: database queries
- `src/server`: schema, auth, http helpers and adapters
- `src/shared`: code used by both the browser and the server
- At the root: `layouts/`, `drizzle/` (migrations), `public/`, `scripts/` (route-map, copy-reader-assets), `tests/` (unit, integration, contract)
- `@/*` points to `src/*`.

## How a request flows

browser (`src/lib` fetch) → `route.ts` (reads the request) → `*.service.ts` (rules, ownership) → `*.repository.ts` (Drizzle SQL) → Neon Postgres. Files go to local `storage/` or private Vercel Blob. PDFs are printed by Chrome (playwright-core locally, `@sparticuz/chromium` on Vercel) and pdf-lib.

## Owner rules (short version; full list in `CLAUDE.md`)

- **Process:** plan first and wait for "go"; build one simple piece first and improve it in rounds.
- **Style:** no code comments, plain `interface` types, function-based code (no classes).
- **Frontend limits:** our own imports ≤ 3 deep, hooks ≤ 2 deep, components ≤ 3 deep, flat folders.
- **Data:** another user's data answers 404; no validation or new packages the owner didn't ask for.
- **Every change:** a CHANGELOG entry.
- **Never** commit unasked, edit `../tender-chat-v2`, or create a `specs/` folder (the owner tracks progress by hand).

## Workflow for a major feature

1. `/spec-create <name>`: a short spec in simple words (`.claude/specs/NN-slug.md`).
2. `/plan-create <NN>`: a short plan: files, order, plain-English steps (`.claude/plans/NN-slug.md`).
3. The owner says "go" → `/execute-plan <NN>`, or build one step at a time.
4. `/check-feature <NN>`: the `feature-checker` agent tests and reviews the work and saves `.claude/reports/…`.
5. Update the Status table above.

Small changes (wording, one bug) skip steps 1–2 and need only a CHANGELOG entry.

## Copying from v2

`../tender-chat-v2` already has working auth, shell, companies, preview/canvas/zoom and PDF printing. `PROJECT-PLAN.md` section 9 lists which files to copy and how to trim each. A v2 path `services/x.ts` becomes `src/services/x.ts` here. Read v2, never edit it.

## Commands

```sh
pnpm dev                                          # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm format:check
pnpm test                                         # unit + contract
pnpm test:integration                             # database tender_chat_test (needs .env.local)
pnpm db:generate --name x && pnpm db:migrate      # after a schema change
pnpm route:map                                    # route-map.html
```

`.env.local` (written by the owner; never read it) holds `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_FILE_STORE` and `BLOB_READ_WRITE_TOKEN`.
