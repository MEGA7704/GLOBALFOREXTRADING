PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS company_subscriptions (
  company_id TEXT PRIMARY KEY,
  plan_code TEXT NOT NULL DEFAULT 'free' CHECK (plan_code IN ('free','standard','business')),
  plan_started_at TEXT NOT NULL,
  plan_expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company_subscriptions_plan
ON company_subscriptions(plan_code, plan_expires_at);

INSERT OR IGNORE INTO company_subscriptions (
  company_id, plan_code, plan_started_at, plan_expires_at, updated_at
)
SELECT
  id,
  CASE WHEN plan_code = 'business' THEN 'business' ELSE 'free' END,
  plan_started_at,
  plan_expires_at,
  updated_at
FROM companies;
