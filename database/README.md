# Database Files

This repository should contain schema migrations and sanitized seed data only.

Do not commit full database dumps from local, staging, or production. Full dumps can include:

- user password hashes and session tokens
- login, activity, and security logs
- citizen names, phone numbers, incident reports, and uploaded file paths
- ThaiID-related identifiers or hashes

Use `database/dumps/` for local-only dump files. That directory is ignored by git.

Recommended layout:

- `database/*.sql`: small schema or migration scripts safe for review
- `migrations/*.sql`: incremental schema changes
- `sql/*.sql`: sanitized lookup/reference seed data
- `database/dumps/*.sql`: local full dumps, never committed

Before adding any SQL seed to git, remove or replace operational data from tables such as `officer`, `user_sessions`, `activity_logs`, `security_logs`, `login_attempts`, `citizens`, and `public_incident_reports`.
