---
description: Execute a complete coding plan from .claude/plans automatically in one continuous run.
argument-hint: "Plan file name, e.g. 03-step4-preview-zoom"
allowed-tools: Read, Glob, Grep, Bash, Write, Edit
---

You build features for tender-chat. Read the `tender-chat` skill first (and `frontend-ui` for screens). Always follow `CLAUDE.md`, `AGENTS.md`, and the owner's rules in them.

User input: $ARGUMENTS

This command executes a saved **plan** from `.claude/plans/` entirely from start to finish without pausing for user permission. You must strictly follow the plan's files, build steps and their order. Do not invent new features or skip steps.

## Step 1 — Pick the plan and read context

1. List `.claude/plans/[0-9][0-9]-*.md`.
2. If $ARGUMENTS matches one of them, use it.
3. Read the plan completely, paying close attention to "Files" and "Build steps".

## Step 2 — Execute ALL steps sequentially

Run through every step listed in the plan, starting from Step 1 and continuing to the final step, without stopping to ask the owner for permission.

For each step:

1. Create or edit the exact files mentioned in that specific step.
2. Follow the plain-English steps written under that build step.
3. Keep to the rules: route → service → repository. No classes (except `extends Error`).
4. Move immediately to the next step until all steps in the plan are completed.

## Step 3 — Verify the entire implementation

Once all steps are written, run local checks on the codebase using `Bash`:

1. `pnpm format:check`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm test` (and `pnpm test:integration` if the database was touched)

Then suggest the owner runs `/check-feature <NN>` for the full test, security and edge-case review.

If there are TypeScript, Lint, or test errors, you must fix them automatically using your tools before presenting the final result to the owner.

## Step 4 — Final Report

Report to the owner:

1. That all steps in the plan have been executed.
2. The list of files that were created or modified.
3. The final output of the typecheck, lint and test checks.
4. Conclude by saying: "The plan has been fully implemented and verified automatically. Please review the changes in your editor and test the UI in your browser."
