# Acceptance sweep T01 to T12

Status below is only what was actually executed on 22 Oct 2026 (about 19:20 to 20:40 London time, Windows, Node 24). Everything else is marked NOT VERIFIED. Rerun on the team's own machines before submitting.

How it was run (final run, after the last code change):
- **Logic tests:** `npm test`: 35 tests, all passed (the architect's 32 plus 3 added: provider names, shortened names and non-http links), with Csenge's real fixture files. `npm run typecheck` and `npm run build`: no errors.
- **HTTP sweep:** `npm run acceptance` against a scratch production instance (`next start` on port 3100, `DATA_DIR` set to an empty folder): 16 checks, all passed. Never run against the demo instance.
- **Real browser (headless Chrome, driven over the DevTools protocol, dev server):** the README click path was walked at 1280px: fridge at Demo Kitchen A (internal procedure and contractor), fridge at Demo Kitchen B (four external providers, search links, "Link opened" logging), "Use" then "Record action" then reload, Acting as a helper (cannot record actions, message shown as self-declared), allergen, cooking with recheck, missing records, close then reopen, prepare and approve a learning card. 9 of 10 checks passed. The tenth failed only because earlier test cards were already on the Learning page; the new card was redacted correctly.
- **Phone width (headless Chrome at 360px, emulated touch):** Cases and the Site B case page: no horizontal overflow after the header fix.
- **Defects found and fixed in this pass:** (1) provider names were not removed from a learning-card lesson; (2) a shortened helper or supplier name ("Priya") was not removed from a lesson; (3) the "Acting as" select was as wide as the longest helper name, so every page scrolled sideways on a phone.

| ID | Check | Result | How verified |
|---|---|---|---|
| T01 | Fridge incident at Site Alpha: case saved, report shown, internal procedure and known contractor shown | PASS | logic test and HTTP sweep |
| T02 | Same incident at Site Beta: no contractor borrowed from Alpha, external handoff shown | PASS | logic test and HTTP sweep |
| T03 | External option opens a real link only and claims no contact; supplier with no details shows none | PASS for the app's output. The `tel:` and `mailto:` buttons were never exercised on a device, because the demo supplier has no phone or email | logic test, HTTP sweep. Real device behaviour NOT VERIFIED |
| T04 | Manager action persists after a reload, with actor and time | PASS | logic test and HTTP sweep (a new request is the reload) |
| T05 | Helper message appears with the real actor; helper cannot record actions | PASS | logic test and HTTP sweep |
| T06 | Close then reopen keeps earlier actions and failed readings | PASS | logic test and HTTP sweep |
| T07 | Allergen case: no invented ingredients, no safety declaration | PASS | logic test and HTTP sweep |
| T08 | Cooking: failed reading is kept beside a passing recheck | PASS | logic test and HTTP sweep |
| T09 | Records: required 4, recorded 2 shows two rows and two anonymous missing slots | PASS | logic test and HTTP sweep |
| T10 | Learning: nothing is shared until approved, card is redacted, approval state visible | PASS | logic test and HTTP sweep |
| T11 | AI or network unavailable: labelled demo rules, app still usable | PASS for "not configured" and for a failing call (tested with an unreachable address). A real provider outage and the live call itself are NOT VERIFIED | logic test and HTTP sweep |
| T12 | Fresh browser or direct URL works without a hidden session | PASS over HTTP with no cookie. A real new browser or device is NOT VERIFIED | HTTP sweep |
| T13 | Site B lists the researched providers (names, numbers, emails, source links) exactly as in the file, with the snapshot label; Site A lists none | PASS | logic test and HTTP sweep |
| T13b | Allergen at Site A shows the known sauce supplier (no contact details) and no external options | PASS | logic test and HTTP sweep |
| EV | Evidence hash chain verifies after the sweep; tampering is detected | PASS | logic test and HTTP sweep |

## NOT VERIFIED (do these by hand before 21:30)

- Visual layout on a real phone and in other browsers. Only headless Chrome was used. The report form, the Learning page and the Report Issue page at phone width were measured only for overflow on Cases and the Site B case page.
- Phone-width tap targets: about 9 controls on Cases (and about 15 on the Site B case page) are 36px tall and the "i" buttons are 22px, below 44px. Left as a known limitation.
- The live Grok call (needs a real key and model name).
- Deployment to a host, and persistence on that host. Not attempted.
- `tel:` and `mailto:` buttons on a real device. The buttons exist for the four external providers; only their `href` values were checked, in headless Chrome and over HTTP. Nothing was dialled or sent.
- **The four provider entries against their own pages.** The app shows what the file says, character for character. Nobody has compared those numbers and emails with the live pages. Do it before showing them on stage, and remove any entry that differs. London HVAC Pro's page lists two numbers; the app shows the visible one (07427 826446) with the research note.
- Whether the two search links open usable results from the venue.
- Whether the event allows importing AI-generated code.

## Overall status

Every mandatory P0 behaviour passed the checks that were run. Overall status for the submission remains **NOT COMPLETE until the manual items above are checked** by the team.
