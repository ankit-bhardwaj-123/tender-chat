# Spec 03: Templates

Status: planned · 2026-11-18

## Goal

A contractor uploads their quotation templates once: a name, a language (Hindi or English) and an HTML layout (the letter design with `{{placeholders}}`, blanks such as `{{officer}}` or `{{rate}}`). In the editor round (Round 5) the Template dropdown picks one of these. This works like v2's Templates page, but with only the HTML: no template PDF, and no rate basis (item-wise, unit-wise, overall).

## What the user does

1. The user opens the user menu and clicks Templates → they see a list of their templates with "+ Add template". With no templates yet, they see an empty state with the same button.
2. They click "+ Add template", type the template name, pick the language (Hindi or English), upload the HTML layout file and click Save → the template shows in the list with its name, language and file name. Below the name, in the same row, all its placeholder names show in small blue text (for example `officer · department · work_name · rate · date`), or "No placeholders" when the HTML has none.
3. From a template's menu they pick View → the HTML layout opens in a new tab, as it is, with the `{{placeholders}}` still in it.
4. From a template's menu they pick Edit → they can change the name or the language, or replace the HTML file, then save.
5. From a template's menu they pick Delete → it asks "Delete this template?" first, then the template leaves the list.

## What we save or produce

- A template: its name, language, owner and dates.
- One HTML file per template, with its file name and size.
- Delete only hides the template (marks it as removed). It stays in the database, as with companies.
- The placeholders are not typed in by anyone. They are read from the HTML whenever needed. Each template can have a different number of them, and in Round 5 the form gets one box per placeholder, named after the placeholder.

## Rules

- The layout must be an `.html` (or `.htm`) file saved as UTF-8 text (the normal way to save Hindi text), and at most 2 MB (the same as v2).
- A user sees only their own templates. Someone else's template answers "not found" (404), never "forbidden".
- Only name, language and HTML. No PDF, no rate basis, no units, overall or items.
- v2 required `{{rate_table}}` in the HTML. We don't, because there is no rate table in this app.
- An HTML file with no `{{placeholders}}` at all is allowed.
- The name is required. The language starts on Hindi in the Add form.
- Each placeholder name is shown once, even if it appears twice in the HTML (like `work_name`).
- No ready-made sample templates come with the app. The owner uploads them later.

## When something goes wrong

| What happens                      | What the user sees                                                            |
| --------------------------------- | ----------------------------------------------------------------------------- |
| The file is not .html             | "Upload the layout as an HTML file (.html)."                                  |
| The file is empty                 | "The HTML layout is empty."                                                   |
| The file is bigger than 2 MB      | "An HTML layout must be at most 2 MB."                                        |
| The file is not UTF-8 text        | "Save the HTML layout as UTF-8 text."                                         |
| The template isn't theirs or gone | "Template not found"                                                          |
| Save, upload or delete fails      | A red toast (small pop-up message): "Something went wrong, please try again." |

## Not in this feature

- Fonts (Round 4, next).
- The Template dropdown, the placeholder form and the live preview (Round 5).
- Template PDF, rate basis, rate table.
- Editing the HTML inside the app; sharing templates between users.

## Questions

- If a tender uses a template that is later deleted: decided in Round 5.

## Done when

- [ ] In the browser, user menu → Templates shows the list (or the empty state).
- [ ] Adding a template with a name, Hindi and an HTML file shows it in the list, with its placeholder names in small blue text below the name.
- [ ] View opens the uploaded HTML in a new tab.
- [ ] Editing changes the name and language, and replacing the HTML file works.
- [ ] Delete asks first, then the template leaves the list.
- [ ] Uploading a PDF, an empty file or a file over 2 MB shows the right message.
- [ ] A second Google account doesn't see the first account's templates.
- [ ] An automated test proves that another user's template answers 404.
