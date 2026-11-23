# Spec 08: Subfolders

Status: planned · 2026-11-23

## Goal

A tender in the left sidebar works like a folder, and it can now hold subfolders. One tender often needs more than one letter (for example the same quotation on two letterheads), and each subfolder gets its own editor and, from Spec 09, its own saved PDFs. What subfolders will do beyond this gets decided later.

## What the user does

1. The user clicks **+ New tender**. The dialog asks for the name, and now also has a tick box **"Add a subfolder"**.
2. If they tick it, a second box asks for the **subfolder name**. They click Create → the tender appears in the sidebar with the subfolder under it.
3. Next to any tender or subfolder, the **three-dot menu** (⋯) now also has **New subfolder** → they type a name → it appears under that folder.
4. The same menu has **Move to…** → they pick another folder from a list → the folder (with everything inside it) moves under that folder and becomes its subfolder.
5. A folder with subfolders shows a small arrow. Clicking the arrow opens or closes it, and the subfolders show slightly indented under it.
6. Clicking a subfolder opens its own editor screen, with its own company, template, values and edited page, just like a tender does today.
7. A folder that has subfolders has no editor of its own: clicking it opens its **first subfolder** (the first one made), which is shown at the top under it. If that subfolder has subfolders too, its first one opens, and so on (changed by the owner 2026-11-23).
8. Rename and Delete in the ⋯ menu work for subfolders too.

## What we save or produce

- Each subfolder is saved like a tender: a name, its own editor state, and which folder it sits in.
- Subfolders are listed oldest first under their folder; top-level tenders stay newest first.
- A tender that already has work in it and then gets a subfolder keeps that work saved but hidden; it comes back if all its subfolders are deleted or moved out (decided 2026-11-23).
- Moving a folder only changes which folder it sits in. Its editor state and (later) its saved PDFs stay with it.

## Rules

- A user sees and moves only their own folders. Anyone else's folder answers "not found" (404).
- A folder can't be moved into itself or into one of its own subfolders. Those choices are hidden in the Move to… list.
- Search in the sidebar also finds subfolders by name, and shows the folders above them.
- No limit on how many subfolders a folder can have.

## When something goes wrong

| What happens                           | What the user sees                                    |
| -------------------------------------- | ----------------------------------------------------- |
| The subfolder name is left empty       | "Enter a name for the subfolder." under the box       |
| Creating or moving fails (server, net) | A red toast "Something went wrong, please try again." |
| The folder was deleted in another tab  | "Not found" and the sidebar refreshes                 |

## Not in this feature

- Anything else subfolders will do (to be defined later by the owner).
- Saved PDFs (Spec 09).
- Drag and drop in the sidebar.
- Copying a folder.

## Questions

Suggested defaults; say if you want them different:

- Subfolders can go any number of levels deep (a subfolder inside a subfolder), since Move to… allows it.
- Deleting a folder deletes all its subfolders as well, and the delete dialog says so ("This also deletes 2 subfolders.").
- A new subfolder starts like a new tender: Quotation, the first company and the first template.

## Done when

- [ ] New tender with "Add a subfolder" ticked creates the tender with that subfolder under it.
- [ ] ⋯ → New subfolder adds a subfolder under any tender or subfolder.
- [ ] ⋯ → Move to… puts a folder under another one, with its editor state unchanged.
- [ ] A folder can't be moved into itself or its own subfolder.
- [ ] Opening a subfolder shows its own editor, and changes there don't change the parent.
- [ ] Clicking a folder with subfolders (or opening its link) goes to its first subfolder.
- [ ] Rename, delete and search work for subfolders.
- [ ] Another user's folder id answers 404.
