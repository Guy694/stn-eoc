# Backup and Recovery Runbook

## Scope

The backup contains all MySQL base-table schemas and rows. With
`--include-files`, it also contains files under `public/uploads`, together with
an SHA-256 checksum for every file. The complete backup is encrypted with
AES-256-GCM and a checksum sidecar is written next to it.

## Required secret

Set `BACKUP_ENCRYPTION_KEY` through the deployment secret manager. It must be at
least 16 characters and must not be committed to the repository. Losing the key
makes the backup unrecoverable.

## Create a backup

```bash
npm run backup:eoc -- --output /secure-backups/stn-eoc/eoc.backup --include-files
```

Copy both `eoc.backup` and `eoc.backup.sha256` to encrypted off-site storage.
Do not keep the only copy on the application host.

## Restore test

```bash
npm run restore:test -- --input /secure-backups/stn-eoc/eoc.backup
```

The test creates a uniquely named `stneoc_restore_test_*` database, restores
every table, compares row counts, restores files into a temporary directory,
checks all file checksums, then removes both temporary targets. A backup is not
considered ready until this command reports `restore_verified: true`.

## Retention

- Daily: 14 days
- Weekly: 8 weeks
- Monthly: 12 months
- Incident-close backup: 5 years, subject to the agency records policy

Run a restore test at least monthly and after every schema or backup-script
change. Alert the system administrator when backup creation or restore
verification fails. Store execution results in the operational monitoring
system; `backup_runs` is available for a scheduler integration and must never
be marked `restore_verified` without a successful restore command.

