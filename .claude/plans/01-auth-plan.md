# Plan 01: Sign in with Google + sidebar shell

Spec: .claude/specs/01-auth.md · Status: draft, waiting for "go" · 2026-11-18

## In short

We copy v2's Better Auth setup (the sign-in library), keep only Google, and copy v2's sidebar shell. The tender gets its first table (name, owner, dates) and four API routes. Every page except `/login` sits inside a session guard (a check that sends signed-out users to `/login`). Each query filters by the signed-in user, so another user's tender answers 404. This is mostly copying and trimming from `../tender-chat-v2`.

## Spec problems

- None that block the build. The spec's three questions are settled as suggested: Better Auth's default 7-day login, anyone with a Google account can sign in, and an empty name becomes "Untitled tender".
- v2 calls it `title`; the spec and `PROJECT-PLAN.md` say `name`. We use `name` in the table, the API and the screens.

## Database

- `user`, `session`, `account`, `verification`: copied unchanged from v2 (`server/schema.ts:23-67`). Better Auth needs them.
- `tender`: id, user_id (cascades on user delete), name, created_at, updated_at. No `status` yet: delete removes the row, as in v2. The editor columns come in Round 4.
- Migration: `pnpm db:generate --name auth_and_tenders`, then `pnpm db:migrate`.

## API routes

All need a signed-in user (401 otherwise). Another user's id, or a malformed one, answers 404.

| Method   | Path                   | What it does                                   | Sends       | Gets back                 |
| -------- | ---------------------- | ---------------------------------------------- | ----------- | ------------------------- |
| GET/POST | `/api/auth/[...all]`   | Better Auth: Google sign-in, session, sign out | —           | Better Auth's own answers |
| GET      | `/api/tenders?search=` | My tenders, newest first; search by name       | —           | `Tender[]`                |
| POST     | `/api/tenders`         | Create                                         | `{ name? }` | `Tender` (201)            |
| GET      | `/api/tenders/[id]`    | One tender                                     | —           | `Tender`                  |
| PATCH    | `/api/tenders/[id]`    | Rename                                         | `{ name }`  | `Tender`                  |
| DELETE   | `/api/tenders/[id]`    | Delete                                         | —           | 204                       |

## Screens

