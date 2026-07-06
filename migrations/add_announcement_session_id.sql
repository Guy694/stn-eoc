ALTER TABLE announcements
  ADD COLUMN session_id BIGINT NULL AFTER eoc_type,
  ADD INDEX idx_announcements_session_id (session_id),
  ADD CONSTRAINT fk_announcements_session
    FOREIGN KEY (session_id) REFERENCES eoc_sessions(id)
    ON DELETE SET NULL;
