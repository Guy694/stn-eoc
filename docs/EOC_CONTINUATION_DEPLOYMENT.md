# EOC continuation deployment

## Before deployment

1. Back up the database and uploaded files with the existing backup command.
2. Run `migrations/reconcile_eoc_team_registry.sql` in a transaction-capable maintenance window.
3. Review the result set. Referenced legacy teams are intentionally not deactivated.
4. Confirm that all required active team codes exist in `eoc_teams`.
5. Run `npm test -- --runInBand`, `npm run lint`, and `npm run build`.

## Functional checks

- Open `/api/health` and confirm HTTP 200.
- Create a test Session and call its `/api/admin/eoc-sessions/{id}/readiness` endpoint.
- Apply a team template through `/api/admin/eoc-sessions/{id}/template`.
- Create a draft report, confirm its completeness percentage, and verify that incomplete reports cannot be submitted.
- Complete the `draft → submitted → verified → approved` workflow.
- Confirm that returning a report without a reason is rejected.
- Sign in with a non-privileged team member and confirm Analytics lists only assigned active teams.
- Confirm AI Analytics requires an authenticated staff-equivalent session.

## Rollback

- Application rollback: deploy the previous saved application version.
- Registry migration rollback for unused legacy teams:

```sql
UPDATE eoc_teams
SET is_active = 1
WHERE team_code IN ('MCAT', 'MEDICAL', 'SHELTER');
```

- No report payload migration is required. Existing JSON payloads remain readable; stricter validation is applied only when a report is created, updated, or submitted.
- If a template was applied accidentally, deactivate only the explicit `eoc_session_teams` rows created by that request after confirming they contain no reports or operational records. Do not delete a Session as a rollback shortcut.
