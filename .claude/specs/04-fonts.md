# Spec 04: Fonts

Status: planned · 2026-11-19

## Goal

Each company gets one Hindi font, chosen on the Companies page. Later the editor uses that font for the whole page, and the PDF uses it too. We need it now because the editor (Round 5) has to know which font to show for each company.

## What the user does

1. The user opens Companies and clicks "+ Add company" (or Edit on a company). The dialog has a **Font** dropdown next to the name and files.
2. The dropdown lists the 10 fonts. Each one shows its name written in that font, plus a short Hindi sample ("नमस्ते निविदा"), so the user can see what it looks like.
3. They pick a font and click Save. The company list now shows that font's name beside the company.
4. To change the font, they open Edit, pick a different font and save.
5. To remove the font, they open Edit, pick "No font" and save. The company then uses the first font in the list, Poppins, and the list shows "Poppins (default)".

## What we save or produce

- Each company saves one font choice, or none.
- The 10 fonts are a fixed list built into the app, in this order: Poppins, Noto Serif Devanagari, Mukta, Khand, Eczar, Tiro Devanagari Hindi, Yatra One, Anek Devanagari, Laila, Gotu.
- The font files come with the app itself, not from Google's servers, so they also work offline and on Vercel. A font only downloads when it is shown.

## Rules

- Any of the 10 fonts can be picked for any company.
- No font chosen means Poppins.
- Companies that already exist start with no font, so they use Poppins.
- If a font is ever taken off the list later, the companies that used it fall back to Poppins.
- We ship the regular and bold weight of each font. Yatra One, Gotu and Tiro Devanagari Hindi only have a regular weight, so their bold is drawn by the browser (faux bold).
- A user only sees and changes their own companies. Another user's company answers "not found" (404), as before.

## When something goes wrong

| What happens                     | What the user sees                                                            |
| -------------------------------- | ----------------------------------------------------------------------------- |
| Saving the company fails         | A red toast (small pop-up message): "Something went wrong, please try again." |
| A font file fails to load        | The text shows in a normal system font; nothing breaks                        |
| The company isn't theirs or gone | "Company not found"                                                           |

## Not in this feature

- Uploading your own fonts.
- A font per tender (the font belongs to the company).
- Font size or colour settings.
- Kruti Dev / DevLys (they are not Unicode, the standard way computers store Hindi letters).
- The Font dropdown in the editor's top bar, where a change also saves to the company (Round 5).
- Using the font in the PDF (Round 7).

## Questions

- None.

## Done when

- [ ] In the browser, adding a company with Mukta shows "Mukta" in the list.
- [ ] Editing that company to Laila shows "Laila"; picking "No font" shows "Poppins (default)".
- [ ] The Font dropdown shows all 10 fonts in the order above, each sample looks different, and the Hindi letters are drawn correctly.
- [ ] Companies made before this feature show "Poppins (default)".
- [ ] The fonts load from our own app (no requests to Google Fonts in the browser's network tab).
- [ ] An automated test proves a company's font saves, changes and clears, and that another user's company still answers 404.
