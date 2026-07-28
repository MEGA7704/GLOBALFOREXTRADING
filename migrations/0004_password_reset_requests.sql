PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL COLLATE NOCASE,
  requester_name TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_password_reset_status_date
  ON password_reset_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_user
  ON password_reset_requests(user_id, status);

INSERT INTO app_schema_meta (name, version, updated_at)
VALUES ('global_forex_trading', 4, datetime('now'))
ON CONFLICT(name) DO UPDATE SET
  version = excluded.version,
  updated_at = excluded.updated_at;
