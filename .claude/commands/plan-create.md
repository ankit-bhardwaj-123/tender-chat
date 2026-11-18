---
description: Turn a spec from .claude/specs into a short, simple build plan (plan mode), saved in .claude/plans
argument-hint: "Spec number or name, e.g. 01 or 01-auth"
allowed-tools: Read, Glob, Grep, AskUserQuestion, EnterPlanMode, ExitPlanMode, Write, Edit
---

You help the owner of **tender-chat**. Read the `tender-chat` skill first (plus `frontend-ui` for screens), and follow `CLAUDE.md`.

User input: $ARGUMENTS

This command writes **one file**: `.claude/plans/<NN>-<slug>.md`. A plan says **how** we build the spec: which files, in which order, and what each one does. It writes no code.

## Writing style (very important)

- Simple words and short sentences. Explain any technical word once in brackets.
- No ADRs, no requirement ids, no long essays.
- Pseudo-code means **plain-English steps**, 3–8 lines per file. It is not real code.
- Keep the plan under about 150 lines. If it would be longer, split the feature into two plans and tell the owner.

## Step 1: Pick the spec

1. List `.claude/specs/NN-*.md`. Use the one $ARGUMENTS points to; otherwise ask which one, and wait.
2. Read it. If its "Questions" still need answers, ask the owner now, or note them under "Risks".
3. If a plan with the same name exists, ask: replace it or update it?

## Step 2: Plan mode and research

Call `EnterPlanMode`. Read only what this feature touches:

- the skills, `PROJECT-PLAN.md` and earlier plans
- the code in `src/`
- the matching v2 files to copy from (`../tender-chat-v2/`, read only; see the reuse map in `PROJECT-PLAN.md`)
- `node_modules/next/dist/docs/` for any Next.js 16 API you're unsure of

If something in the spec can't be built as written, don't change it quietly: put it under "Spec problems".

## Step 3: Write the plan

```
# Plan <NN>: <title>

Spec: .claude/specs/<NN>-<slug>.md · Status: draft, waiting for "go" · <YYYY-MM-DD>

## In short
3–5 lines: what we build and how it works.

## Spec problems
Anything that can't be built as written, with a suggestion. Or "None".

## Database
New tables or columns in plain words (e.g. "tender: id, user, name, …") and the migration name
(`pnpm db:generate --name <name>`). Or "No changes".

## API routes
| Method | Path | What it does | Sends | Gets back |
(All need a signed-in user; another user's id answers 404.)

## Screens
Each page or component: what it shows, plus its loading, empty, error and done states.

## Files
| File | New / Copy from v2 / Change | What it does |

## Build steps
In order: shared → database → repository → service → route → lib → component → tests.
1. `<file>`: what to write, in plain-English steps:
   - …
   - …
   Check: how we know this step works.
2. …

## New packages
Name + version + why (each needs the owner's yes), or "None".

## Tests
Which test files and what each one checks.

## Risks
What could go wrong, and questions still open.

## Done when
- [ ] Every "Done when" line from the spec works in the browser
- [ ] pnpm typecheck, lint, format:check and test pass
- [ ] /check-feature <NN> report is ✅ or ⚠️ with only small items
```

Keep to the owner's rules:

- route → service → repository, and repositories take `db: Executor = defaultDb`
- function-based code, no classes, no code comments
- plain written-out `interface` types
- `route.ts` exports only HTTP handlers, and zod bodies go in `src/shared/`
- our own imports ≤ 3 files deep, hooks ≤ 2 deep, components ≤ 3 deep, flat folders
- schema changes only through `pnpm db:generate` + `pnpm db:migrate`
- no validation the owner didn't ask for, and no new packages without a yes

## Step 4: Approval and save

1. Call `ExitPlanMode` with the plan.
2. When approved, save it to `.claude/plans/<NN>-<slug>.md`, and set the spec's Status line to `planned`.
3. Add a CHANGELOG line under `### Added`: `- <YYYY-MM-DD>: Plan <NN> <title> (.claude/plans/<NN>-<slug>.md)`.
4. If the owner asks for changes, update the plan and call `ExitPlanMode` again.

## Step 5: Stop

Tell the owner the plan path and the number of build steps. Ask whether to build it all at once (`/execute-plan <NN>`) or one step at a time. No code until they answer.
