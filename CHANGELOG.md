# Changelog

All notable changes to this project are recorded here (newest first).

## [Unreleased]

### Fixed

- 2026-11-19: Template View now really blocks scripts: the app-wide CSP in `next.config.ts` was overriding the route's `sandbox` policy, so a later header rule for `/api/templates/:id/file` sends the shared sandbox policy. (`next.config.ts`, `src/shared/template-file-policy.ts`, `src/app/api/templates/[id]/file/route.ts`)
- 2026-11-19: A stored (Blob) upload must have a file extension allowed for its kind, so a company PDF can no longer be registered as a template. (`src/services/upload.service.ts`)
- 2026-11-19: Placeholder names are NFC-normalised, so a Hindi name typed in two Unicode forms shows once. (`src/shared/placeholders.ts`)
- 2026-11-19: A network failure while editing or deleting a template shows "Something went wrong, please try again." instead of "Failed to fetch". (`src/lib/templates.ts`)
- 2026-11-19: Template tests check that the served policy contains `sandbox` instead of being exactly `sandbox`. (`tests/integration/{templates,template-edges}.test.ts`)

### Changed

- 2026-11-18: Uploads now name their kind (`companyFile` 10 MB PDF/JPG, `template` 2 MB HTML), sent with each Blob upload and checked by the token route; the file field also takes HTML and can hide Remove for a saved file; the stored-key check covers template files. (`src/services/upload.service.ts`, `src/repositories/upload.repository.ts`, `src/lib/{file-upload,companies}.ts`, `src/app/api/uploads/token/route.ts`, `src/app/api/companies/[id]/files/[kind]/route.ts`, `src/services/company.service.ts`, `src/server/adapters/blob-storage.ts`, `src/components/companies/file-field.tsx`, `tests/unit/uploads.test.ts`)
- 2026-11-18: Ran Prettier on the Spec 02 report so `pnpm format:check` passes (whitespace only). (`.claude/reports/2026-11-18-02-companies.md`)
- 2026-11-18: Spec 03 agreed: templates are uploaded by each user on a Templates page (name, Hindi/English, one HTML file; placeholder names in small blue text under each name), not built in; no field list files; fonts move to their own Round 4 and the editor/PDF rounds become 5–7. (`.claude/specs/03-templates-spec.md`, `PROJECT-PLAN.md`, `CLAUDE.md`, `.claude/skills/tender-chat/SKILL.md`, `.claude/agents/feature-checker.md`)

- 2026-11-18: Decided how templates are given: HTML only with every placeholder; a PDF only as a picture to compare against, never stored; we write each field list from the HTML and the owner checks it. (`PROJECT-PLAN.md`)
- 2026-11-18: Renamed "layout" to "template" for the built-in Hindi HTML letters (Round 3 is now "Templates + fonts registry", the API is `/api/templates`, a tender stores `template_key`), and moved the folder `layouts/<key>/layout.html` to `templates/<key>/template.html`. The Next.js `src/` layout, `layout.tsx` and v2 file names are unchanged. (`PROJECT-PLAN.md`, `CLAUDE.md`, `.claude/skills/tender-chat/SKILL.md`, `.claude/agents/feature-checker.md`, `templates/paidal-march-plantation/template.html`)

### Removed

- 2026-11-18: The ready-made sample template `paidal-march-plantation`; the owner will upload templates later. (`layouts/paidal-march-plantation/layout.html`)

### Added

