---
name: frontend-ui
description: Use when building or changing any screen, component or style in tender-chat - colors, theme tokens, fonts, layout (shell, sidebar, editor split), shadcn components, forms, dialogs, lists, toasts, loading/empty/error states. Patterns taken from ../tender-chat-v2.
---

# Frontend UI design system (from tender-chat-v2)

The look is a calm, professional light theme: warm off-white surfaces, one blue accent, Inter + Noto Sans Devanagari, small radius, thin borders, no shadows except on cards and popovers, and no gradients, glows or neon. Copy v2's components and keep these tokens. Never hard-code a hex value in a component; use the Tailwind token classes below.

v2 paths below are relative to `../tender-chat-v2/` (read only, never edit). In this project the same files go under `src/` (`src/components/ui/button.tsx`, and so on).

## Stack

- Tailwind CSS 4 (CSS-first config in `app/globals.css`, no `tailwind.config`), `tw-animate-css`, `shadcn/tailwind.css`.
- shadcn style `radix-nova`, base colour neutral, CSS variables on, icons `lucide-react` (`components.json`).
- `cn` comes from the `cn` package (`lib/utils.ts` re-exports it). Variants use `class-variance-authority`.
- Data: TanStack Query (`app/providers.tsx`: staleTime 10 s, retry 1, mutations no retry; any query error re-checks `["session"]`).
- Toasts: `sonner` (`components/ui/sonner.tsx`), top right, rich colours.
- Split panes: `react-resizable-panels` (`components/ui/resizable.tsx`).

## Colour tokens (`app/globals.css`, light only)

| Token (class)                                 | Hex                         | Use                                                                    |
| --------------------------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| `background`                                  | #f6f6f3                     | page background (also `themeColor` in `app/layout.tsx`)                |
| `foreground`                                  | #1f2329                     | main text                                                              |
| `card`                                        | #fbfbf9                     | cards, list boxes, inputs on grey                                      |
| `popover`                                     | #fdfdfb                     | dialogs, menus, toasts                                                 |
| `primary` / `-foreground`                     | #2b59c3 / #fff              | the one accent: main buttons, active step, focus ring, icons in points |
| `secondary`                                   | #ebebe6                     | secondary buttons                                                      |
| `muted` / `muted-foreground`                  | #eeeeea / #565c66           | icon tiles, hover rows, helper text                                    |
| `accent`                                      | #e8edf7                     | soft blue highlight                                                    |
| `border` / `input` / `ring`                   | #e2e2dc / #cfcfc7 / #2b59c3 | dividers / input borders / focus                                       |
| `destructive` / `destructive-soft`            | #b42318 / #fbe9e7           | delete, errors                                                         |
| `success` / `success-soft`                    | #1d6b45 / #e3f1e8           | done states                                                            |
| `warning` / `warning-soft`                    | #8a4b00 / #fbefd9           | missing documents, cautions                                            |
| `info` / `info-soft`                          | #2b59c3 / #e7eefb           | info badges, icon circles (`bg-info-soft text-info`)                   |
| `neutral` / `neutral-soft`                    | #4f5560 / #ebebe6           | neutral badges                                                         |
| `sidebar`, `sidebar-accent`, `sidebar-border` | #efefeb, #e3e3de, #e0e0da   | sidebar panel, hover/active row, its borders                           |

Rules:

- Status badges use the pair `bg-<x>-soft text-<x>`.
- Delete buttons are soft: `variant="destructive"` (red text on a 10 % red background), or a ghost icon with `hover:text-destructive`.
- Text selection uses `info-soft`. Focus is a 2 px `ring` outline with a 2 px offset (`globals.css` base layer).
- There is no dark mode. `<html>` is light only (`colorScheme: "light"`); the `dark:` variants that come with shadcn components are harmless but never used.

## Type and spacing

- `--font-sans` = Inter, then Noto Sans Devanagari (both `next/font/google` in `app/layout.tsx`, as variables `--font-inter` and `--font-devanagari`). Hindi falls back to Noto automatically.
- Body `line-height: 1.6`; `:lang(hi)` 1.75. Set `lang="hi"` on Hindi blocks.
- Scale:
  - page title `text-xl font-semibold` (home hero `text-2xl font-semibold tracking-tight`)
  - section `text-base`/`text-lg font-semibold`
  - card title `text-sm font-medium`
  - helper text `text-sm text-muted-foreground`
  - meta and badges `text-xs`
  - form section headings `text-xs font-semibold tracking-wide text-muted-foreground uppercase`
