# Import, export and backup

Administrators use **Manage → Import, export and backups**.

## CSV

Export any collection to CSV, including boys, mentors, program types, dated programs, attendance, invitations, calendar, site wording/settings, and portal access. CSV opens in Excel or Google Sheets. Export IDs are preserved. Download the matching blank template for new records. Use IDs from mentor/program exports for relationships. Empty IDs generate new UUIDs; site wording and settings require explicit IDs.

Imports validate in PostgreSQL during preview without committing changes. The preview shows new/existing record counts and sample rows. Apply creates a full server backup before committing all record changes in one transaction. If records changed since preview, a fresh preview is required. Import request IDs prevent duplicate retries.

CSV uses quoted UTF-8 cells and protects spreadsheet formula-like values with an apostrophe. The importer removes that added prefix when re-importing. Use ZIP backups to preserve every metadata field; CSV contains the documented columns only.

## Backups

Daily cron is `0 2 * * *` UTC, approximately 07:30–08:30 India time on Vercel Hobby. Its endpoint requires `CRON_SECRET`. The server-only dedicated-project secret key is used for private backup storage. Never expose either credential to browser code.

A backup captures all mentoring records and access entries in a single database snapshot, then copies each file into the private `mentoring-backups` bucket. Each snapshot has independent file copies. Copy failures are shown as failed/incomplete, not successful. Duplicate daily cron deliveries reuse the day's backup. A failed daily backup can be retried by creating a manual backup.

The history shows the latest 100 backups. Backups are retained; no automatic deletion is performed. Monitor Supabase storage usage. Download a ZIP to retain a copy independent of the Supabase project. A database-project deletion also removes backups stored inside that project.

ZIP downloads contain `backup.json` and a `files/` directory with SHA-256 checksums. Records, original source metadata and portal permissions are covered. Supabase Auth passwords, sessions, OAuth/SMTP settings, source migration archives, and application secrets are not included. These application backups do not replace provider-level disaster recovery.

## Restore

Select a downloaded ZIP/JSON, or Preview restore beside a completed server backup. Restore merges by ID: matching records are updated, missing records are recreated, and newer records absent from the backup are retained. This is deliberately not a destructive replacement of the whole database. A restore cannot remove the acting administrator's own access.

Records restore transactionally. Files restore afterward and are resumable: existing identical files are skipped; different content at the same path is rejected without overwriting. If file restore fails, the UI explicitly reports that records were saved and lets the administrator retry to resume. File changes are not part of the database transaction.

Limits: 5,000 records and 500 access entries per import, 3 MB JSON request, 100 MB browser ZIP download/restore, 4 MB per attachment. A complete server backup can exceed the browser limit. Large imports should use smaller CSV batches or an owner-run migration.
