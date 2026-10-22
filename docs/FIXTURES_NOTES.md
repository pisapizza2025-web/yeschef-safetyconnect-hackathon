# Fixtures: how Csenge's files map to the app

Files: `data/demo-fixtures.json` (from demo-fixtures_v1.json) and `data/external-providers.json` (from external-providers(3).json). Both were parsed as valid JSON and loaded in the tests.

## What the app reads

| In the file | Used for |
|---|---|
| `sites[].label` (or `name`) | site names |
| `procedures[]` (`siteId`, `category`, `title`, `version`, `body`, `sourceLabel`) | the Sources panel; `sourceLabel` is shown under the title |
| `procedures[].config.fridgeMaxC`, `config.cookingCoreMinC` | the site's reading limits (Demo Kitchen A fridge 5, B fridge 8, cooking 75). Falls back to labelled defaults 8 and 75 only if absent |
| `procedures[].config.requiredCookingRecordsPerDay` | default number of required records (4) |
| `suppliers[]` (`siteId`, `name`, `serviceTags`, `phone`, `email`, `isFictional`, `sourceLabel`) | a supplier is matched by tag per site: `refrigeration` for fridge incidents, `food-supplier` for allergen incidents |
| `scenarios[]` (`type`, `title`, `description`, `reportedFacts`, `records`) | the starter cards and the prefilled report form (reading 9 and "unknown" exposure, 68 for cooking, four required records with the two recorded rows and their item names) |
| `communityHelpers[]` (`id`, `displayName`, `credentialsStatus`, `availabilityLabel`) | the four helper identities under "Acting as", always shown as self-declared |
| `knowledgeCards[]` (`summary`) | one example card on the Learning page, labelled "Demo example (fictional)" |
| external file `results[]` with `source` = `external_business` | provider cards on a Site B fridge case |
| external file `results[]` with `source` = `external_search_link` | the two search links, exactly as given |
| external file `meta.retrievedAt` | the snapshot time (shown in London time) |

## What the app ignores (by design)

`meta` (including `keyStyle`: the app has no snake_case database, its keys stay camelCase), `assets`, `communityMessages` (the seeded helper replies point at the placeholder case `scn-fridge`, which does not exist in the app; helpers write live messages), `knowledgeCards` fields other than the summary (`approvedBy` and `siteId` name a venue, which a redacted card must not show), `suppliers[].status`, `contractNote`, `contactName`, scenario fields `missingInformation`, `expectedOutcome`, `guardrails`, `priority`, `siteIdSuggestions`, `assetId`, and each provider's `verification`, `availability`, `availabilityNote`, `selectedByHuman`.

## About `assetId` and "assetIdBySite"

The Grok Bot note says to take the fridge from `assetIdBySite[siteId]`. That key does not exist in the file that was sent. The scenario's `assetId` points to Demo Kitchen A's fridge even for Demo Kitchen B, so using it would borrow Site A's supplier at Site B. The app does not use assets at all: suppliers are matched by service tag within the case's own site, so Site B can never get ColdLine.

## Things to check by hand

1. The four providers' phone numbers, emails and links against their own pages (London HVAC Pro lists two numbers).
2. Chef Cool is a weaker match (the page names Fulham, not W6). The card shows Csenge's own reasoning.
3. Helper names are long (for example "DEMO Priya, sous chef (fictional)"). Check they fit the header at phone width.
