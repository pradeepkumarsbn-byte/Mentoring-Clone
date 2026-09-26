# Backend repair

## Hostel Coverage Map

The app now includes a Map tab, derived entirely from existing Boys records. `app/hostel-map.ts` owns floor/room configuration, normalization, ID deduplication and coverage calculations; `app/hostel-map-view.tsx` renders the layout and room details; `app/hostel-fields.tsx` supplies the shared Add/Edit controls. `page.tsx`, `bridge-state.ts`, and the API carry the optional `floor` field through the existing data flow.

The existing room value remains in `Hostel Name` (internally `hostel`); no second room field was created. A new `Floor` header was added at `Boys!O1` on the connected spreadsheet, with matching header formatting. No existing row values were changed and no floor was inferred. Other installations must append one `Floor` column to their Boys header before deploying this version.

Deploy the updated `Code.private.gs` using the existing deployment, as described below. It advertises `boy-floor-v1` in its capabilities. The app rejects boy saves to older backends instead of silently losing floor information. Other actions retain the previous backend compatibility check.

All registered boys count, including Dropped boys. Dropped registrations retain their room and are explicitly labelled in the map and room details. Unique student IDs are counted once; conflicting copies are flagged as unmapped. Missing/invalid floor or room data stays unmapped. Counts of 0, 1, 2 and >2 produce Not covered, Partial, Full and Data issue respectively. Coverage caps each room at two places. No coverage status is stored and no per-room requests are made.

Existing out-of-range room values remain available in Edit as an existing-value option, so unrelated edits preserve them. Assigning a new floor requires a valid room (1–61). The map updates from every successful refresh/save. Its room details link directly to the existing boy profile for correction.

The supplied script had two `doPost` functions. The later function replaced the correct handler, appended values without IDs in the wrong column order, and searched for a nonexistent `id` header. It also appended duplicate attendance/invitation rows and cleared website-content metadata.

`Code.gs` is the maintained, credential-free source. It reads `MENTORING_SHEETS_TOKEN` and `MENTORING_SPREADSHEET_ID` from Apps Script Properties.

`Code.private.gs` is a locally generated, git-ignored, ready-to-paste version with the existing configuration preserved. Do not publish or commit it.

## Deploy the correction

1. Open the existing Apps Script project. Replace the entire old server script with `Code.private.gs`. Remove any other duplicate `doPost` handlers; do not append this file to the old code.
2. Save. Select **Deploy → Manage deployments → Edit** on the existing web app. Select **New version**, then **Deploy**. Keep the existing deployment and `/exec` URL, token, and access configuration.
3. Refresh the dashboard. The server checks `backendVersion` in the authenticated access response and enables writes when the repaired version is active.
4. Run `node --env-file=.env.local --experimental-strip-types check-connection.mjs` from the app folder to check `get_state` without changing spreadsheet records.

The local app deliberately rejects writes to the known-broken legacy backend. Local code changes cannot update a published Apps Script deployment.

## Validation and limits

`npm test` includes simulated-sheet tests for program creation, editing, deletion and related-record cleanup; reordered headers; boy updates; attendance/invitation upserts and deletion; blank website-content rows; missing columns; invalid dates; and Room No aliases. Tests do not write to the live spreadsheet.

Writes use a script lock and named columns. Updates preserve unrelated fields and formulas. Parent existence and dependent schemas are checked before deletion. Google Sheets has no transaction spanning these operations: service failures may still interrupt a save. Writes are never automatically replayed, because a timed-out request may already have saved. No network request can be guaranteed never to fail.

Google deployment instructions: https://developers.google.com/apps-script/concepts/deployments

## Save performance update

Deploy `Code.gs` to the existing Apps Script web app after preserving the existing `MENTORING_SHEETS_TOKEN` and `MENTORING_SPREADSHEET_ID` Script Properties. The app now sends authorization and the operation together; this backend checks the current allowlist and admin role, then returns confirmed state in one round trip. Older backends remain supported through the original two-call path. Combined writes are never retried or coalesced.

The workbook is opened once per execution, table reads are reused during validation, and adjacent changed cells are written in blocks without overwriting intervening formulas. Reads are refreshed after writes. No spreadsheet migration is required. Actual save latency must be measured after both deployments; no production timing is claimed by the simulated tests.
