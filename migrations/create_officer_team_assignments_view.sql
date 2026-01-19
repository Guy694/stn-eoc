-- Create view for officer team assignments
-- This view combines data from eoc_team_members, eoc_session_teams, eoc_sessions, eoc_teams, and officer tables

DROP VIEW IF EXISTS vw_officer_team_assignments;

CREATE VIEW vw_officer_team_assignments AS
SELECT 
    etm.id AS assignment_id,
    etm.officer_id,
    o.username,
    o.given_name,
    o.family_name,
    o.email,
    o.phone,
    etm.session_team_id,
    est.team_id,
    t.team_code,
    t.team_name_th,
    t.team_name_en,
    etm.is_active,
    etm.assigned_at,
    etm.assigned_by,
    est.eoc_session_id,
    es.session_number,
    es.eoc_type,
    es.status AS session_status,
    es.opened_at AS session_opened_at,
    es.closed_at AS session_closed_at,
    est.is_active AS team_is_active
FROM eoc_team_members etm
INNER JOIN eoc_session_teams est ON etm.session_team_id = est.id
INNER JOIN eoc_sessions es ON est.eoc_session_id = es.id
INNER JOIN eoc_teams t ON est.team_id = t.id
INNER JOIN officer o ON etm.officer_id = o.id
WHERE etm.is_active = TRUE
  AND est.is_active = TRUE;
