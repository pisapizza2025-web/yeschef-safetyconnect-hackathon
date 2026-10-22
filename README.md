# Yes Chef SafetyConnect (hackathon demo)

An isolated demo app for the SafetyConnect hackathon (Thursday 22 October 2026, Expedite London HQ).
It shows one real workflow end to end:

**report an incident, check the site's own procedure and suppliers first, fall back to an honest external search, let a person record the action, and keep the evidence.**

- Demo data only. No connection to production Yes Chef, no real customer data.
- Nothing is invented: no phone numbers, no availability, no bookings, no safety approvals.
- Four incident types share one workflow: **fridge temperature**, **allergen information**, **cooking temperature**, **missing records**.

## Run it

Needs Node 20 or later.

```
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

```
npm test                 # 32 logic tests (T01 to T11, fixtures adapter, external providers, evidence chain)
npm run typecheck
npm run build && npm start   # production mode
BASE_URL=http://localhost:3000 npm run acceptance   # T01 to T12 over real HTTP (see note)
```

The acceptance script creates demo cases in the app it points at. Use a scratch instance (`DATA_DIR` set to an empty folder) or delete `data/db.json` afterwards.

## Three-minute click path

1. **Cases**: under "Walk-in fridge reading 9°C" press **Start at Demo Kitchen A**, then **Submit report**. The case shows the site procedure and the known contractor, each labelled **Internal**.
2. Back on Cases, start the same incident at **Demo Kitchen B**. No supplier is on file, so the case shows an **External** web-search handoff and says nothing is booked.
3. On a case, press **Use** on a suggested action, edit it, press **Record action**, then refresh. The action stays, with who and when.
4. Switch **Acting as** to *Demo Helper Sam* and add a message. The helper is shown as self-declared.
5. Run the allergen, cooking (add a recheck: the first reading stays) and missing-records cards.
6. As *Demo Manager*, open a case, **Prepare learning card**, then **Approve for community**. It appears under **Learning**, with names and contact details removed.

Full script: `docs/DEMO_SCRIPT.md`.

## Fixtures (Grok Bot / Csenge)

Two files in `data/`:

- `demo-fixtures.json`: sites, procedures (with site limits in `config`), suppliers, scenarios, community helpers, one example learning card. The loader accepts both the plan's shape and this richer shape (see `docs/FIXTURES_NOTES.md` for the key mapping and the keys that are ignored).
- `external-providers.json`: a research snapshot of real refrigeration businesses near W6 0DA, shown only on a case at a site with no internal supplier (Demo Kitchen B). Contact details are shown character for character, with the snapshot time and "nobody contacted, availability not confirmed".

`demo-fixtures.builtin.json` is the earlier built-in demo set, kept as a fallback (`FIXTURES_FILE=data/demo-fixtures.builtin.json`).

Restart the app after changing a file. Never put invented phone numbers in `phone` or `email`: leave them `null`.

## Live AI (optional, off by default)

Copy `.env.example` to `.env.local` and set **both** `XAI_API_KEY` and `XAI_MODEL`. The rules always decide the suggested actions. With a key, the app also asks the model for a short comment, shown as **Live AI comment**. If the call fails, times out or the comment claims safety, the app falls back to **Demo rules** and says so. **The live call has not been tested against the real API (NOT VERIFIED).** Without a key the app never claims to use Grok.

## Where data lives, and deploying

Events are stored in `data/db.json` (append-only, hash-chained). That needs a writable, persistent disk:

- **Local run (the backup plan):** works as is.
- **Vercel and similar serverless hosts:** the disk is not persistent, so cases would vanish. Do not rely on it.
- **A host with a persistent disk (Railway, Render, Fly or a small VM):** set `DATA_DIR` to the mounted volume. Deployment was not tested (NOT VERIFIED).

## Truthful disclosure (copy into the submission)

- The base application was generated with Claude (chat) and imported into the repo on the evening of the hack, then reviewed and continued by the team. Its tests were run in the same session: see `docs/ACCEPTANCE.md` for what was and was not verified.
- The app runs **demo rules**, not a live model, unless the team sets the AI variables and verifies the call.
- All sites, procedures, suppliers and helpers are fictional demo data. The external option is a plain web search and does not know availability.
- Grok Bot is a separate application. Its actual contribution goes in `docs/AI_WORKFLOW.md`, written by the person who ran it.
- Whether the event allows importing AI-generated code is NOT VERIFIED: check the event rules and disclose it.

## What it deliberately does not do

Email connectors, scheduling, push notifications, multi-site administration, a service directory, vector search, analytics. See `ARCHITECTURE.md`.
