# Original Warangal Mentoring Hub — Vercel copy

Based on original ChatGPT Site version 12. The original Site and its backend are unchanged.

## Existing backend — do not replace

Use the original Hub spreadsheet already linked to your ChatGPT website.

Use the Apps Script URL and private token already used by the ORIGINAL Warangal Mentoring Hub. Do not use the separate Mentoring Plus backend or its key. There is no spreadsheet creation, migration or data import in this deployment. Existing Portal Access authorization is preserved for Google sign-in users.

## Vercel environment settings

Add these in Production, then redeploy:

| Key | Type | Value |
| --- | --- | --- |
| AUTH_GOOGLE_ID | Config | Reuse the Google client ID already configured for Mentoring Plus |
| AUTH_GOOGLE_SECRET | Secret | Matching Google OAuth client secret |
| AUTH_SECRET | Secret | New random 32-byte or longer session secret |
| MENTORING_SHEETS_URL | Config | ORIGINAL Hub Apps Script Web app URL ending in /exec |
| MENTORING_SHEETS_TOKEN | Secret | ORIGINAL Hub Apps Script private connection token |

Add the Vercel site's exact `/api/auth/callback/google` URL to the existing Google OAuth client's authorized redirect URIs; keep the existing Plus callback. Open the stable Vercel URL to sign in. Do not paste secrets into chats or commit them in source.

## Development

Node.js 22 or newer. `npm ci`, `npm run build`, `npm start`. Google login remains locked until configured. The server validates Google sessions and the existing spreadsheet allowlist; client-supplied identity headers grant no access.

## Connection behavior

Refreshes do not overlap, pause when hidden, and run at least 30 seconds apart. Temporary read errors get one retry. Writes are never automatically repeated. Google redirects remain restricted to script.googleusercontent.com. Backend requests have bounded timeouts.

Both hosts share records through the existing Sheet. Code updates must be deployed to each host separately. No Google records, credentials, or private data are bundled here.

Optional: set MENTORING_SPREADSHEET_URL to the existing spreadsheet edit URL to enable authenticated calendar/settings shortcuts. The URL is never embedded in public page source.

## Backup, daily RC and weekly programs

The portal includes three new tabs:

- **Export / Backup** downloads a fresh JSON snapshot of all portal collections, with a format version and export timestamp. It excludes credentials, the Portal Access allowlist and spreadsheet-only columns (for example DOB/Native). This is a portal-data backup, not a complete workbook archive. Restore/import is not implemented.
- **RC Chanting** provides a selectable month, every boy and every calendar day. Statuses are Present, Absent, MMC (heard audio) and Outstation. Not marked clears a record. Future dates are disabled. Search, mentor and participation filters help find boys needing follow-up.
- **Weekly Programs** adds a topic, date and optional venue for each session, with independent Present/Absent attendance. A boy may attend multiple weekly programs without triggering DYS's one-credit-per-type restriction.

RC summaries count marked dates through today in the selected month, using India time. Present and MMC count as participation; Outstation and unmarked dates are excluded from the rate. Regular requires at least seven marked participation/absence days and a rate of 80% or more. Below 80% with an absence means Needs attention. Missing entries remain visible as unmarked, never assumed absent.

### Deploy this update

1. Replace the code in the **existing original Hub Apps Script project** with `apps-script/Code.gs`. Keep its script properties, token and original spreadsheet ID.
2. In Apps Script, choose Deploy > Manage deployments > Edit the existing Web app deployment > New version > Deploy. Keep the same `/exec` URL. Do not create a replacement spreadsheet.
3. Deploy this Next.js source using the existing Vercel project and environment settings. The application root remains this `src` directory.
4. Sign in with an approved account. Record an RC entry, add a weekly program and mark attendance; refresh to verify persistence. Download a backup and inspect the JSON.

The script creates **RC Attendance**, **Weekly Programs** and **Weekly Attendance** on their first respective writes. Existing spreadsheet tabs are preserved. New reads work with older deployments; new writes are blocked until the backend advertises `daily-weekly-v1`. Existing authentication and approved-account access apply to these features.

Validation: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`.
