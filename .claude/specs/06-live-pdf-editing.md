# Spec 06: Live PDF editing

Status: planned · 2026-11-20

## Goal

The contractor edits the live A4 preview directly, like a word processor: they click any text and type, and they can move, delete or add text and images. The page they see is the PDF they will get in Round 7, so all fixing happens here and there is no separate Save step.

## What the user does

1. The user clicks any text in the preview, whether it came from the template or is a placeholder value, and a cursor appears there → they type, Backspace or Delete, like in Word. Any template text can be removed this way, and more can be typed in.
2. Typing a placeholder value in the page also updates its box in the left form, and typing in the form updates the page. The two always match.
3. The user selects a whole item (a text box, an image or the seal) with one click → it shows a border. Dragging it moves it on the page. Pressing Delete removes it.
4. **Add text**: clicking an empty spot on the page, or the **Add text** button above the preview, puts a new text box there and they type into it. It can then be moved or deleted like any item.
5. **Add image** (button only) → they pick an image file → it appears on the page, where they can move, resize or delete it.
6. The seal is an item like the others: they can move, resize or delete it, and **Add seal** brings it back.
7. **Reset template text** asks first, then brings back the template's original text. Values, added items and the seal stay.
8. There is no Save button. Every change saves on its own a moment after they stop (autosave), and a small "Saving… / Saved" note shows it.
9. A greyed-out **Generate PDF** button sits where Save was. It starts working in Round 7.

## What we save or produce

- The tender's own edited copy of the template text. The uploaded template itself never changes.
- The placeholder values, as today.
- Every added text box and image, and the seal, with their position and size on the page.
- The uploaded images, kept with the tender.

## Rules

- Everything saves automatically to the database, never only in the browser. Reloading the page shows exactly what was there.
- **Changing the company** swaps the letterhead, the seal picture and the font, and keeps all text (edited template text, values, added text boxes) and the seal's position. A seal the user deleted stays deleted.
- **Changing the template** still asks first. It throws away the edited template text, keeps the values whose names exist in the new template, and keeps all added text boxes, images and the seal.
- **Changing the font** restyles all text, including added text boxes.
- Images: JPG or PNG, at most 5 MB each.
- A user sees and changes only their own tenders and images. Anyone else's answers "not found" (404).
- Scripts inside a template still never run while it is being edited.

## When something goes wrong

| What happens                         | What the user sees                                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| An image upload fails                | A red toast: "Image can't upload: <reason>" (for example wrong file type, too big, no internet) |
| An autosave fails                    | The note shows "Not saved" in red with Retry; it keeps trying on the next change                |
| An added image can't be loaded later | A grey box saying "Image not found" in its place, which can be deleted                          |

## Not in this feature

- Turning the letterhead on or off, white cover boxes, and retyping the letterhead PDF's own text.
- Undo and redo.
- The PDF itself (Round 7).
- A text style toolbar (bold, size, colour), Notesheet, and the signature image.

## Questions

- Image types and size (JPG/PNG, 5 MB) were not answered; these are the suggested defaults. Say if you want different ones.

## Done when

The owner checks by hand in the browser:

- [ ] Clicking any template text or value in the preview lets them type, Backspace and Delete, and values stay in sync with the form.
- [ ] One click selects a text box, image or the seal; dragging moves it; Delete removes it.
- [ ] Clicking an empty spot or the Add text button adds a text box; Add image adds an image; Add seal brings the seal back.
- [ ] Reset template text brings back the original template text.
- [ ] A wrong or failed image upload shows "Image can't upload: <reason>".
- [ ] There is no Save button, Generate PDF is greyed out, and after any edit and a reload everything is still there.
- [ ] Switching the company keeps all text and the seal's position; switching the template keeps added text boxes and images.
