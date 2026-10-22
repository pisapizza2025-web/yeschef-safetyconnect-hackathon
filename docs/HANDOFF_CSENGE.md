# Handoff for Csenge (fixtures, QA, submission)

## Fixtures
Edit or replace `data/demo-fixtures.json` and send it to Csaba. The app accepts exactly the shape from the plan:

```
sites       [{ id, label, city, country, timezone, settings? }]
procedures  [{ siteId, category, title, version, body }]      category: fridge | allergen | cooking | records
suppliers   [{ siteId, name, serviceTags, phone, email, isFictional, source? }]
scenarios   [{ type, title, reportedFacts, starter? }]
helpers     [{ id, name, note }]                              optional
```

Rules: keep it clearly fictional and labelled DEMO. `phone` and `email` stay `null` unless a real, sourced contact exists. If a real company is used, cite its source and set `isFictional` to false. Site A needs a refrigeration supplier; Site B must have none.

## Manual QA (what the scripts cannot check)
Run T01 to T12 in a real browser and on a phone width. See `docs/ACCEPTANCE.md` for the list of items marked NOT VERIFIED. Record PASS, FAIL or NOT VERIFIED from what you actually ran.

## External search check
The "Find a provider" links are plain Google web and map searches built from the site city. Open them, check the results are relevant for the event area, and write down the real URL and what you saw. To aim the search elsewhere set `SEARCH_NEAR` (for example `London W6`).

## Bug report format
Site, incident type, who you acted as, what you did, what you expected, what happened, screenshot.