- Numbers use `tabular-nums`; money is right-aligned (`text-right tabular-nums`).
- Radius: `--radius` 0.625rem. Buttons and inputs use `rounded-lg`, cards and lists `rounded-xl`, rows `rounded-md`, badges `rounded-full`.
- Heights: controls `h-8` (default), `h-9` in the sidebar, `h-7` small; headers `h-14`.
- Page padding: `px-6 py-8 md:px-10`. Gaps: `gap-2` tight, `gap-4` form grid, `gap-6` page sections, `gap-8` big blocks.

## Layout

- **Root** (`app/layout.tsx`): `body` is `flex min-h-full flex-col`. It wraps everything in `Providers` → `TooltipProvider` → children + `Toaster`.
- **App shell** (`components/shell/app-shell.tsx`):
  - **Desktop (≥ 768 px, `useMediaQuery`)**:
    - Layout: a horizontal `ResizablePanelGroup` with a sidebar of 280 px default (min 220, max 420), collapsible to 0, beside the main panel.
    - Collapsing: `PanelLeftClose` hides the sidebar; once it's hidden, a floating `PanelLeftOpen` button (`absolute top-3 left-3`) shows it again.
    - Saved state: the panel sizes are kept in localStorage `tender-chat:shell-layout` (`lib/shell-layout.ts`).
    - The collapse animates 200 ms unless the user prefers reduced motion.
  - **Mobile**: a `h-14` header with a menu button that opens the sidebar in a left `Sheet` (`w-[85vw] max-w-80`).
  - There is a "Skip to content" link, and `<main id="main-content">` scrolls.
- **Sidebar** (`components/shell/sidebar.tsx`): `nav.bg-sidebar`, a flex column, top to bottom:
  1. the hide button (desktop)
  2. "New tender" (`variant="outline"`, `h-9 w-full justify-start bg-card`, `Plus` icon)
  3. search (`Input type="search"`, `h-9 bg-card pl-8` with a `Search` icon inside, 250 ms debounce, Esc clears)
  4. the scrolling list
  5. `border-t` + `UserMenu` at the bottom
- **List row** (`components/shell/tender-list-item.tsx`):
  - Look: `rounded-md text-sm`, `hover:bg-sidebar-accent`, and the active row `data-active:bg-sidebar-accent font-medium`. Titles are truncated with a `title` tooltip.
  - Actions: a `MoreHorizontal` menu (Rename, Delete in red) that appears on hover. Rename is inline, with an input bordered in `ring`, where Enter saves and Esc cancels. Renames are optimistic and roll back on error.
- **Content page**: a centred column `mx-auto w-full max-w-3xl` (forms) or `max-w-xl` (home), with the header row `flex-col gap-4 sm:flex-row sm:justify-between` (title + description on the left, the main button on the right).
- **Pinned action bar** (`components/tender/step-page.tsx`): a scrolling body, then `shrink-0 border-t bg-background px-6 py-4` holding Back (outline) and Next (primary, `Loader2 animate-spin` while busy).
- **Editor split** (v2 Step 4, `components/tender/edit-step.tsx`, `quotation-preview.tsx`): the form on the left, the preview on the right.
  - Width: a draggable divider sets 25–70 % (localStorage `quotation-preview-width`).
  - Form: built with container queries (`@container`, `@lg:grid-cols-2`, `@lg:col-span-2`) so it adapts to its own width.
  - Preview header: `border-b px-4 py-2` with the title + hint on the left and the zoom group (`Minus`, `NN%` `tabular-nums`, `Plus`, Fit) as `icon-sm` buttons.
  - Pages: an A4 sheet of 794 px scaled with `transform: scale()`.
- **Auth pages** (`app/(auth)/layout.tsx`, `components/auth/auth-card.tsx`): centred `max-w-sm`; card `rounded-xl border bg-card p-6 shadow-sm sm:p-8`.

## Components (`components/ui/`)

