-- Officer data management, traceability, notification, and verification workflow.
-- Apply after create_flood_eoc_management.sql, create_eoc_team_reports.sql,
-- create_area_population_and_file_assets.sql, and extend_area_population_gender.sql.

ALTER TABLE area_population
  ADD COLUMN notes TEXT NULL AFTER source_updated_at,
  ADD COLUMN updated_by INT NULL AFTER notes,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER updated_by,
  ADD KEY idx_area_population_active (is_active, district_name),
  ADD CONSTRAINT fk_area_population_updated_by
    FOREIGN KEY (updated_by) REFERENCES officer(id) ON DELETE SET NULL;

ALTER TABLE missions
  ADD COLUMN assigned_team_id INT NULL AFTER assigned_team,
  ADD COLUMN responsible_officer_id INT NULL AFTER responsible_person,
  ADD COLUMN source_meeting_id BIGINT NULL AFTER responsible_officer_id,
  ADD COLUMN source_decision_id BIGINT NULL AFTER source_meeting_id,
  ADD COLUMN evidence_file_asset_id BIGINT NULL AFTER evidence_file,
  ADD COLUMN status_reason TEXT NULL AFTER remarks,
  ADD COLUMN status_changed_by INT NULL AFTER status_reason,
  ADD COLUMN status_changed_at DATETIME NULL AFTER status_changed_by,
  ADD COLUMN verified_by INT NULL AFTER status_changed_at,
  ADD COLUMN verified_at DATETIME NULL AFTER verified_by,
  ADD CONSTRAINT chk_mission_progress CHECK (progress_percent BETWEEN 0 AND 100),
  ADD CONSTRAINT fk_mission_session_team
    FOREIGN KEY (assigned_team_id) REFERENCES eoc_session_teams(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_mission_responsible_officer
    FOREIGN KEY (responsible_officer_id) REFERENCES officer(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_mission_evidence_asset
    FOREIGN KEY (evidence_file_asset_id) REFERENCES eoc_file_assets(id) ON DELETE SET NULL,
  ADD KEY idx_mission_responsible (responsible_officer_id, status, due_at),
  ADD KEY idx_mission_session_team (session_id, assigned_team_id);

ALTER TABLE meeting_notes
  MODIFY reporting_cycle_id BIGINT NULL,
  ADD COLUMN meeting_status VARCHAR(40) NOT NULL DEFAULT 'scheduled' AFTER next_meeting_datetime,
  ADD KEY idx_meeting_next (session_id, next_meeting_datetime);

ALTER TABLE decision_logs
  ADD COLUMN meeting_id BIGINT NULL AFTER reporting_cycle_id,
  ADD COLUMN created_by INT NULL AFTER linked_mission_id,
  ADD COLUMN cancelled_by INT NULL AFTER created_by,
  ADD COLUMN cancelled_at DATETIME NULL AFTER cancelled_by,
  ADD COLUMN cancellation_reason TEXT NULL AFTER cancelled_at,
  ADD CONSTRAINT fk_decision_meeting
    FOREIGN KEY (meeting_id) REFERENCES meeting_notes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_decision_mission
    FOREIGN KEY (linked_mission_id) REFERENCES missions(id) ON DELETE RESTRICT,
  ADD KEY idx_decision_meeting (meeting_id);

ALTER TABLE missions
  ADD CONSTRAINT fk_mission_source_meeting
    FOREIGN KEY (source_meeting_id) REFERENCES meeting_notes(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_mission_source_decision
    FOREIGN KEY (source_decision_id) REFERENCES decision_logs(id) ON DELETE SET NULL;

ALTER TABLE eoc_team_reports
  MODIFY status ENUM('draft','submitted','verified','approved','returned')
    NOT NULL DEFAULT 'draft',
  ADD COLUMN verified_by INT NULL AFTER reviewed_at,
  ADD COLUMN verified_at DATETIME NULL AFTER verified_by,
  ADD COLUMN approved_by INT NULL AFTER verified_at,
  ADD COLUMN approved_at DATETIME NULL AFTER approved_by,
  ADD KEY idx_team_reports_verification (status, verified_at, approved_at);

CREATE TABLE IF NOT EXISTS eoc_notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  recipient_user_id INT NOT NULL,
  notification_type VARCHAR(60) NOT NULL,
  title VARCHAR(255) NOT NULL,
  detail TEXT NULL,
  target_url VARCHAR(500) NULL,
  eoc_session_id BIGINT NULL,
  related_type VARCHAR(60) NULL,
  related_id BIGINT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notification_recipient
    FOREIGN KEY (recipient_user_id) REFERENCES officer(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_session
    FOREIGN KEY (eoc_session_id) REFERENCES eoc_sessions(id) ON DELETE CASCADE,
  KEY idx_notification_inbox (recipient_user_id, is_read, created_at),
  KEY idx_notification_related (related_type, related_id)
);

CREATE TABLE IF NOT EXISTS disaster_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type_code VARCHAR(60) NOT NULL,
  name_th VARCHAR(160) NOT NULL,
  name_en VARCHAR(160) NULL,
  source_name VARCHAR(255) NOT NULL,
  source_updated_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  updated_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_disaster_type_code (type_code),
  CONSTRAINT fk_disaster_type_updated_by
    FOREIGN KEY (updated_by) REFERENCES officer(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS backup_runs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  backup_type ENUM('database','files','combined') NOT NULL,
  status ENUM('running','succeeded','failed','restore_verified') NOT NULL,
  storage_location VARCHAR(500) NULL,
  checksum_sha256 CHAR(64) NULL,
  encrypted TINYINT(1) NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL,
  completed_at DATETIME NULL,
  restore_tested_at DATETIME NULL,
  error_message TEXT NULL,
  initiated_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_backup_initiated_by
    FOREIGN KEY (initiated_by) REFERENCES officer(id) ON DELETE SET NULL,
  KEY idx_backup_status (status, completed_at)
);

ALTER TABLE activity_logs
  ADD COLUMN session_team_id INT NULL AFTER eoc_session_id,
  ADD COLUMN old_values JSON NULL AFTER metadata,
  ADD COLUMN new_values JSON NULL AFTER old_values,
  ADD COLUMN change_reason TEXT NULL AFTER new_values,
  ADD KEY idx_activity_session_team (eoc_session_id, session_team_id);

