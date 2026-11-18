# Changelog

All notable changes to this project are recorded here (newest first).

## [Unreleased]

### Added

- 2026-11-18: Spec 01 tests from the feature-checker (stopped early, no report): `safeNextPath` edge cases, env, http, report-error, shell-layout and tender-body. (`tests/unit/{safe-next-path,env,http,report-error,shell-layout}.test.ts`, `tests/contract/tender-body.test.ts`)
- 2026-11-18: Spec 01 built: Google-only sign-in (Better Auth), `tender` table with name, `/api/tenders` list/search/create/read/rename/delete (another user's tender answers 404), sidebar shell with search, new tender, rename/delete and user menu, home, tender, profile and companies pages, migration `0000_auth_and_tenders`, and integration tests for tenders and isolation. (`src/server/{auth,schema,http,env,session,ownership}.ts`, `src/repositories/tender.repository.ts`, `src/services/tender.service.ts`, `src/app/api/tenders/**`, `src/components/{auth,shell,settings}/*`, `src/app/(auth)/**`, `src/app/(app)/**`, `drizzle/0000_auth_and_tenders.sql`, `tests/integration/*`, `tests/unit/safe-next-path.test.ts`)
- 2026-11-18: Plan 01 Sign in with Google + sidebar shell (.claude/plans/01-auth.md)
- 2026-11-18: Spec 01 Sign in with Google + sidebar shell (.claude/specs/01-auth.md)
- 2026-11-18: Git repo for GitHub (`origin` = github.com/ankit-bhardwaj-123/tender-chat, branch `main`), a short `README.md`, and `.gitattributes` that keeps every text file LF on Windows so `pnpm format:check` passes after a checkout. (`README.md`, `.gitattributes`)
- 2026-11-18: `tender-chat` project skill: what the app is in simple words, a glossary, a status table for the build rounds, folders, the request flow, the owner's rules, the spec → plan → build → check workflow, how to copy from v2, and commands. (`.claude/skills/tender-chat/SKILL.md`)
- 2026-11-18: `/spec-create` and `/plan-create` are now short and use simple language. A spec asks 7 questions and fits in about 80 lines, with no FR/NFR/EARS ids. A plan has files, build order and plain-English steps (3–8 lines per file), with no ADRs, and fits in about 150 lines. `/execute-plan` now follows the new "Build steps" section and suggests `/check-feature` afterwards. (`.claude/commands/spec-create.md`, `.claude/commands/plan-create.md`, `.claude/commands/execute-plan.md`, `CLAUDE.md`)
- 2026-11-18: `feature-checker` subagent and `/check-feature` command. After a major feature is written, one agent writes the missing tests, runs format/typecheck/lint/unit/integration checks, reviews quality against the owner's rules, reviews security (auth, ownership 404, uploads, XSS, PDF printer), probes edge cases, and saves a summary report to `.claude/reports/`. It edits only files under `tests/`. Based on the four spendly agents, merged into one. (`.claude/agents/feature-checker.md`, `.claude/commands/check-feature.md`, `CLAUDE.md`)
- 2026-11-18: Frontend UI skill: v2's colour tokens, fonts, spacing, the shell/sidebar/editor layouts, shadcn components, and the dialog, list, state and toast patterns, so new screens match v2. (`.claude/skills/frontend-ui/SKILL.md`)

### Changed

- 2026-11-18: The sidebar user button shows a plain person icon instead of the Google photo, which showed as a broken image. (`src/components/shell/user-menu.tsx`)
- 2026-11-18: The sidebar user menu shows only the round user icon; name and email moved into the menu, which now lists Companies, Templates (placeholder page) and Sign out. Spec 01 and plan 01 updated to match. (`src/components/shell/user-menu.tsx`, `src/app/(app)/settings/templates/page.tsx`, `.claude/specs/01-auth-spec.md`, `.claude/plans/01-auth-plan.md`)
- 2026-11-18: `git commit` and `git push` moved from "ask" to "allow" at the owner's request, so pushing no longer asks for permission. Commits and pushes still happen only when the owner asks (CLAUDE.md rule). (`.claude/settings.json`)
- 2026-11-18: The code now lives in the Next.js `src/` layout (`src/app`, `src/components`, `src/lib`), and `@/*` points to `src/*`. Updated the path configs to match, and the route map now reads `src/`. The database is Neon: `.env.example` has a Neon-style `DATABASE_URL` and the Docker setup is gone. (`tsconfig.json`, `components.json`, `vitest*.mts`, `drizzle.config.ts`, `.prettierignore`, `eslint.config.mjs`, `scripts/route-map/build.mjs`, `.env.example`, `.claude/settings.json`, `CLAUDE.md`, `PROJECT-PLAN.md`)

### Removed

- 2026-11-18: The profile page and its card, at the owner's request; the user menu shows name and email instead. (`src/app/(app)/settings/profile/page.tsx`, `src/components/settings/profile-card.tsx`)
- 2026-11-18: The setup placeholder home page; `src/app/(app)/page.tsx` replaces it. (`src/app/page.tsx`)
- 2026-11-18: The `tender-app` skill copied from v2. It described v2's 5-step flow, worker and outbox, which would mislead specs and plans here. The original stays in `../tender-chat-v2`. (`.claude/skills/tender-app/`, `CLAUDE.md`)
- 2026-11-18: `.github/` (the CI workflow copied from v2); the owner sets up git and CI later.

### Removed

- 2026-11-18: Spec tracking removed at the owner's request: the owner tracks progress by hand. Deleted `scripts/spec-tracker/`, the `spec:check` and `spec:tracker` scripts, the CI `spec:check` step and the `spec-tracker.html` ignore line. The copied commands no longer read or write `specs/raw.md`, `specs/design.md` or `specs/tasks.json`, and now describe this app instead of v2. `/spec-create` and `/plan-create` still write `.claude/specs` and `.claude/plans`. The route map stays (`pnpm route:map`). (`package.json`, `.github/workflows/ci.yml`, `.gitignore`, `next.config.ts`, `.claude/commands/*.md`, `CLAUDE.md`, `PROJECT-PLAN.md`)

### Added

- 2026-11-18: Round 0 setup from `../tender-chat-v2`: config, CI workflow, scripts, the same dependencies installed from v2's lockfile, `.claude/` commands, skills and settings, a starter root layout and home page, and a project `CLAUDE.md`. Postgres moves to port 5434 and the test database to `tender_chat_test`, so this app runs alongside v2. Tests pass when no test files exist yet. The spec builder now skips folders and files that don't exist yet. (`package.json`, `next.config.ts`, `vitest*.mts`, `.claude/`, `app/layout.tsx`, `app/page.tsx`, `CLAUDE.md`, `scripts/spec-tracker/build.mjs`)

- 2026-11-18: Project plan for the tender quotation editor: scope, screen, top-bar dropdowns, key decisions, data model, routes, folder layout, reuse map from `../tender-chat-v2`, build rounds and working rules. (`PROJECT-PLAN.md`)
