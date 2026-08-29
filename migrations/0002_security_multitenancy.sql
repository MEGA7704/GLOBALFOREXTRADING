PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan_code TEXT NOT NULL DEFAULT 'free' CHECK (plan_code IN ('free','business')),
  plan_started_at TEXT NOT NULL,
  plan_expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_companies_status_plan ON companies(status, plan_expires_at);

INSERT OR IGNORE INTO companies (
  id, name, plan_code, plan_started_at, plan_expires_at, status, created_at, updated_at
)
SELECT
  'company-' || id,
  CASE WHEN trim(name) = '' THEN 'Entreprise migrée' ELSE trim(name) END,
  'free',
  COALESCE(created_at, datetime('now')),
  datetime(COALESCE(created_at, datetime('now')), '+7 days'),
  CASE WHEN is_active = 1 THEN 'active' ELSE 'disabled' END,
  COALESCE(created_at, datetime('now')),
  COALESCE(updated_at, datetime('now'))
FROM users;

CREATE TABLE users_secure (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','super_admin')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  session_version INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

INSERT INTO users_secure (
  id, company_id, name, email, role, is_active, session_version,
  last_login_at, created_at, updated_at, deleted_at
)
SELECT
  id,
  CASE WHEN role = 'admin' THEN NULL ELSE 'company-' || id END,
  name,
  lower(trim(email)),
  CASE WHEN role = 'admin' THEN 'super_admin' ELSE 'member' END,
  is_active,
  1,
  last_login_at,
  created_at,
  updated_at,
  NULL
FROM users;

CREATE TABLE password_credentials_secure (
  user_id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'pbkdf2_sha256',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users_secure(id) ON DELETE CASCADE
);

INSERT INTO password_credentials_secure (user_id, password_hash, algorithm, updated_at)
SELECT id, password_hash, 'pbkdf2_sha256', COALESCE(updated_at, datetime('now'))
FROM users
WHERE password_hash IS NOT NULL AND password_hash <> '';

CREATE TABLE analyses_secure (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'capture',
  decision TEXT,
  trend TEXT,
  confidence REAL,
  noise REAL,
  score INTEGER,
  risk INTEGER,
  rr REAL,
  timeframe TEXT,
  entry_mode TEXT,
  zone_recommended TEXT,
  conclusion TEXT,
  raw_result TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users_secure(id) ON DELETE CASCADE
);

INSERT INTO analyses_secure (
  id, company_id, user_id, source_type, decision, trend, confidence, noise,
  score, risk, rr, timeframe, entry_mode, zone_recommended, conclusion,
  raw_result, created_at
)
SELECT
  a.id,
  'company-' || a.user_id,
  a.user_id,
  a.source_type,
  a.decision,
  a.trend,
  a.confidence,
  a.noise,
  a.score,
  a.risk,
  a.rr,
  a.timeframe,
  a.entry_mode,
  a.zone_recommended,
  a.conclusion,
  a.raw_result,
  a.created_at
FROM analyses a;

CREATE TABLE audit_logs_secure (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  actor_company_id TEXT,
  target_user_id TEXT,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO audit_logs_secure (
  id, actor_user_id, actor_company_id, target_user_id, action,
  ip_address, user_agent, details, created_at
)
SELECT
  id,
  user_id,
  CASE WHEN user_id IS NULL THEN NULL ELSE 'company-' || user_id END,
  NULL,
  action,
  ip_address,
  user_agent,
  details,
  created_at
FROM audit_logs;

DROP TABLE analyses;
DROP TABLE audit_logs;
DROP TABLE users;

ALTER TABLE users_secure RENAME TO users;
ALTER TABLE password_credentials_secure RENAME TO password_credentials;
ALTER TABLE analyses_secure RENAME TO analyses;
ALTER TABLE audit_logs_secure RENAME TO audit_logs;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_analyses_company_date ON analyses(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_user_date ON analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS company_data (
  company_id TEXT NOT NULL,
  data_key TEXT NOT NULL,
  data_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, data_key),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT
);

PRAGMA foreign_keys = ON;
