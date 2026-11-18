@AGENTS.md

# Tender quotation editor (tender-chat)

A contractor signs in with Google and sees only their own tenders. A tender is a name plus one editor screen: the top bar picks Type (Quotation; Notesheet later) → Company (letterhead PDF + seal JPG) → Template (HTML with `{{placeholders}}`, uploaded by each user on the Templates page) → Font; the left side is the placeholder form of the chosen template, the right side a live editable A4 preview; the output is a PDF download. Read `PROJECT-PLAN.md` for scope, decisions, the reuse map from `../tender-chat-v2` and the build rounds.

## Rules from the owner

- No comments in code. Explain in the chat reply instead.
- Types are plain and written out (`interface` with named fields). No nested `Pick<...>`/`Omit<...>` tricks; `typeof table.$inferSelect` alone is fine.
- Every change gets a CHANGELOG entry in the same turn: dated bullet under `## [Unreleased]`, grouped Added / Changed / Fixed / Removed, with the key files.
- Function-based code everywhere. Backend: route handler → `services/*.service.ts` → `repositories/*.repository.ts`; repositories take `db: Executor = defaultDb`. No classes (except `extends Error`).
- Frontend: plain functions; import chain ≤ 3 of our own files; custom hooks ≤ 2 deep; components ≤ 3 deep; flat folders (no folder for one or two files).
- Copy from `../tender-chat-v2` and trim; never edit v2 itself.
- Commit or push only when the owner asks.
- Plan first for bigger features and wait for "go".
- Don't add field validation the owner didn't ask for.
- Spec-driven for every major feature: `/spec-create` writes a short spec in simple words, `.claude/specs/NN-<slug>.md` (what and why) → `/plan-create` writes a short plan, `.claude/plans/NN-<slug>.md` (files, order, plain-English steps) → on "go", code. Name the spec number in the CHANGELOG entry.
- The owner tracks what is done and what remains by hand. There is no `specs/` folder (raw.md, design.md, tasks.json) and no spec tracker: never create or update them.
- Small changes need no spec: a CHANGELOG entry only.
- The agreed spec is the contract. If the plan turns out wrong while coding, stop, show the owner the change and why, and wait for a yes; only then change the spec, then the code.
- After a major feature is coded, run `/check-feature <plan>`: the `feature-checker` agent writes the missing tests, runs every check, reviews quality, security and edge cases, and saves a report in `.claude/reports/`. It never changes app code.
- Write a `.claude/skills/<feature>/SKILL.md` only when a feature is finished, and update the existing skill rather than adding new ones.

## Run it

```sh
pnpm db:migrate   # once a schema exists
pnpm dev          # http://localhost:3000
```

The database is Neon Postgres (no Docker). The owner puts the Neon `DATABASE_URL` and the other secrets in `.env.local` (see `.env.example`).

## Folders

Next.js `src/` layout: `src/app` (pages, `api/**/route.ts`), `src/components`, `src/lib`, and later `src/services`, `src/repositories`, `src/server`, `src/shared`. `@/*` points to `src/*`. Config files, `public/`, `scripts/`, `tests/` and `drizzle/` stay at the root.

## Checks

```sh
pnpm typecheck && pnpm lint && pnpm format:check
pnpm test                 # unit + contract
pnpm test:integration     # database tender_chat_test on the same server as DATABASE_URL
pnpm route:map            # builds route-map.html (git-ignored)
```

## Gotchas

- Next.js 16 (Turbopack, Cache Components). Read `node_modules/next/dist/docs/` before using an API you're unsure of.
- `route.ts` files may only export HTTP handlers and route segment config; shared zod schemas go in `shared/`.
- `src/server/schema.ts` and `drizzle/` are Prettier-ignored. Change the schema, then `pnpm db:generate --name x` and `pnpm db:migrate`; never edit `drizzle/` by hand.
- `pnpm install` runs `scripts/copy-reader-assets.mjs` (pdf.js, tesseract, Noto fonts into git-ignored `public/`). The reader/OCR packages are kept from v2 for now; trim them when their need is clear.
- PowerShell treats `[id]` in paths as a wildcard; use Bash or `-LiteralPath`.
