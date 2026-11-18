# Spec 02: Companies

Status: planned · 2026-11-18

## Goal

A contractor saves their firm once: a name, a letterhead (a PDF of their printed letter paper) and a seal (a JPG photo of their stamp). Later every tender can pick that company from the Company dropdown, and its letterhead and seal appear on the page. We need it now because the editor (Round 4) shows the company on every quotation.

## What the user does

1. The user opens the user menu and clicks Companies → they see a list of their companies with "+ Add company". With no companies yet, they see an empty state with the same button.
2. They click "+ Add company", type the name, upload the letterhead PDF and the seal JPG, and click Save → the company shows in the list.
3. From a company's menu they pick Edit → they can change the name, replace either file, or remove it, then save.
4. From a company's menu they pick Delete → it asks "Delete this company?" first, then the company leaves the list.

## What we save or produce

- A company: its name, its owner, and dates.
- Up to two files per company: one letterhead (PDF) and one seal (JPG), each with its file name and size.
- Delete only hides the company (marks it as removed). It stays in the database.

## Rules

- Letterhead must be a PDF; seal must be a JPG. We check the file's real contents, not only its name.
- Each file is at most 10 MB (the same as v2).
- A user sees only their own companies. Someone else's company answers "not found" (404), never "forbidden".
- Only name, letterhead and seal. None of v2's other details (GSTIN, PAN, address, bank, signatory).

## When something goes wrong

| What happens                     | What the user sees                                                            |
| -------------------------------- | ----------------------------------------------------------------------------- |
| Letterhead is not a PDF          | "Letterhead must be a PDF."                                                   |
| Seal is not a JPG                | "Seal must be a JPG."                                                         |
| A file is bigger than 10 MB      | "A file must be at most 10 MB."                                               |
| The company isn't theirs or gone | "Company not found"                                                           |
| Save, upload or delete fails     | A red toast (small pop-up message): "Something went wrong, please try again." |

## Not in this feature

- Signature image and extra company details.
- Sharing companies between users.
- The Company dropdown in the editor and showing the letterhead and seal on the page (Round 4).

## Questions

- Should the list and the edit dialog show small previews of the letterhead and seal, or just the file names? Suggest the file names, with a link to open each file.
- PNG seals too, or strictly JPG? Suggest strictly JPG, as you asked.
- Is the name required? Suggest yes, because the Company dropdown needs something to show.
- Can a company be saved without files and have them added later? Suggest yes.
- Any limit on how many companies a user can have? Suggest no limit.
- If a tender uses a company that is later deleted, does it keep its letterhead and seal? Suggest it shows none, and the Company dropdown asks the user to pick again (decided in Round 4).

## Done when

- [ ] In the browser, user menu → Companies shows the list (or the empty state).
- [ ] Adding a company with a name, a letterhead PDF and a seal JPG shows it in the list.
- [ ] Editing changes the name, and replacing or removing a file works.
- [ ] Delete asks first, then the company leaves the list.
- [ ] Uploading a JPG as the letterhead, a PDF as the seal, or a file over 10 MB shows the right message.
- [ ] A second Google account doesn't see the first account's companies.
- [ ] An automated test proves that another user's company answers 404.
