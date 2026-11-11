-- Update allowed subscription codes without modifying existing account expirations.
CREATE TABLE IF NOT EXISTS company_subscriptions_v6 (
  company_id TEXT PRIMARY KEY,
  plan_code TEXT NOT NULL DEFAULT 'free' CHECK (plan_code IN ('free','minutes60','hours24','days7','days15','standard','business')),
  plan_started_at TEXT NOT NULL,
  plan_expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
INSERT OR IGNORE INTO company_subscriptions_v6
(company_id,plan_code,plan_started_at,plan_expires_at,updated_at)
SELECT company_id,plan_code,plan_started_at,plan_expires_at,updated_at
FROM company_subscriptions;
DROP TABLE company_subscriptions;
ALTER TABLE company_subscriptions_v6 RENAME TO company_subscriptions;
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_plan ON company_subscriptions(plan_code, plan_expires_at);
