# Mentoring database migration

Target: dedicated project `uqieusxmgbyxayhoclkk`. The main ISKCON project's Supabase settings are not used.

## Current status

Production switched to `MENTORING_BACKEND=supabase` on 2026-09-28. All 92 boys, 11 programs, 27 attendance entries, 32 invitations, 77 calendar events, 8 mentors, 9 program types, 39 content values, 43 settings and 12 access entries were imported and compared exactly. The initial administrator password is stored only in the owner's local `.env` under `MENTORING_INITIAL_ADMIN_PASSWORD`.

The private source files live in `.migration-private/`, excluded from Git. The import preserves source fields in each record's `sourceRow`, plus all 15 raw worksheet tabs in a private database snapshot. Rows containing only unused IDs remain in that snapshot rather than appearing as empty people or sessions. Section/timetable and spreadsheet formula outputs are archived; the existing website's reports continue to calculate from its records. The original spreadsheet remains intact.

## Setup and cutover

1. Put this project's URL and publishable key into `MENTORING_SUPABASE_URL` and `MENTORING_SUPABASE_PUBLISHABLE_KEY`. Keep `MENTORING_DATABASE_URL` local. It must be the dedicated project's PostgreSQL or session-pooler connection string with a URL-encoded database password. Do not use the main website's credentials.
2. Enable Email authentication with email confirmation. Set the Supabase Site URL to https://mentoring-clone-map.vercel.app and allow /auth/callback and /auth/callback?next=password on that domain as redirect URLs. Configure SMTP for production confirmation and reset emails. Approved users choose First time? Create password, confirm their email, then sign in. Creating an Auth account alone grants no record access. Google provider configuration is not required. For local verification allow the equivalent localhost callback URLs and set MENTORING_SITE_URL=http://localhost:3000.
3. Arrange a brief period with no website or spreadsheet edits. Refresh both source snapshots immediately before import. Do not reuse an old snapshot after intervening edits.
4. From this app directory, run `node scripts/import-supabase.mjs ../../../../.env` for a local audit, then append `--import` to migrate. The tool checks the exact target, refuses a nonempty target, validates relationships, applies schema and data in one transaction, and compares every stored record and access entry before committing. On failure it rolls back. It never prints names, passwords, tokens, or record contents.
5. Test the Supabase mode locally using an approved email/password account: overview counts, program/people filters, profile save and reload, drop/room retention, attendance/undo, invitation eligibility/response/undo, calendar, website text/theme, and admin access. Test file upload/download/delete with a temporary profile, then remove the test data. Confirm a nonapproved account cannot read records.
6. Add only `MENTORING_BACKEND=supabase`, `MENTORING_SITE_URL`, `MENTORING_SUPABASE_URL`, and `MENTORING_SUPABASE_PUBLISHABLE_KEY` to the Mentoring Vercel project. Do not deploy database passwords or secret API keys; normal requests use the signed-in user's permissions. Run tests and production build, deploy, verify email/password sign-in and counts, and then resume edits on the website.

## Preserved behaviour

- All existing dashboard, mentor summary, profile, hostel-map, calendar, program, attendance, invitation, website content and theme views continue using the same data shape.
- Dropped boys retain their floor/room and registration. Present/Late attendance remains excluded from the corresponding invitation eligibility list.
- Saves use a single database transaction and return only changed records; they do not fetch the entire spreadsheet after every edit. The dashboard still refreshes periodically for other users' changes.
- Approved users have the same shared record access as before. Only administrators can manage access, mentors, program types, calendar and settings. The final active administrator cannot be removed.
- Files are in a private bucket. Approved users receive short-lived download links. A profile with attachments cannot be deleted until the files are removed; marking it Dropped keeps everything.

## Rollback

Before any Supabase edits, set `MENTORING_BACKEND=sheets` and redeploy to return to the unchanged source. After new Supabase edits, first export and reconcile those changes; switching to the old spreadsheet directly would show stale records. Sheets is an original-source backup, not a live mirror of Supabase.

## Validation

All 64 automated tests passed and the Vercel production build succeeded. Live checks passed for password login, approved dashboard/admin reads, denial of anonymous reads, dropping with room retention, record creation/deletion, and private file upload/list/download/deletion. Temporary verification data was removed. One live dashboard request took 1.9 seconds and a save took 0.77 seconds; these are individual measurements, not guarantees. Email confirmation/recovery delivery and its redirect settings still need provider configuration and end-to-end verification before other mentors self-register.
