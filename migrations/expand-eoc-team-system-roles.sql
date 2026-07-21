-- Allow every EOC team code to be selected as an officer system role.
-- Run this migration before assigning the newly added roles in the admin UI.
ALTER TABLE officer
    MODIFY role ENUM(
        'user', 'staff', 'admin', 'commander',
        'EOC_COMMANDER', 'SAT', 'PLANNING', 'SCIENTIFIC', 'JIT', 'ACTIVE_SURV',
        'CASE_MGMT', 'LAB', 'RISKCOM', 'VACCINE', 'MCATT', 'POE', 'QUARANTINE',
        'MERT', 'SeRHT', 'LOGISTICS', 'LEGAL', 'FINANCE', 'STAFFING', 'EOC_ADMIN',
        'ITSUPPORT', 'LIAISON', 'EOC_MGMT'
    ) NOT NULL DEFAULT 'staff',
    MODIFY requested_role ENUM(
        'staff', 'admin', 'commander',
        'EOC_COMMANDER', 'SAT', 'PLANNING', 'SCIENTIFIC', 'JIT', 'ACTIVE_SURV',
        'CASE_MGMT', 'LAB', 'RISKCOM', 'VACCINE', 'MCATT', 'POE', 'QUARANTINE',
        'MERT', 'SeRHT', 'LOGISTICS', 'LEGAL', 'FINANCE', 'STAFFING', 'EOC_ADMIN',
        'ITSUPPORT', 'LIAISON', 'EOC_MGMT'
    ) DEFAULT 'staff';

ALTER TABLE user_sessions
    MODIFY role ENUM(
        'staff', 'admin', 'commander',
        'EOC_COMMANDER', 'SAT', 'PLANNING', 'SCIENTIFIC', 'JIT', 'ACTIVE_SURV',
        'CASE_MGMT', 'LAB', 'RISKCOM', 'VACCINE', 'MCATT', 'POE', 'QUARANTINE',
        'MERT', 'SeRHT', 'LOGISTICS', 'LEGAL', 'FINANCE', 'STAFFING', 'EOC_ADMIN',
        'ITSUPPORT', 'LIAISON', 'EOC_MGMT'
    ) NOT NULL DEFAULT 'staff';
