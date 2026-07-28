CREATE TABLE IF NOT EXISTS app_schema_meta (
  name TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO app_schema_meta (name, version, updated_at)
VALUES ('global_forex_trading', 3, datetime('now'))
ON CONFLICT(name) DO UPDATE SET
  version = excluded.version,
  updated_at = excluded.updated_at;
