# EOC Staff, Reporting, and Flood Daily Architecture

## Sources of truth

| Concern | Source |
|---|---|
| EOC lifecycle | `eoc_sessions` |
| Enabled teams per session | `eoc_session_teams` |
| Officer membership | `eoc_team_members` |
| Team reporting workflow | `eoc_team_reports` |
| Flood operational records | `flood_records` |
| Mission tracking | `missions` |
| Meeting records | `meeting_notes` |
| Command decisions | `decision_logs` |
| District/tambon/village geography | `satun_village_polygon` |
| District population denominators | `area_population` |
| Hazard susceptibility profiles | `area_risk_profiles` |
| Managed file metadata | `eoc_file_assets` |
| Approved route corridors | `route_corridors` |
| Report audit trail | `activity_logs` |
| Officer notifications | `eoc_notifications` |
| Backup execution status | `backup_runs` |

`lib/eocTeamAccess.js` is the server-side authorization boundary for session-team data. UI visibility is supplementary and must not replace this check.

`area_population` stores `male_population`, `female_population`, and `population`
with a database check that requires the total to equal male plus female. The
current imported dataset has `population_scope = 'thai'`, `source_name =
'ประชากร.csv'`, and a null `population_year` because the source file does not
state a reference year.

## Permission matrix

| Action | Admin | Commander | Team lead | Team member | Unassigned officer |
|---|---:|---:|---:|---:|---:|
| View assigned team | Yes | Yes | Yes | Yes | No |
| Edit operational data in active session | Yes | Yes | Yes | Yes, where endpoint permits | No |
| Edit operational data in closed session | No | No | No | No | No |
| Create a team report in active/closed session | Yes | Yes | Yes | Yes | No |
| Edit a draft/returned report | Yes | Yes | Yes | Own report only | No |
| Submit a report | Yes | Yes | Yes | No | No |
| Review/approve/return a report | Yes | Yes | No | No | No |
| Verify/close Mission | Yes | Yes | No | No | No |
| Manage Master Data/Data Quality | Yes | No | No | No | No |

Team-report review is split into two explicit steps:
`draft → submitted → verified → approved`. A reviewer may return either a
submitted or verified report to the author. Closed sessions continue to allow
this reporting workflow, but operational Mission/Meeting/Decision mutations
remain read-only.

Legacy officer roles matching a `team_code` do not bypass session membership.

## Canonical routes

| Capability | Canonical route |
|---|---|
| Officer assignments | `GET /api/user/my-assignments` |
| Assignment for a selected historical session | `GET /api/user/my-assignments?sessionId=:id` |
| Team list for a session | `GET /api/eoc/sessions/:sessionId/teams` |
| Team members | `GET /api/eoc/:type/teams/:teamCode/members?sessionId=:id` |
| Team reports | `/api/eoc/sessions/:sessionId/teams/:sessionTeamId/reports` |
| Flood record mutations | `/api/admin/flood-records` |
| Flood daily query | `GET /api/eoc/flood/daily-risk?session_id=:id&report_date=YYYY-MM-DD` |
| Flood management projection | `GET /api/eoc/flood/management?session_id=:id&report_date=YYYY-MM-DD` |
| Flood missions/meetings/decisions | `GET/POST /api/eoc/flood/management/resources` |
| Update mission/meeting/decision | `PATCH /api/eoc/flood/management/resources/:id` |
| Officer work inbox | `GET /api/officer/inbox` |
| Officer notifications | `GET/PATCH /api/officer/notifications` |
| Data-quality dashboard | `GET /api/admin/data-quality` |
| Population master data | `/api/admin/master-data/population` |
| Other managed master data | `/api/admin/master-data/catalog/:type` |
| Area master data | `GET /api/common/areas` |
| Spatial boundaries | `GET /api/common/area-polygons?level=:level` |

## Deprecated routes

`/api/eoc/flood/daily-records` is a read-only compatibility adapter for the canonical flood daily query. Mutation methods return HTTP 410. Remove the adapter after confirming there are no external consumers.

## Daily flood query rules

- Every aggregate and detail query includes `session_id`.
- Daily data uses `DATE(flood_start_date) = report_date`.
- Dates use the `Asia/Bangkok` calendar.
- Closed sessions remain available for historical viewing.
- Operational writes require an active session.
- Production Flood Management reads database data and never falls back to seed/mock records.

## Known limitations

- `area_population`, `area_risk_profiles`, and `route_corridors` intentionally contain no fabricated seed. Rates or model-based fields remain unavailable until an authorized source is imported.
- Mission, meeting, and decision pages read their runtime tables and show a production empty state when no records exist.
- Open-Meteo, OSRM, GISTDA, and OpenStreetMap are external providers. Their responses must be identified as external or calculated data and never represented as database observations.
- Files remain in filesystem/object storage while `eoc_file_assets` is the source of truth for their metadata and listing.
- The deprecated `/api/eoc/flood/daily-records` adapter should be removed in a later migration after access-log verification.
- Existing legacy rows with an empty `activity_logs.action_type` are reported as
  a data-quality concern. New mutations are server-validated and do not create
  empty action types.
- Backup and restore procedures are documented in `docs/backup-recovery.md`.
  The local verification on 2026-07-23 restored all base tables and managed
  upload files into isolated temporary targets and verified row counts and
  checksums before cleanup.

## Mission, meeting, and decision traceability

The operational resource API uses one database transaction when a meeting
creates a decision and mission:

`meeting_notes → decision_logs → missions → progress/evidence → verification`

Mission status transitions are validated by `lib/eocValidation.js`; progress is
checked in both the API and MySQL. Only admin/commander can move a Mission to
`verified` or `closed`. Every mutation appends old/new values, reason, user,
Session, Team, IP, user agent, and timestamp to `activity_logs`.
