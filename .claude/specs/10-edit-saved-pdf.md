# Spec 10: Name and edit saved PDFs

Status: planned · 2026-11-23 (updated by the owner 2026-11-23: Save asks for a name; saving an edited PDF asks "new or replace")

## Goal

A saved PDF (Spec 09) gets a name the contractor picks, and that name shows in the Saved PDFs dropdown. A saved PDF can also be fixed later, for example a wrong rate in "Sharma Builders 2", without starting again. Editing brings that PDF's content back into the editor, exactly as it was saved. On Save the user chooses whether to replace the old PDF or keep it and save a new one.

## What the user does

**Saving with a name** (changes Spec 09's Save):

1. The user clicks **Save** → a small "Save PDF" box opens with a **Name** field, already filled with the suggested name ("Sharma Builders", then "Sharma Builders 2", … as in Spec 09).
2. They keep it or type their own name, for example "Road repair – 2 rates", then click **Save** → the PDF is made and saved under that name, and the name shows in the dropdown. Cancel closes the box and saves nothing.

**Editing a saved PDF:**

3. In the **Saved PDFs** dropdown, each PDF now has two actions: **Open** (new tab, as now) and **Edit**.
4. The user clicks **Edit** → the editor's form and page switch to exactly what that PDF had: company, template, values, edited template text, seal, text boxes and images. The letterhead, seal, font and template text are the ones it was saved with, even if the company or template has changed since.
5. The top bar shows "Editing “Sharma Builders 2”" with a **Done** button. While editing, the Company and Template dropdowns are locked, because the PDF keeps its own letterhead, seal, font and template.
6. The user changes what they want, then clicks **Save** → the box now asks for a choice:
   - **Replace “Sharma Builders 2”**: the old PDF is updated in place, with the same entry in the dropdown. The Name field is filled with its current name and can be changed.
   - **Save as a new PDF**: the old PDF stays as it was, and a new entry is added. The Name field is filled with the next suggested name.
7. A toast says "Updated “…”." or "Saved as “…”.".
8. **Generate PDF** still downloads the current page, and saves nothing.
9. **Done** → editing ends and the editor goes back to normal (the Company and Template dropdowns work again).

## What we save or produce

- Each saved PDF has the name the user chose.
- With every save, a full copy of what made the PDF:
  - the company and template ids and names
  - the values, the edited text and the canvas (seal, text boxes, images)
  - copies of the letterhead, seal, font choice and template text at that moment
- **Replace:** that PDF's file and copy are swapped for the new ones, and the old file is removed. The created time stays the same, and an "edited" time is added.
- **Save as new:** a new saved PDF with its own file and copy. It also uses the letterhead, seal, font and template text of the PDF being edited.

## Rules

- If the Name field is left empty, the suggested name is used.
- Two saved PDFs may have the same name; the dropdown shows the date and time to tell them apart.
- Only PDFs saved after this feature can be edited. Older ones show Edit greyed out, with "Saved before editing was possible."
- Editing a PDF never changes any other saved PDF, the company or the template.
- A user can only name, edit or replace their own saved PDFs. Anyone else's answers "not found" (404).

## When something goes wrong

| What happens                          | What the user sees                                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| The saved copy can't be loaded        | A red toast "This PDF can't be opened for editing."                                                            |
| The PDF is made but saving it fails   | A red toast "PDF generated but failed to save. Please try again."; when replacing, the old PDF stays as it was |
| An image of the saved copy is missing | It is left out, as in Spec 07                                                                                  |

## Not in this feature

- Editing the PDF file itself (drawing on it, or typing on it in a PDF viewer).
- Keeping a history of the versions of one saved PDF.
- Renaming a saved PDF without saving it again, or deleting saved PDFs.
- Changing the company or template of a saved PDF while editing it.

## Questions

Decided with Plan 10 (2026-11-23):

- **Your current work in this subfolder:** Edit replaces the editor's current work with the PDF's content, and always asks first: "Replace what's in the editor with “Sharma Builders 2”?" (autosave means there is almost never "unsaved" work to check for).
- **Default choice in the box while editing:** "Replace" is picked first.
- **After Save as new while editing:** editing moves to the new PDF ("Editing “new name”").
- **After Done:** the editor keeps the PDF's content as normal work, and the next Save asks only for a name, with no Replace option.
- **Leaving the page while editing:** editing stays on until **Done**; coming back shows "Editing “…”" again (ending it on leave isn't safe with reloads).

## Done when

- [ ] Save → the box shows the suggested name; type "My quote" and save → "My quote" shows in the dropdown.
- [ ] Save a PDF, change the company's letterhead and the template, then Edit that PDF → the editor shows the old letterhead, template text and values.
- [ ] Change a value, Save, Replace → the same dropdown entry opens the updated PDF, and no new entry appears.
- [ ] Change a value, Save, Save as new → a new entry appears, and the old one opens unchanged.
- [ ] Other saved PDFs and the company or template are unchanged.
- [ ] An old PDF (saved before this feature) shows Edit greyed out.
- [ ] Another user's saved PDF id answers 404 for edit and save.
