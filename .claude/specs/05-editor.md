# Spec 05: Editor (top bar, form and live preview)

Status: planned · 2026-11-19

## Goal

The editor is where a contractor makes a quotation: they pick the company, template and font, fill the blanks, and see the A4 page exactly as it will look. It is the heart of the app, and the full editing (Round 6) and the PDF download (Round 7) both build on it.

## What the user does

1. The user clicks **New tender** in the sidebar and types a name → the editor opens with Quotation, the first company, the first template and that company's font already picked.
2. The **top bar** shows, in order: Type (Quotation; Notesheet greyed out, "coming soon"), Company, Template, Font.
3. The **left side** is a form with one box per `{{placeholder}}` (a blank in the template), labelled with its name, in the order the blanks first appear in the HTML. Each box is multi-line and grows as they type.
4. As they type, the **A4 preview on the right** fills in at once. The letterhead sits under page 1 and the seal sits at a fixed spot (bottom right). A blank that isn't filled yet shows its name in a light grey box.
5. A draggable divider between the form and the preview changes their widths.
6. Zoom buttons: −, +, "Fit width", and the zoom % shown.
7. They click **Save** → a toast (small pop-up message) says "Saved.".
8. Changing the **company** swaps the letterhead, seal and font. Changing the **font** restyles the whole page. Changing the **template** first asks "Change template? Values for blanks the new template doesn't have will be removed.".

## What we save or produce

- Each tender saves its type, company, template and the typed values.
- The company, template and font choices save the moment they are picked. The typed values save on Save.
- The font is saved on the company (as agreed in Spec 04), so changing it here changes it for all of that company's tenders.

## Rules

- When the template changes, values whose names exist in the new template are kept, and the others are removed.
- The company's font beats any font set inside the template, so the dropdown always decides the font. Size, bold, colours and layout from the template stay.
- No company yet: no letterhead or seal, Poppins is used, the Font dropdown is disabled, and the top bar offers "Add company".
- No template yet: an empty page with "Add template".
- A template longer than one page flows onto page 2, 3 and so on. The letterhead is only under page 1.
- Scripts inside a template never run.
- Leaving the page with unsaved typed values asks "Leave without saving?".
- A user sees only their own tenders. Someone else's tender answers "not found" (404).

## When something goes wrong

| What happens                                  | What the user sees                                      |
| --------------------------------------------- | ------------------------------------------------------- |
| Save fails                                    | A red toast: "Something went wrong, please try again."  |
| The letterhead or template file fails to load | A message in the preview saying so, with Retry          |
| The tender's company or template was deleted  | The dropdown shows "Pick a company" / "Pick a template" |
| The tender isn't theirs or is gone            | "Tender not found"                                      |

## Not in this feature

- Editing or removing text in the preview, or typing values straight into the page (Round 6).
- Moving, resizing or removing the seal; turning the letterhead off; cover boxes; adding text or images; "Reset template text" (Round 6).
- PDF download (Round 7).
- Autosave, and Notesheet.

## Questions

- None.

## Done when

- [ ] In the browser, New tender opens the editor with the first company, the first template and the company's font.
- [ ] Typing in a box fills the preview at once; an empty blank shows its name in grey.
- [ ] Switching the company swaps the letterhead and seal.
- [ ] Switching the font restyles the whole page (even a template that sets its own font), and the Companies page shows the new font.
- [ ] Switching the template asks first and keeps the values whose names match.
- [ ] After Save and a page reload, the choices and values are all still there.
- [ ] Zoom −, + and Fit width work, and a long template shows page 2.
- [ ] A template with a `<script>` doesn't run it.
- [ ] An automated test proves another user's tender answers 404.
