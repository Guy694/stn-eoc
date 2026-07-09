CREATE TABLE IF NOT EXISTS eoc_session_commanders (
    id INT NOT NULL AUTO_INCREMENT,
    eoc_session_id BIGINT NOT NULL,
    officer_id INT NOT NULL,
    command_role ENUM('incident_commander', 'deputy_incident_commander') NOT NULL DEFAULT 'deputy_incident_commander',
    notes TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    assigned_by INT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by INT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    removed_by INT NULL,
    removed_at DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_eoc_session_commanders_session (eoc_session_id),
    KEY idx_eoc_session_commanders_officer (officer_id),
    KEY idx_eoc_session_commanders_role (command_role, is_active),
    CONSTRAINT fk_eoc_session_commanders_session
        FOREIGN KEY (eoc_session_id) REFERENCES eoc_sessions(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_eoc_session_commanders_officer
        FOREIGN KEY (officer_id) REFERENCES officer(id)
        ON DELETE RESTRICT
);
