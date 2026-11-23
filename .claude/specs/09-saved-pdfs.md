# Spec 09: Saved PDFs

Status: planned · 2026-11-23 (changed by the owner 2026-11-23: two buttons, Save and Generate PDF)

## Goal

The contractor can save the PDF of a tender or subfolder in the database as many times as they like (for example 3 PDFs on 2 letterheads) and open any of them later. A saved PDF never changes: if the company's letterhead, seal or font, or the template, changes later, the old PDFs still look exactly as they did. The Font dropdown leaves the top bar, because the font is picked once on the company.

## What the user does

1. In the editor's top bar the **Font** dropdown is gone. The page still uses the company's font (set on the Companies page). (Done early, 2026-11-23.)
2. The top bar has two buttons: **Save** and **Generate PDF**.
3. The user clicks **Save** → any unsaved change is saved, the PDF is made and saved in the database. A toast says "Saved as “Sharma Builders”.". Nothing opens or downloads.
4. The first save is named after the company. Clicking Save again gives "Sharma Builders 2", then "Sharma Builders 3", and so on. With another company chosen, its own name is used, starting again without a number.
5. After the first save, a **Saved PDFs** dropdown appears in the top bar. It lists every saved PDF of this tender or subfolder, newest first, with its date and time.
6. The user picks a PDF in the dropdown → it opens in a new browser tab, exactly as it was made.
7. **Generate PDF** works as it does now: it downloads `<tender name>.pdf` and saves nothing.
8. The automatic-save status ("Saving…", "Saved") is no longer shown. Saving still happens on its own; only a failed save shows "Not saved · Retry".

## What we save or produce

- The finished PDF file itself, one per Save click, kept for good. Because the file is stored as it was made, its layout, letterhead, seal and font can't change later.
- With each PDF: its name, which tender or subfolder it belongs to, the date and time, and the company and template names as they were then.

## Rules

- No limit on how many PDFs a tender or subfolder keeps.
- Numbers count per tender or subfolder and per company name; a free gap is reused ("A", "A 3" saved → next is "A 2").
- A saved PDF belongs to the folder where it was made. Other folders don't see it, and changes in other folders don't touch it.
- A folder with subfolders has no editor (Spec 08), so PDFs are saved only in a subfolder or in a tender without subfolders.
- Changing or deleting a company or template later doesn't change or remove any saved PDF.
- Save and Generate PDF stay greyed out until a company and a template are chosen (as in Spec 07).
- A user sees and opens only their own saved PDFs. Anyone else's answers "not found" (404).

## When something goes wrong

| What happens                                  | What the user sees                                                   |
| --------------------------------------------- | -------------------------------------------------------------------- |
| The PDF is made but saving it in the DB fails | A red toast "PDF generated but failed to save. Please try again."    |
| The PDF can't be made                         | Same toasts as Spec 07 ("PDF can't be made, please try again." etc.) |
| A saved PDF's file is missing                 | The new tab shows "This PDF can't be found."                         |
| An automatic save fails                       | "Not saved · Retry" in the top bar, as now                           |

## Not in this feature

- Notesheet PDFs (only Quotation is made now).
- Renaming, deleting or sharing saved PDFs.
- Changing the font in the editor (it is changed only on the Companies page).

## Questions

- Deleting a tender or subfolder also deletes its saved PDFs (suggested default).

## Done when

- [ ] The Font dropdown is gone and the preview still uses the company's font.
- [ ] Save twice → the dropdown appears with "Sharma Builders" and "Sharma Builders 2"; each opens in a new tab.
- [ ] Make 3 PDFs on 2 letterheads; change the letterhead, seal and font of that company and edit the template; the saved PDFs still look the same.
- [ ] A PDF saved in one subfolder doesn't show in another.
- [ ] Generate PDF still downloads as before, and "Saving… / Saved" is no longer shown.
- [ ] When storing fails, the user sees "PDF generated but failed to save. Please try again."
- [ ] Another user's saved PDF id answers 404.
