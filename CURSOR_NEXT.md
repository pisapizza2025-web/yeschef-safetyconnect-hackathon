# Prompt for Cursor (paste this)

You are continuing an existing, tested Next.js and TypeScript app: Yes Chef SafetyConnect, an isolated hackathon demo. Do not rewrite it.

1. Read README.md, ARCHITECTURE.md and docs/ACCEPTANCE.md completely. Check the actual repository and what runs on this machine before acting.
2. Run `npm install`, `npm test`, `npm run typecheck` and `npm run build`. Report the real results.
3. Start the app and open it in a browser. Walk the click path in README.md. Fix only real defects you find, with the smallest change. Keep one stylesheet and the existing shared components. Do not change wording or layout beyond what a fix needs.
4. Mobile pass: check the Cases page, Report Issue and a case page at phone width. Fix overflow only.
5. When Csenge's demo-fixtures.json arrives, replace data/demo-fixtures.json, restart, and rerun `npm test` and `BASE_URL=... npm run acceptance` against a scratch instance (set DATA_DIR to an empty folder).
6. Only if genuine API credentials exist, set XAI_API_KEY and XAI_MODEL in .env.local, create a fridge case, and confirm a "Live AI comment" appears. If it does not work within 10 minutes, leave the app in demo-rules mode and say so.
7. Deploy only to a host with a persistent disk and set DATA_DIR. Keep the local run as the backup.
8. Do not add integrations, do not touch production Yes Chef, do not invent data, contact details or claims. Stop feature work at 21:30. Use bounded timeouts on every command.
9. Return real test evidence and the demo instructions.
