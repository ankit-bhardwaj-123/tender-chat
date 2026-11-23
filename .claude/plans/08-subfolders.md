# Plan 08: Subfolders

Spec: .claude/specs/08-subfolders.md · Status: approved, waiting for "go" · 2026-11-23

## In short

A subfolder is just a tender row with a **parent** (the folder it sits in), so it gets its own editor with no extra work. The server still sends one flat list, and the sidebar builds the tree from it. It shows the tree as a flat list of rows, indented by depth, with an open/close arrow. The New tender dialog gets an "Add a subfolder" tick box. The ⋯ menu gets **New subfolder** and **Move to…**. Deleting a folder deletes everything inside it. Search returns the matches plus the folders above them.

## Spec problems

None. The spec's suggested defaults are used as written: any depth, a folder with subfolders opens its first (oldest) subfolder instead of an editor of its own (owner change, 2026-11-23), delete takes the subfolders with it, Move to… has no "Top level" choice (owner change, 2026-11-23; the API still takes `null`), and a new subfolder starts like a new tender. After New tender with the tick box, the app opens the **subfolder** (that is where the work happens).

## Database

- `tender`: new column `parent_id` (nullable, points to `tender.id`, on delete cascade, so deleting a folder deletes its subfolders and, through the existing cascade, their image rows). New index on (`user_id`, `parent_id`).
- Migration: `pnpm db:generate --name tender-subfolders`, then `pnpm db:migrate`.

## API routes

All need a signed-in user; another user's id answers 404.

| Method | Path                | What it does                                                      | Sends                                 | Gets back                        |
| ------ | ------------------- | ----------------------------------------------------------------- | ------------------------------------- | -------------------------------- |
| GET    | `/api/tenders`      | All the user's folders (flat, each with `parentId`)               | `?search=`                            | `Tender[]` (matches + ancestors) |
| POST   | `/api/tenders`      | New tender or subfolder; with `subfolderName`, both in one go     | `{ name, parentId?, subfolderName? }` | 201 `{ tender, subfolder? }`     |
| PATCH  | `/api/tenders/[id]` | Now also moves: `parentId` (uuid or `null` = top level)           | `{ …, parentId? }`                    | `Tender`                         |
| DELETE | `/api/tenders/[id]` | Deletes the folder and all its subfolders, plus their image files | —                                     | 204                              |

Move errors: a target that is the folder itself or one of its subfolders answers 400 "A folder can't go inside itself or its own subfolder.". Another user's (or a missing) target answers 404 "Tender not found.".

## Screens

- **Sidebar list:** rows indented by depth (about 12 px per level). A folder with children shows a `ChevronRight` arrow that turns when open. Folders start open; the open/closed state lives in the sidebar's memory (not saved). The folders above the active tender are always shown open. Loading, error and empty states stay as they are. While searching, every folder in the results is open.
- **New tender dialog:** under the name, a checkbox "Add a subfolder". Ticking it shows a "Subfolder name" box (error "Enter a name for the subfolder."). Create → one request → opens the subfolder.
- **⋯ menu:** Rename, **New subfolder**, **Move to…**, Delete.
- **New subfolder dialog:** the New tender dialog reused, with a `parentId` prop, the title "New subfolder in “X”" and no tick box.
- **Move dialog (new):** a list of the user's folders, indented; main folders are bold on a grey row with a blue folder icon, subfolders are smaller, grey text with a ↳ icon (owner change, 2026-11-23). The folder itself and its own subfolders are left out, and the current parent is shown as "(here)" and can't be picked. Move button with a spinner. A red toast on error.
- **Delete dialog:** if the folder has subfolders, its text adds "This also deletes N subfolders.". If the open page is the folder or any subfolder inside it, the app goes to `/`.

## Files

| File                                            | New / Change | What it does                                                                                 |
| ----------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| `src/shared/folder-tree.ts`                     | New          | Pure helpers: build tree rows, descendants, ancestors                                        |
| `src/types.ts`, `src/shared/dto.ts`             | Change       | `Tender.parentId`                                                                            |
| `src/shared/tender-body.ts`                     | Change       | `parentId`, `subfolderName` in create; `parentId` in update                                  |
| `src/server/schema.ts` + `drizzle/0006_…`       | Change / New | `parent_id` column + index                                                                   |
| `src/repositories/tender.repository.ts`         | Change       | `parentId` in insert/update; `lockFoldersOfUser`                                             |
| `src/repositories/tender-image.repository.ts`   | Change       | `findImageKeysOfTenders(ids)`                                                                |
| `src/services/tender.service.ts`                | Change       | create with parent/subfolder, move checks, search with ancestors, deep delete                |
| `src/app/api/tenders/route.ts`                  | Change       | Pass the new create fields, new response shape                                               |
| `src/components/shell/sidebar.tsx`              | Change       | Tree rows, open/closed state, Move dialog host                                               |
| `src/components/shell/tender-list-item.tsx`     | Change       | Indent, arrow, New subfolder and Move to… menu items                                         |
| `src/components/shell/new-tender-dialog.tsx`    | Change       | Tick box + subfolder name; `parentId` mode                                                   |
| `src/components/shell/move-tender-dialog.tsx`   | New          | Pick the target folder                                                                       |
| `src/components/shell/delete-tender-dialog.tsx` | Change       | Subfolder count, leave when a subfolder inside is open                                       |
| `src/components/ui/checkbox.tsx`                | New (shadcn) | The tick box (`pnpm dlx shadcn add checkbox`; uses the Radix package already in the project) |

## Build steps

