# Architecture

One small Next.js (App Router, TypeScript) app with a file-based, append-only event log. No database server, no external services required.

## Principles

1. **Internal first.** A report looks up this site's own procedure and suppliers before anything external.
2. **Honest fallback.** With no matching supplier, the only external option is a web search link. The app never says anyone was contacted, booked or available.
3. **People decide.** Suggested actions are suggestions. Nothing is recorded as done until a person records it.
4. **Evidence is append-only.** Every change is a new event. Nothing is edited or deleted. Each event stores the hash of the one before it, so tampering is detectable.
5. **Never claim safety.** Rules and the AI guard reject wording such as "safe to serve".

## Layout

```
data/demo-fixtures.json      sites, procedures, suppliers, scenarios, helpers (demo, fictional)
src/lib/types.ts             shared types, AppError
src/lib/fixtures.ts          validated fixture loader, demo actors, site settings
src/lib/store.ts             append-only event log (data/db.json), hash chain, verification
src/lib/rules.ts             deterministic rules per incident type, reading checks
src/lib/guards.ts            unsafe-claim filter, redaction, input cleaning
src/lib/assess.ts            rules always; optional live AI comment with fallback
src/lib/cases.ts             commands (create, action, message, recheck, close, reopen, learning) and the derived case view
src/lib/format.ts            timeline wording
src/app/api/*                JSON routes
src/app/*                    pages: Cases, Report Issue, case detail, Learning
src/components/*             shared UI (one stylesheet, chips, popovers, expandable lists)
tests/domain.test.ts         T01 to T11 and the evidence chain
scripts/acceptance.mjs       T01 to T12 over HTTP against a running app
```

## Event model

Every event: `seq`, `id`, `caseId`, `type`, `at`, `actor`, `data`, `prevHash`, `hash`.

Types: `case.created`, `source.internal`, `source.external`, `assessment.recorded`, `action.recorded`, `recheck.recorded`, `message.added`, `handoff.opened`, `case.closed`, `case.reopened`, `learning.requested`, `learning.approved`, `learning.rejected`.

The case view is derived by replaying that case's events. Closing and reopening only add events, so earlier actions and failed readings always stay.

## Roles (demo only, no sign-in)

The header lets the person pick who they act as. Every event records that actor.

| Role | Can |
|---|---|
| manager | everything, including close, reopen and learning cards |
| staff | report, record actions and rechecks, open provider links, message |
| helper (self-declared, unverified) | message only |

## Incident rules (demo values, not food safety advice)

| Type | Check | Notes |
|---|---|---|
| fridge | reading above the site's `fridgeMaxC` (default 8) | unknown exposure time adds a caution; supplier lookup by tag `refrigeration` |
| cooking | reading below `cookingMinC` (default 75) | a recheck is a new reading, the first stays |
| allergen | always "unverified" without ingredient information | an unnamed product is never given a name |
| records | missing = required minus entered | missing slots are anonymous |

## Learning cards

Opt-in by a manager. The card is built from generic templates plus the categories of recorded actions. An optional lesson is redacted (emails, links, numbers, venue, people and supplier names). A card is shown on the Learning page only after approval.

## Known limits

Single file store (one process), no authentication, no email or calendar connectors, deployment needs a persistent disk, the live AI call is untested.