- **`/login`**: card with "Continue with Google". Loading: the button is disabled while Google opens. Error: a banner if `?error=` is in the URL (Google cancelled or failed), saying "Couldn't sign in, please try again." Already signed in: goes to `/` (or `?next=`).
- **Session guard** around `(app)`: while checking, it shows nothing. Signed out: it goes to `/login?next=…`. Check failed: "We couldn't check your session" with a Try again button.
- **Sidebar**: search box (debounced, meaning it waits until typing stops), "+ New tender", the tender list, and the user menu at the bottom. Loading: skeleton rows. Empty: "No tenders yet" ("No matches" while searching). Error: a message with Retry. On a phone the sidebar opens as a sheet (a slide-in panel).
- **Tender row**: link to `/t/[id]`, plus a ⋯ menu with Rename (inline edit) and Delete (confirm "Delete this tender?"). A failure shows a red toast "Something went wrong, please try again."
- **New tender dialog**: a name box, then Create opens the new tender.
- **Home `/`**: empty state with the "New tender" button.
- **`/t/[tenderId]`**: the tender name and "The editor comes in a later round." Loading: a skeleton. 404: "Tender not found" with a link home.
- **User menu**: only the round photo (or initial) in the sidebar. The menu shows name and email, then Companies, Templates, Sign out. (No profile page: changed at the owner's request.)
- **`/settings/templates`**: "Templates come in a later round."
- **`/settings/companies`**: "Companies come in Round 2."

## Files

| File                                                                                                                      | New / Copy / Change | What it does                                                      |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------- |
| `src/types.ts`                                                                                                            | Copy, trim          | `User` (+ `image`), `Session`, `Tender`                           |
| `src/shared/tender-body.ts`                                                                                               | New                 | zod bodies for create and rename (v2 had them inside `route.ts`)  |
| `src/shared/dto.ts`                                                                                                       | Copy, trim          | `toTender(row)`                                                   |
| `src/server/env.ts`, `errors.ts`, `logger.ts`, `report-error.ts`                                                          | Copy                | env check, app errors, logging                                    |
| `src/server/http.ts`                                                                                                      | Copy, trim          | `handle`, `readJson`, `parseId` (upload helpers wait for Round 2) |
| `src/server/adapters/postgres.ts`                                                                                         | Copy                | `db`, `Executor`                                                  |
| `src/server/schema.ts`                                                                                                    | Copy, trim          | 4 auth tables + `tender`                                          |
| `src/server/auth.ts`                                                                                                      | Copy, trim          | Google only; `testUtils` plugin only when `NODE_ENV=test`         |
| `src/server/session.ts`, `ownership.ts`                                                                                   | Copy                | `requireUserId`; `ownedBy(userId)`                                |
| `src/repositories/tender.repository.ts`                                                                                   | Copy, trim          | list/search, find, create, rename, delete; no document joins      |
| `src/services/tender.service.ts`                                                                                          | Copy, trim          | clean name, default "Untitled tender", 404s                       |
| `src/app/api/auth/[...all]/route.ts`                                                                                      | Copy                | Better Auth handler                                               |
| `src/app/api/tenders/route.ts`, `[id]/route.ts`                                                                           | Copy, change        | `name`; bodies from `shared/`                                     |
| `src/lib/auth.ts`, `lib/hooks.ts`, `lib/shell-layout.ts`                                                                  | Copy                | `safeNextPath`; `useDebouncedValue`, `useMediaQuery`; panel sizes |
| `src/components/auth/{login-form,auth-card,form-error-banner,require-session}.tsx`                                        | Copy, change        | login reads `?error=`                                             |
| `src/components/shell/*` (7 files)                                                                                        | Copy, trim          | new dialog without file upload; menu without Templates            |
| `src/components/ui/{button,input,dialog,alert-dialog,dropdown-menu,sheet,skeleton,resizable,icon-button,field,label}.tsx` | Copy                | shadcn pieces the shell uses                                      |
| ~~`src/components/settings/profile-card.tsx`~~ (removed)                                                                  | New                 | read-only profile                                                 |
| `src/app/(auth)/layout.tsx`, `login/page.tsx`                                                                             | Copy                | login page                                                        |
| `src/app/(app)/layout.tsx`, `page.tsx`, `error.tsx`                                                                       | Copy, change        | guard + shell; new simple home                                    |
| `src/app/(app)/t/[tenderId]/page.tsx`                                                                                     | New                 | name, or "Tender not found"                                       |
| `src/app/(app)/settings/{companies,templates}/page.tsx`                                                                   | New                 | placeholders                                                      |
| `src/app/page.tsx`                                                                                                        | Remove              | replaced by `(app)/page.tsx`                                      |
| `tests/integration/users.ts`, `tenders.test.ts`, `isolation.test.ts`                                                      | Copy, change        | test users through `testUtils`                                    |

## Build steps

1. **Shared**: `src/types.ts`, `shared/tender-body.ts`, `shared/dto.ts`.
   - `Tender` is id, name, createdAt, updatedAt. `User` is id, name, email, image.
   - The create body has an optional name; the rename body has a name string.
   - Check: `pnpm typecheck`.
2. **Server core**: copy `env`, `errors`, `logger`, `report-error`, `http` (trimmed), `adapters/postgres`.
   - Check: typecheck.
3. **Schema + migration**: copy the auth tables; add `tender` with `name` and `updated_at`.
   - Run `pnpm db:generate --name auth_and_tenders`, then `pnpm db:migrate`.
   - Check: the tables exist in Neon.
4. **Auth server**: `server/auth.ts`, `session.ts`, `ownership.ts`, and the `api/auth/[...all]` route.
   - Remove email/password and the email sender. Google always on (the env keys become required).
   - Add Better Auth's own `testUtils` plugin only when `NODE_ENV` is `test`.
   - Check: `/api/auth/get-session` answers `null` in the browser.
5. **Tender repository**: `tender.repository.ts`.
   - Every query is filtered by `ownedBy(userId)`. Search uses `ilike` on the name, with `%` and `_` escaped (as in v2).
   - Ordered by `updated_at`, newest first. Rename bumps `updated_at`.
   - Each function takes `db: Executor = defaultDb`.
6. **Tender service**: `tender.service.ts`.
   - Clean the name (NFC, collapse spaces, trim). Empty on create becomes "Untitled tender". Empty on rename is a 400 error.
   - A missing row becomes `notFound("Tender not found.")`.
7. **Routes**: `api/tenders/route.ts`, `api/tenders/[id]/route.ts`.
   - Each handler runs `handle` → `requireUserId` → `parseId` → `readJson(body from shared)` → service.
8. **Lib**: `lib/auth.ts`, `lib/hooks.ts` (only the two hooks), `lib/shell-layout.ts`.
9. **UI pieces**: copy the 11 `components/ui` files from v2, and add any shadcn package the copied files need that we lack.
10. **Auth screens**: `(auth)` layout, the login page, and the 4 auth components.
    - Login shows the error banner when `?error=` is in the URL. `errorCallbackURL` stays `/login`.
    - Check: the browser signs in with Google and comes back to `/`.
11. **Shell**: the 7 shell files, plus `(app)/layout.tsx` and `error.tsx`.
    - Rename `title` to `name` everywhere.
    - The new tender dialog keeps only the name box.
    - The user menu shows only the photo, with links to Companies and Templates.
    - Check: create, rename, search and delete work in the sidebar.
12. **Pages**: home, `t/[tenderId]`, settings companies and templates. Remove `src/app/page.tsx`.
    - The tender page fetches `GET /api/tenders/[id]` and shows "Tender not found" on a 404.
13. **Tests**: `users.ts`, `tenders.test.ts`, `isolation.test.ts`, then run every check.

## New packages

None. `testUtils` is part of `better-auth`. If a copied ui file needs a radix part that's missing, I'll ask first.

## Tests

- `tests/integration/users.ts`: `createSignedInUser()` with `testUtils` (`createUser`, `saveUser`, `login`) returns the cookie. `deleteUsers()` removes them.
- `tenders.test.ts`: create with no name gives "Untitled tender"; the list is newest first; search matches the name; rename works; an empty rename gives 400; delete gives 204 and the tender is then gone.
- `isolation.test.ts`: user B gets 404 on GET, PATCH and DELETE of A's tender, and doesn't see it in the list. No cookie gives 401. A bad id gives 404.
- `tests/unit/safe-next-path.test.ts`: `safeNextPath` blocks outside URLs and `/login`.

## Risks

- **Google setup:** the owner adds `http://localhost:3000/api/auth/callback/google` as a redirect URI in Google Cloud.
- **`testUtils`:** it must never load outside tests. It is guarded by `NODE_ENV === "test"`, and the check report confirms it.
- **v2's shell has steps-bar and document bits:** trimming may touch more lines than expected, but there is no change in behaviour.
- **Copied route bodies:** v2 keeps zod bodies inside `route.ts`, which breaks our rule. They move to `shared/`.

## Done when

- [ ] Every "Done when" line from the spec works in the browser
- [ ] pnpm typecheck, lint, format:check, test and test:integration pass
- [ ] /check-feature 01 report is ✅ or ⚠️ with only small items
