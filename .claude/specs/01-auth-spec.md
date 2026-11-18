# Spec 01: Sign in with Google + sidebar shell

Status: planned · 2026-11-18

## Goal

A contractor signs in with their Google account and gets the app frame: a sidebar with their tenders, search, "+ New tender" and a user menu. Each contractor sees only their own tenders. We need this first because every later round (companies, editor, PDF) hangs off a signed-in user and a tender. The working sign-in and shell from `tender-chat-v2` are copied and trimmed to Google only.

## What the user does

1. The user opens the app while signed out → they land on the login page with one button, "Continue with Google".
2. They click it and pick their Google account → they come back to the home page, signed in.
3. The home page has no tenders yet → they see an empty state with a "New tender" button.
4. They click "+ New tender" in the sidebar and type a name → the tender is created, appears in the sidebar and opens (for now an empty editor page).
5. They type in the sidebar search box → the list shows only tenders whose name matches.
6. From a tender's menu in the sidebar they pick Rename or Delete → rename changes the name in the list; delete asks "Delete this tender?" first, then removes it.
7. They click their photo (only the round user icon) at the bottom of the sidebar → the menu shows their name and email, then Companies, Templates and Sign out. Companies and Templates open empty pages for now.
8. They click Sign out → they are back on the login page.

## What we save or produce

- The user: name, email and photo from Google.
- The session (the login cookie), so they stay signed in between visits.
- A tender: name, owner, dates. The editor fields (type, company, layout, font, values) come in Round 4.

## Rules

- Every page except the login page needs the user to be signed in.
- A user sees only their own tenders. Someone else's tender answers "not found" (404), never "forbidden".
- Search matches the tender name only.
- Only Google sign-in. No password.

## When something goes wrong

| What happens                                          | What the user sees                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| They cancel the Google screen or Google fails         | Back on the login page: "Couldn't sign in, please try again."                 |
| Their login expires                                   | They are sent to the login page                                               |
| They open a tender that doesn't exist or isn't theirs | "Tender not found"                                                            |
| Create, rename or delete fails on the server          | A red toast (small pop-up message): "Something went wrong, please try again." |

## Not in this feature

- Email/password sign-in, signup, forgot/reset password, verify email.
- Sending any email.
- Admin or team accounts, sharing tenders.
- A profile page (name and email show in the user menu instead).
- Companies (Round 2) and anything inside the editor (Rounds 3–6).
- v2's steps bar and templates page.

## Questions

- How long should a login last? Suggest the same as v2 (Better Auth's default, 7 days).
- Can anyone with a Google account sign in, or only certain emails? Suggest anyone, as in v2.
- Is a tender name required, or should an empty name become "Untitled tender"? Suggest the v2 dialog as it is.

## Done when

- [ ] In the browser, opening `/` while signed out shows the login page.
- [ ] "Continue with Google" signs in and shows the home page with the empty state.
- [ ] "+ New tender" creates a tender that shows in the sidebar and opens.
- [ ] Search, rename and delete (with the confirm) work in the sidebar.
- [ ] The sidebar shows only the user icon; its menu shows name and email, Companies, Templates and Sign out; Sign out returns to the login page.
- [ ] A second Google account doesn't see the first account's tenders, and opening one of them by its link shows "Tender not found".
- [ ] An automated test proves that another user's tender answers 404.
