# Spec 07: PDF download

Status: planned · 2026-11-20

## Goal

The contractor downloads their tender as a PDF that looks exactly like the live preview, to print it or send it for the tender. This is the last step of the quotation, and Spec 06 already put a greyed-out Generate PDF button in place for it.

## What the user does

1. The user clicks **Generate PDF** in the editor's top bar. It is no longer greyed out.
2. Any change not yet autosaved is saved first.
3. The button shows a spinner and "Making PDF…", and can't be clicked again until it's done.
4. The file downloads, named after the tender (for example `Road repair.pdf`).

## What we save or produce

- One PDF, made fresh on every click from what is saved in the database. It is not stored anywhere.
- Page 1 has the letterhead underneath. Pages 2 and on are plain white.
- On top: the template text (the tender's edited copy if there is one), the placeholder values, the seal, and the added text boxes and images, at the same place and size as in the preview.
- All text is in the company's font, embedded in the PDF, so it looks the same on any computer.
- Page breaks fall where the dashed lines are in the preview.

## Rules

- The letterhead is required (decided 2026-11-20). Generate PDF stays greyed out until a company and a template are chosen, with a tip saying "Pick a company and a template first."
- A placeholder left empty prints as empty space. The grey box with its name shows only in the preview.
- The PDF shows what the user sees. It doesn't show the dashed page lines, selection borders or the grey "Image not found" boxes.
- A user can only download their own tender. Anyone else's tender answers "not found" (404).
- Scripts inside a template or the edited text never run while the PDF is made, and the page can't load anything from the internet.
- It works on the owner's computer and on Vercel (the live site).

## When something goes wrong

| What happens                                     | What the user sees                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| The save before the download fails               | No download; a red toast "Not saved, so the PDF wasn't made. Please try again."          |
| The PDF can't be made (server error, no network) | A red toast "PDF can't be made, please try again."                                       |
| The company's letterhead file is missing         | No download; a red toast "The letterhead file is missing. Upload it again in Companies." |
| The seal or an added image file is missing       | The PDF is made without it                                                               |

## Not in this feature

- Word download and Notesheet.
- Emailing the PDF, keeping a history of past PDFs, or a list of downloads.
- A signature image, a password on the PDF, or a "print" button.
- Turning the letterhead off or covering it.

## Questions

These were not answered directly. They are the suggested defaults; say if you want them different:

- The button keeps the name **Generate PDF** and stays in the top bar.
- A company and a template must be chosen before downloading.
- Pages 2 and on have no letterhead.
- An empty placeholder prints as empty space.
- A missing seal or image is skipped, but a missing letterhead stops the download.

## Done when

The owner checks by hand in the browser:

- [ ] A Hindi tender with edited template text, filled values, a moved seal and an added image downloads as `<tender name>.pdf`, and it looks the same as the preview, in the company's font.
- [ ] A long template gives a 2-page PDF with the letterhead only on page 1.
- [ ] A change made just before clicking appears in the PDF.
- [ ] With no company or no template, Generate PDF is greyed out.
- [ ] Empty placeholders print as empty space.
- [ ] The PDF downloads on the Vercel site too.
- [ ] Another user's tender id answers 404.
