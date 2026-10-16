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