- 2026-11-18: Spec 03 tests from the feature-checker: security-header test (sandbox CSP on the template View route, fails until fixed), placeholder markup and NFC cases, template name NFC, and template edge-case integration tests (bad PATCH, void rows, storage keys, BOM, stored-key kinds, other users, companies unchanged). Report: `.claude/reports/2026-11-18-03-templates.md`. (`tests/unit/{security-headers,placeholders}.test.ts`, `tests/contract/template-body.test.ts`, `tests/integration/template-edges.test.ts`)
- 2026-11-18: Spec 03 built: templates page (user menu, Templates) to add, view, edit and delete templates with a name, language (Hindi/English) and one HTML file (.html/.htm, UTF-8, at most 2 MB); its placeholder names are read on upload and shown in small blue text under each name. Table `template` (migration `0002_templates`), `/api/templates` list/create/read/edit/delete (delete marks void), `/api/templates/[id]/file` open (served sandboxed so scripts in the file can't run) and replace. Another user's template answers 404. (`src/server/schema.ts`, `src/shared/{template-body,placeholders,dto}.ts`, `src/repositories/template.repository.ts`, `src/services/template.service.ts`, `src/app/api/templates/**`, `src/lib/templates.ts`, `src/components/templates/*`, `src/components/ui/select.tsx`, `src/app/(app)/settings/templates/page.tsx`, `drizzle/0002_templates.sql`)
- 2026-11-18: Spec 03 tests: placeholder finder unit tests, template body and `toTemplate` contract tests, template API integration tests (create, edit, replace, delete, wrong files, 2 MB boundary, sandbox header, 401/404) and template isolation tests. (`tests/unit/placeholders.test.ts`, `tests/contract/template-body.test.ts`, `tests/integration/{templates,isolation}.test.ts`)
- 2026-11-18: Plan 03 Templates (.claude/plans/03-templates-plan.md)
- 2026-11-18: Spec 03 Templates (.claude/specs/03-templates-spec.md)
- 2026-11-18: First Hindi quotation layout, "पैदल मार्च एवं पौधारोपण" (from the ECONEST Siswali quotation PDF), with `{{officer}}`, `{{department}}`, `{{office_address}}`, `{{work_name}}` (used twice), `{{rate}}` and `{{date}}` placeholders that grow or shrink with the text, and top space left for the letterhead. (`layouts/paidal-march-plantation/layout.html`)
- 2026-11-18: Spec 02 tests from the feature-checker: upload key, Blob path, file-name header and `readUploads` unit tests; more company-name contract cases (NFC, Hindi, blank whitespace); company edge-case integration tests (401 on every route, 404 for deleted/malformed ids, 10 MB boundary, bytes-not-name type check, other users' Blob keys, and a concurrent-upload test that fails on purpose to show the upload race). Report: `.claude/reports/2026-11-18-02-companies.md`. (`tests/unit/uploads.test.ts`, `tests/contract/company-body.test.ts`, `tests/integration/company-edges.test.ts`)
- 2026-11-18: Spec 02 built: companies with a name, letterhead PDF and seal JPG. Tables `company` and `company_file` (migration `0001_companies`), `/api/companies` list/create/read/rename/delete (delete marks void), `/api/companies/[id]/files/[kind]` upload/open/remove with a real file-type check and a 10 MB limit, `/api/uploads/token` for Vercel Blob uploads, local/Blob file storage copied from v2, and the Companies page with list, add/edit dialog and delete confirm. Another user's company answers 404. (`src/server/{schema,http}.ts`, `src/server/adapters/{file,local,blob}-storage.ts`, `src/repositories/{company,upload}.repository.ts`, `src/services/{company,upload}.service.ts`, `src/app/api/companies/**`, `src/app/api/uploads/token/route.ts`, `src/lib/{companies,file-upload}.ts`, `src/components/companies/*`, `src/app/(app)/settings/companies/page.tsx`, `src/shared/{company-body,dto}.ts`, `src/types.ts`, `drizzle/0001_companies.sql`)
- 2026-11-18: Spec 02 tests: company body and `toCompany` contract tests, company API and file integration tests, and company isolation tests (404 for another user). (`tests/contract/company-body.test.ts`, `tests/integration/{companies,isolation}.test.ts`, `tests/integration/users.ts`)
- 2026-11-18: Plan 02 Companies (.claude/plans/02-companies-plan.md)
- 2026-11-18: Spec 02 Companies (.claude/specs/02-companies-spec.md)
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

- 2026-11-18: Integration tests now get 20 s per test and hook instead of 5 s, because each request makes several round trips to Neon and the company file tests took up to 5.4 s. (`vitest.integration.config.mts`)
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
