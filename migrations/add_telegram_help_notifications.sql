-- Add Telegram notification preferences for officer help-request alerts.

ALTER TABLE officer
  ADD COLUMN telegram_chat_id VARCHAR(64) NULL COMMENT 'Telegram chat id for citizen help request notifications',
  ADD COLUMN telegram_notify_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Enable Telegram help request notifications';

CREATE INDEX idx_officer_telegram_notify
  ON officer (telegram_notify_enabled, telegram_chat_id);
