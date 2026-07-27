-- Reconcile legacy EOC teams with the application registry.
-- Safe behavior: legacy rows are deactivated only when they have never been
-- referenced by a session. Referenced rows are left untouched for manual review.

UPDATE eoc_teams legacy
SET legacy.is_active = 0
WHERE legacy.team_code IN ('MCAT', 'MEDICAL', 'SHELTER')
  AND NOT EXISTS (
    SELECT 1
    FROM eoc_session_teams assigned
    WHERE assigned.team_id = legacy.id
  );

-- Report any referenced legacy rows. The deployment operator must either map
-- them to a registered team or add a supported registry definition before use.
SELECT legacy.id, legacy.team_code, legacy.team_name_th,
       COUNT(assigned.id) AS assignment_count
FROM eoc_teams legacy
LEFT JOIN eoc_session_teams assigned ON assigned.team_id = legacy.id
WHERE legacy.team_code IN ('MCAT', 'MEDICAL', 'SHELTER')
GROUP BY legacy.id, legacy.team_code, legacy.team_name_th
HAVING COUNT(assigned.id) > 0;