1. `src/shared/folder-tree.ts`:
   - `descendantIds(rows, id)`: walk the children from `id`, with a visited set so bad data can't loop forever.
   - `withAncestors(rows, matchIds)`: the matches plus every parent up to the top, in the original order.
   - `treeRows(rows, openIds)`: roots first, then each folder's children right under it (oldest first by `createdAt`; roots keep list order), each row with `depth`, `hasChildren` and `open`. A child whose parent is missing becomes a root.
     Check: unit tests.
2. `src/types.ts`, `src/shared/dto.ts`: add `parentId: string | null` to `Tender`, `TenderDbRow` and `toTender`.
3. `src/shared/tender-body.ts`: `CreateTenderBody` gets `parentId: z.uuid().optional()` and `subfolderName: z.string().optional()`; `UpdateTenderBody` gets `parentId: z.uuid().nullable().optional()`.
   Check: contract test.
4. `src/server/schema.ts`: add `parentId` (self-reference with `AnyPgColumn`, cascade) and the index; run `pnpm db:generate --name tender-subfolders` and `pnpm db:migrate`.
   Check: the migration SQL has the FK with `ON DELETE cascade`.
5. `src/repositories/tender.repository.ts`:
   - `NewTender` and `TenderChanges` get `parentId`, and `updateTender` copies it.
   - `lockFoldersOfUser(userId, db)`: `pg_advisory_xact_lock` on the user id, so two moves at once can't make a loop.
   - `findAllTendersByUser` loses the search filter (the service filters now).
     `src/repositories/tender-image.repository.ts`: `findImageKeysOfTenders(ids)` with `inArray`.
6. `src/services/tender.service.ts`:
   - `listTenders`: load all rows; with a search, keep the names that match (case-insensitive, NFC), then `withAncestors`.
   - `createTenderItem(userId, { name, parentId, subfolderName })`: if `parentId` is given, check it is the user's (404 if not). In one transaction, create the tender, then the subfolder if `subfolderName` cleans to a name. Both get the first company and template. Return `{ tender, subfolder }`.
   - `updateTender` with `parentId`: inside a transaction, lock, load all rows, check the target exists and isn't the folder or one of its `descendantIds` (400), then update.
   - `deleteTender`: collect `descendantIds` + itself, read all their image keys, delete the top row (the cascade does the rest), then remove the files.
7. `src/app/api/tenders/route.ts`: pass the body to the new create function and return its result.
8. `src/components/ui/checkbox.tsx`: add with shadcn, switch its import to `cn`.
9. `src/components/shell/new-tender-dialog.tsx`:
   - Props get an optional `parent: { id, name } | null`.
   - The tick box and the second field show only without a parent.
   - Submit sends `{ name, parentId?, subfolderName? }` and opens `subfolder ?? tender`. Empty subfolder name → the field error.
10. `src/components/shell/move-tender-dialog.tsx`: list from the cached `["tenders", ""]` query. It uses `treeRows` with everything open, filtered by `descendantIds`. Clicking a row picks it. Move → PATCH `{ parentId }`, then invalidate `["tenders"]` and close.
11. `src/components/shell/tender-list-item.tsx`:
    - New props `depth`, `hasChildren`, `open`, `onToggle`, `onNewSubfolder`, `onMove`.
    - Left padding by depth, an arrow button (`aria-expanded`, label "Open/Close <name>").
    - Two new menu items that use the same `pendingAction` pattern.
12. `src/components/shell/sidebar.tsx`:
    - `closedIds` state; rows come from `treeRows`. The parents of the active tender are always open, and while searching everything is open.
    - It holds the New subfolder dialog (the same `NewTenderDialog` with `parent`) and the Move dialog, like it holds Delete now.
13. `src/components/shell/delete-tender-dialog.tsx`:
    - It takes a `subfolderCount` prop for the extra sentence.
    - The optimistic remove drops the folder and its descendants.
    - It goes to `/` if the open tender is one of them.
14. Tests (see below), then `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm test:integration`, then `pnpm route:map`.

## New packages

None. The shadcn checkbox uses the `radix-ui` package the other `ui/` parts already use. If that isn't so, I'll ask before adding anything.

## Tests

- `tests/unit/folder-tree.test.ts`: tree order and depth, closed folders hide children, a missing parent becomes a root, a loop in the data doesn't hang, `descendantIds`, `withAncestors`.
- `tests/contract/tender-body.test.ts`: the new `parentId` / `subfolderName` fields; a bad uuid is refused.
- `tests/integration/tender-folders.test.ts`:
  - Create with a subfolder (both rows, one transaction) and create under a parent.
  - Another user's parent answers 404.
  - Move into a folder and to the top level; editor state is unchanged after a move.
  - Moving into itself or a descendant answers 400.
  - Search finds a subfolder and returns its parents.
  - Deleting removes the subfolders and their image files.
  - Another user's id answers 404 for move and delete.

## Risks

- The list used to filter by name in SQL; now it loads all of a user's folders. That's fine for hundreds of folders. If it ever gets slow, the filter can move back into SQL.
- A subfolder's editor opens at `/t/[id]` like any tender, so a deep link still works after a move.
- Subfolders are listed oldest first; top-level tenders stay "last changed first".
- Change 2026-11-23: `firstLeafId` in `folder-tree.ts`; sidebar rows of a folder link to it; `src/components/editor/folder-gate.tsx` (wraps the editor in `src/app/(app)/t/[tenderId]/page.tsx`) replaces the URL with it when the open tender has subfolders; `src/lib/tenders.ts` holds the shared "all tenders" query.

## Done when

- [ ] Every "Done when" line from the spec works in the browser
- [ ] pnpm typecheck, lint, format:check and test pass
- [ ] /check-feature 08 report is ✅ or ⚠️ with only small items