| File                                                                          | Notes                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `button.tsx`                                                                  | variants `default` (primary), `outline`, `secondary`, `ghost`, `destructive` (soft), `link`; sizes `default` h-8, `xs`, `sm` h-7, `lg` h-9, `icon`, `icon-xs`, `icon-sm`, `icon-lg`; icons auto `size-4`; press nudges `translate-y-px` |
| `icon-button.tsx`                                                             | every icon-only button: `label` becomes `aria-label` + `title`; default `ghost`, `icon`                                                                                                                                                 |
| `input.tsx`, `textarea.tsx`, `select.tsx`, `label.tsx`                        | h-8 `rounded-lg border-input`, focus `ring-3 ring-ring/50`, `aria-invalid` shows red                                                                                                                                                    |
| `field.tsx`                                                                   | `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldSet`; vertical by default                                                                                                                                  |
| `dialog.tsx`                                                                  | overlay `bg-black/10 backdrop-blur-xs`; content `rounded-xl bg-popover ring-1 ring-foreground/10`, default `sm:max-w-sm` (widen with a className); footer `border-t bg-muted/50`                                                        |
| `alert-dialog.tsx`                                                            | confirm before delete/remove                                                                                                                                                                                                            |
| `sheet.tsx`                                                                   | side panels (mobile sidebar, PDF preview)                                                                                                                                                                                               |
| `dropdown-menu.tsx`                                                           | row actions; `variant="destructive"` item for delete                                                                                                                                                                                    |
| `skeleton.tsx`, `tooltip.tsx`, `separator.tsx`, `resizable.tsx`, `sonner.tsx` | —                                                                                                                                                                                                                                       |

To add a new shadcn component, run `pnpm dlx shadcn add <name>` (it uses `components.json`), then make sure it imports `cn` from `"cn"` like the others.

## Patterns to reuse

- **Dialog form** (`components/companies/company-dialog.tsx`):
  - Structure: a `form` with a header (`border-b px-6 py-4`: `DialogTitle text-lg font-semibold`, a description, and a close `X` `IconButton`), a scrolling body `px-6` split into `Section`s (`border-b py-5`, uppercase mini heading), and a footer.
  - Fields: a two-column grid (`grid gap-4 sm:grid-cols-2`).
  - Busy text on the button: "Saving…" / "Uploading 1 of 3…".
  - Reset: bump a `key` on the dialog to start it empty rather than resetting state in an effect.
- **List card** (`components/companies/company-list.tsx`): `ul.divide-y rounded-xl border bg-card overflow-hidden`; each row is `flex items-center gap-3 px-4 py-3` with an icon tile (`size-9 rounded-lg bg-muted`), the name `text-sm font-medium` plus an optional `rounded-full border text-xs` badge, a `text-xs text-muted-foreground` summary, and edit/remove `icon-sm` buttons.
- **Every data view has 4 states:**
  - loading: `Skeleton`s inside `role="status"`
  - error: `role="alert"` with a muted message and an outline `sm` "Try again" that refetches
  - empty: `rounded-xl border border-dashed py-12 text-center` with a `size-12 rounded-full bg-muted` icon circle, a bold line, a `text-xs` hint and an outline button
  - data
- **Toasts:** `toast.success("Company added.")`, `toast.error(error.message)`, and `toast.warning(title, { description })` for partial results. Messages are short full sentences ending in a full stop, saying what happened and what to do ("Couldn't load your tenders.", "Please try again.").
- **Fetch helpers** live in `lib/<area>.ts`, with plain `fetch` + `res.ok` checks that throw an `Error` holding the message the user will see. Query keys are arrays (`["tenders", search]`, `COMPANIES_KEY`).
- **Icons:** lucide at `size-4` (lists and buttons), `size-6`/`size-8` in empty states. Decorative icons get `aria-hidden`.

## Accessibility and conventions

- Lists use `ul`/`li`, navigation uses `nav aria-label`, the current item gets `aria-current`, and loading/error regions get `role="status"`/`role="alert"`.
- Focus must be visible (`focus-visible:ring-2 ring-ring`), and focus returns to the trigger after a dialog or menu closes.
- Respect `prefers-reduced-motion`. Only small `animate-in fade-in` / `zoom-in-95` transitions (100–200 ms).
- The lint rule `react-hooks/set-state-in-effect` is on: derive state, or use `useSyncExternalStore` for localStorage.
- Owner rules (from `CLAUDE.md`):
  - plain function components, no comments, written-out `interface` props
  - our own imports ≤ 3 files deep, hooks ≤ 2 deep, components ≤ 3 deep
  - flat folders
- Wording is plain English for app chrome. Quotation content and labels are Hindi.

## Check a UI change

```sh
pnpm typecheck && pnpm lint && pnpm format:check
pnpm dev   # http://localhost:3000; hard-reload (Ctrl+Shift+R) if a screen looks stale
```

Check at 360 px (mobile sheet sidebar) and at ≥ 1280 px (split editor).
