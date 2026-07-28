const encoder = new TextEncoder();
const SESSION_COOKIE = "__Host-fx_session";
const CSRF_COOKIE = "__Host-fx_csrf";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const CSRF_TTL_SECONDS = 60 * 60;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_MAX_ATTEMPTS = 5;
const PBKDF2_ITERATIONS = 600000;
const FREE_PLAN_DAYS = 21;
const BUSINESS_PLAN_DAYS = 365;
const PAYMENT_URL = "https://pay.wave.com/m/M_ci_Enx-2JNAklk-/c/ci/?amount=365000";
const APP_STATE_MAX_BYTES = 350000;

const PUBLIC_ASSETS = new Set([
  "/favicon.ico",
  "/robots.txt"
]);

const SENSITIVE_STATE_KEYS = new Set([
  "plan", "plancode", "plan_code", "subscription", "subscriptionstatus",
  "subscription_status", "status", "role", "companyid", "company_id",
  "isactive", "is_active", "password", "passwordhash", "password_hash",
  "hash", "salt", "session", "sessionversion", "session_version",
  "expiresat", "expires_at", "planexpiresat", "plan_expires_at"
]);

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function randomToken(size = 32) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(size)));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(value)));
  return bytesToBase64Url(new Uint8Array(digest));
}

function constantTimeEqual(a, b) {
  const left = encoder.encode(String(a || ""));
  const right = encoder.encode(String(b || ""));
  const max = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < max; i += 1) diff |= (left[i] || 0) ^ (right[i] || 0);
  return diff === 0;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validateEmail(value) {
  const email = normalizeEmail(value);
  if (!email || email.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Adresse e-mail invalide.");
  }
  return email;
}

function validatePassword(password, { allowInitial = false } = {}) {
  const value = String(password || "");
  const minimum = allowInitial ? 10 : 12;
  if (value.length < minimum) throw new Error(`Le mot de passe doit contenir au moins ${minimum} caractères.`);
  if (value.length > 128) throw new Error("Le mot de passe est trop long.");
  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    throw new Error("Le mot de passe doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial.");
  }
  return value;
}

async function derivePassword(password, pepper, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`${password}\u0000${pepper || ""}`),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return new Uint8Array(await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt,
    iterations
  }, keyMaterial, 256));
}

async function hashPassword(password, pepper, options = {}) {
  validatePassword(password, options);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, pepper, salt, PBKDF2_ITERATIONS);
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(hash)}`;
}

async function verifyPassword(password, storedValue, pepper) {
  try {
    const [algorithm, iterationText, saltText, hashText] = String(storedValue || "").split("$");
    if (algorithm !== "pbkdf2_sha256") return false;
    const iterations = Number(iterationText);
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 2000000) return false;
    const expected = base64UrlToBytes(hashText);
    const actual = await derivePassword(String(password || ""), pepper, base64UrlToBytes(saltText), iterations);
    if (expected.length !== actual.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i += 1) diff |= expected[i] ^ actual[i];
    return diff === 0;
  } catch {
    return false;
  }
}

function parseCookies(request) {
  const cookies = {};
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try { cookies[key] = decodeURIComponent(value); } catch { cookies[key] = value; }
  }
  return cookies;
}

function sessionCookie(token, maxAge = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function csrfCookie(token, maxAge = CSRF_TTL_SECONDS) {
  return `${CSRF_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearCsrfCookie() {
  return `${CSRF_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

async function readJson(request, maxBytes = 30000) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw new Error("Requête trop volumineuse.");
  const text = await request.text();
  if (text.length > maxBytes) throw new Error("Requête trop volumineuse.");
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new Error("Corps JSON invalide."); }
}

function assertSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return;
  if (new URL(origin).origin !== new URL(request.url).origin) throw new Error("Origine de requête refusée.");
}

function assertCsrf(request) {
  assertSameOrigin(request);
  const cookieToken = parseCookies(request)[CSRF_COOKIE] || "";
  const headerToken = request.headers.get("X-CSRF-Token") || "";
  if (cookieToken.length < 32 || headerToken.length < 32 || !constantTimeEqual(cookieToken, headerToken)) {
    const error = new Error("Jeton CSRF absent ou invalide.");
    error.status = 403;
    throw error;
  }
}

function safeText(value, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function addDays(date, days) {
  const output = new Date(date);
  output.setUTCDate(output.getUTCDate() + Number(days));
  return output.toISOString();
}

function planDurationDays(planCode) {
  return planCode === "business" ? BUSINESS_PLAN_DAYS : FREE_PLAN_DAYS;
}

function planLabel(planCode) {
  return planCode === "business" ? "Business" : "Free";
}

function computePlan(company) {
  if (!company) return null;
  const expiresAt = new Date(company.plan_expires_at).getTime();
  const now = Date.now();
  const remainingMs = Math.max(0, expiresAt - now);
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / 86400000));
  return {
    code: company.plan_code,
    label: planLabel(company.plan_code),
    startedAt: company.plan_started_at,
    expiresAt: company.plan_expires_at,
    status: company.status,
    active: company.status === "active" && expiresAt > now,
    daysRemaining,
    paymentUrl: PAYMENT_URL
  };
}

function sanitizeUser(auth) {
  return {
    id: auth.user.id,
    name: auth.user.name,
    email: auth.user.email,
    role: auth.user.role,
    companyId: auth.user.company_id || null
  };
}

function sanitizeCompany(auth) {
  if (!auth.company) return null;
  return {
    id: auth.company.id,
    name: auth.company.name
  };
}

function requestMeta(request) {
  return {
    ip: request.headers.get("CF-Connecting-IP") || "unknown",
    userAgent: (request.headers.get("User-Agent") || "").slice(0, 250)
  };
}

async function audit(env, request, {
  actorUserId = null,
  actorCompanyId = null,
  targetUserId = null,
  action,
  details = {}
}) {
  const meta = requestMeta(request);
  const safeDetails = JSON.stringify(details, (key, value) => {
    const lowered = String(key).toLowerCase();
    if (lowered.includes("password") || lowered.includes("hash") || lowered.includes("salt") || lowered.includes("token")) return "[REDACTED]";
    return value;
  }).slice(0, 5000);
  await env.FOREX_D1.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, actor_company_id, target_user_id, action,
      ip_address, user_agent, details, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    actorUserId,
    actorCompanyId,
    targetUserId,
    action,
    meta.ip,
    meta.userAgent,
    safeDetails,
    new Date().toISOString()
  ).run();
}

async function auditBestEffort(env, request, event) {
  try { await audit(env, request, event); } catch { /* Authentication must remain available if logging fails. */ }
}

async function createSession(env, user, request) {
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const sessionKey = `session:${tokenHash}`;
  const indexKey = `session-index:${user.id}:${tokenHash}`;
  const payload = {
    userId: user.id,
    sessionVersion: Number(user.session_version || 1),
    createdAt: new Date().toISOString(),
    ipHash: await sha256(requestMeta(request).ip),
    userAgentHash: await sha256(requestMeta(request).userAgent)
  };
  await Promise.all([
    env.FOREX_KV.put(sessionKey, JSON.stringify(payload), { expirationTtl: SESSION_TTL_SECONDS }),
    env.FOREX_KV.put(indexKey, sessionKey, { expirationTtl: SESSION_TTL_SECONDS })
  ]);
  return token;
}

async function deleteSessionByToken(env, token) {
  if (!token) return;
  const tokenHash = await sha256(token);
  const key = `session:${tokenHash}`;
  const payload = await env.FOREX_KV.get(key, "json");
  const indexKey = payload?.userId ? `session-index:${payload.userId}:${tokenHash}` : null;
  const deletions = [env.FOREX_KV.delete(key)];
  if (indexKey) deletions.push(env.FOREX_KV.delete(indexKey));
  await Promise.all(deletions);
}

async function invalidateAllUserSessions(env, userId) {
  let cursor;
  do {
    const result = await env.FOREX_KV.list({ prefix: `session-index:${userId}:`, cursor, limit: 1000 });
    for (const item of result.keys || []) {
      const sessionKey = await env.FOREX_KV.get(item.name);
      const deletes = [env.FOREX_KV.delete(item.name)];
      if (sessionKey) deletes.push(env.FOREX_KV.delete(sessionKey));
      await Promise.all(deletes);
    }
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
}

async function getSessionRecord(env, request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const key = `session:${await sha256(token)}`;
  const payload = await env.FOREX_KV.get(key, "json");
  return payload ? { token, key, ...payload } : null;
}

async function getAuth(env, request) {
  const session = await getSessionRecord(env, request);
  if (!session) return null;
  const row = await env.FOREX_D1.prepare(`
    SELECT
      u.id, u.company_id, u.name, u.email, u.role, u.is_active,
      u.session_version, u.deleted_at,
      c.id AS c_id, c.name AS c_name, c.plan_code, c.plan_started_at,
      c.plan_expires_at, c.status AS company_status
    FROM users u
    LEFT JOIN companies c ON c.id = u.company_id
    WHERE u.id = ?
    LIMIT 1
  `).bind(session.userId).first();
  if (!row || row.deleted_at || Number(row.is_active) !== 1 || Number(row.session_version) !== Number(session.sessionVersion)) {
    await deleteSessionByToken(env, session.token);
    return null;
  }
  const user = {
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    email: row.email,
    role: row.role,
    is_active: Number(row.is_active),
    session_version: Number(row.session_version)
  };
  const company = row.c_id ? {
    id: row.c_id,
    name: row.c_name,
    plan_code: row.plan_code,
    plan_started_at: row.plan_started_at,
    plan_expires_at: row.plan_expires_at,
    status: row.company_status
  } : null;
  if (user.role === "member" && (!company || company.status !== "active")) {
    await deleteSessionByToken(env, session.token);
    return null;
  }
  return { session, user, company, plan: computePlan(company) };
}

function requireRole(auth, role) {
  if (!auth) {
    const error = new Error("Authentification requise.");
    error.status = 401;
    throw error;
  }
  if (auth.user.role !== role) {
    const error = new Error("Accès non autorisé.");
    error.status = 403;
    throw error;
  }
}

function requireMemberAccess(auth) {
  requireRole(auth, "member");
  if (!auth.plan?.active) {
    const error = new Error("Votre abonnement a expiré.");
    error.status = 403;
    error.code = "PLAN_EXPIRED";
    throw error;
  }
}

async function rateLimitKeys(env, request, email) {
  const ip = requestMeta(request).ip;
  return {
    ipKey: `login-rate:ip:${await sha256(ip)}`,
    accountKey: `login-rate:account:${await sha256(normalizeEmail(email))}`
  };
}

async function readCounter(env, key) {
  const value = await env.FOREX_KV.get(key, "json");
  return Number(value?.count || 0);
}

async function assertLoginAllowed(env, request, email) {
  const keys = await rateLimitKeys(env, request, email);
  const [ipCount, accountCount] = await Promise.all([
    readCounter(env, keys.ipKey),
    readCounter(env, keys.accountKey)
  ]);
  if (ipCount >= LOGIN_MAX_ATTEMPTS || accountCount >= LOGIN_MAX_ATTEMPTS) {
    const error = new Error("Trop de tentatives. Réessayez dans 15 minutes.");
    error.status = 429;
    error.headers = { "Retry-After": String(LOGIN_WINDOW_SECONDS) };
    throw error;
  }
  return keys;
}

async function registerLoginFailure(env, keys) {
  const [ipCount, accountCount] = await Promise.all([
    readCounter(env, keys.ipKey),
    readCounter(env, keys.accountKey)
  ]);
  await Promise.all([
    env.FOREX_KV.put(keys.ipKey, JSON.stringify({ count: ipCount + 1 }), { expirationTtl: LOGIN_WINDOW_SECONDS }),
    env.FOREX_KV.put(keys.accountKey, JSON.stringify({ count: accountCount + 1 }), { expirationTtl: LOGIN_WINDOW_SECONDS })
  ]);
  return { ipCount: ipCount + 1, accountCount: accountCount + 1 };
}

async function clearLoginFailures(env, keys) {
  await Promise.all([env.FOREX_KV.delete(keys.ipKey), env.FOREX_KV.delete(keys.accountKey)]);
}

async function ensureInitialSuperAdmin(env, request, email, password) {
  const configuredEmail = normalizeEmail(env.SUPER_ADMIN_EMAIL || "mega@services.local");
  if (email !== configuredEmail) return null;
  const existing = await env.FOREX_D1.prepare(`
    SELECT u.id FROM users u WHERE u.email = ? AND u.deleted_at IS NULL LIMIT 1
  `).bind(email).first();
  if (existing) return null;
  if (!env.SUPER_ADMIN_INITIAL_PASSWORD) {
    const error = new Error("Le secret SUPER_ADMIN_INITIAL_PASSWORD n’est pas configuré dans Cloudflare.");
    error.status = 503;
    throw error;
  }
  if (!env.AUTH_PEPPER) {
    const error = new Error("Le secret AUTH_PEPPER n’est pas configuré dans Cloudflare.");
    error.status = 503;
    throw error;
  }
  if (!constantTimeEqual(password, env.SUPER_ADMIN_INITIAL_PASSWORD)) return null;
  validatePassword(password, { allowInitial: true });
  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password, env.AUTH_PEPPER, { allowInitial: true });
  await env.FOREX_D1.batch([
    env.FOREX_D1.prepare(`
      INSERT INTO users (
        id, company_id, name, email, role, is_active, session_version,
        created_at, updated_at
      ) VALUES (?, NULL, ?, ?, 'super_admin', 1, 1, ?, ?)
    `).bind(userId, "MEGA SERVICES — Super Admin", email, now, now),
    env.FOREX_D1.prepare(`
      INSERT INTO password_credentials (user_id, password_hash, algorithm, updated_at)
      VALUES (?, ?, 'pbkdf2_sha256', ?)
    `).bind(userId, passwordHash, now)
  ]);
  await auditBestEffort(env, request, {
    actorUserId: userId,
    action: "SUPER_ADMIN_INITIALIZED",
    details: { email }
  });
  return userId;
}

function containsSensitiveState(value, depth = 0) {
  if (depth > 20 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(item => containsSensitiveState(item, depth + 1));
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.replace(/[^a-z0-9_]/gi, "").toLowerCase();
    if (SENSITIVE_STATE_KEYS.has(normalized)) return true;
    if (containsSensitiveState(child, depth + 1)) return true;
  }
  return false;
}

function parseStoredJson(value, fallback = null) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

async function handleCsrf() {
  const token = randomToken(32);
  return json({ csrfToken: token }, 200, { "Set-Cookie": csrfCookie(token) });
}

async function handleStatus(env, auth) {
  let d1 = "indisponible";
  let kv = "indisponible";
  try {
    await env.FOREX_D1.prepare("SELECT 1 AS ok").first();
    d1 = "FOREX_D1 connecté";
  } catch { d1 = "migration requise"; }
  try {
    await env.FOREX_KV.get("system:health");
    kv = "FOREX_KV connecté";
  } catch { kv = "binding manquant"; }
  return json({
    ok: d1.includes("connecté") && kv.includes("connecté"),
    authenticated: Boolean(auth),
    services: { d1, kv },
    version: "2.0.0"
  });
}

async function handleLogin(env, request) {
  assertCsrf(request);
  if (!env.AUTH_PEPPER) {
    const error = new Error("Le secret AUTH_PEPPER n’est pas configuré dans Cloudflare.");
    error.status = 503;
    throw error;
  }
  const body = await readJson(request, 10000);
  const email = validateEmail(body.email);
  const password = String(body.password || "");
  if (!password) throw new Error("E-mail et mot de passe requis.");
  const rateKeys = await assertLoginAllowed(env, request, email);
  await ensureInitialSuperAdmin(env, request, email, password);
  const user = await env.FOREX_D1.prepare(`
    SELECT
      u.id, u.company_id, u.name, u.email, u.role, u.is_active,
      u.session_version, u.deleted_at,
      pc.password_hash,
      c.status AS company_status, c.plan_code, c.plan_started_at, c.plan_expires_at,
      c.name AS company_name, c.id AS c_id
    FROM users u
    JOIN password_credentials pc ON pc.user_id = u.id
    LEFT JOIN companies c ON c.id = u.company_id
    WHERE u.email = ?
    LIMIT 1
  `).bind(email).first();
  const valid = Boolean(
    user &&
    !user.deleted_at &&
    Number(user.is_active) === 1 &&
    (user.role === "super_admin" || user.company_status === "active") &&
    await verifyPassword(password, user.password_hash, env.AUTH_PEPPER)
  );
  if (!valid) {
    const counts = await registerLoginFailure(env, rateKeys);
    await auditBestEffort(env, request, {
      actorUserId: user?.id || null,
      actorCompanyId: user?.company_id || null,
      action: "LOGIN_FAILED",
      details: { email, ...counts }
    });
    const error = new Error("Identifiants incorrects ou compte désactivé.");
    error.status = 401;
    throw error;
  }
  await clearLoginFailures(env, rateKeys);
  const token = await createSession(env, user, request);
  const now = new Date().toISOString();
  await env.FOREX_D1.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?")
    .bind(now, now, user.id).run();
  await auditBestEffort(env, request, {
    actorUserId: user.id,
    actorCompanyId: user.company_id || null,
    action: "LOGIN_SUCCESS"
  });
  const company = user.c_id ? {
    id: user.c_id,
    name: user.company_name,
    plan_code: user.plan_code,
    plan_started_at: user.plan_started_at,
    plan_expires_at: user.plan_expires_at,
    status: user.company_status
  } : null;
  return json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    plan: computePlan(company)
  }, 200, { "Set-Cookie": sessionCookie(token) });
}

async function handleLogout(env, request, auth) {
  assertCsrf(request);
  if (auth) {
    await auditBestEffort(env, request, {
      actorUserId: auth.user.id,
      actorCompanyId: auth.user.company_id || null,
      action: "LOGOUT"
    });
    await deleteSessionByToken(env, auth.session.token);
  }
  return json({ ok: true }, 200, {
    "Set-Cookie": clearSessionCookie()
  });
}

async function handleMe(auth) {
  if (!auth) {
    const error = new Error("Authentification requise.");
    error.status = 401;
    throw error;
  }
  return json({
    user: sanitizeUser(auth),
    company: sanitizeCompany(auth),
    plan: auth.plan
  });
}

async function handleLoad(env, auth) {
  requireMemberAccess(auth);
  const [stateResult, analysesResult] = await Promise.all([
    env.FOREX_D1.prepare(`
      SELECT data_key, data_json, revision, updated_at
      FROM company_data
      WHERE company_id = ?
      ORDER BY data_key
    `).bind(auth.user.company_id).all(),
    env.FOREX_D1.prepare(`
      SELECT
        id, source_type, decision, trend, confidence, noise, score, risk, rr,
        timeframe, entry_mode, zone_recommended, conclusion, raw_result, created_at
      FROM analyses
      WHERE company_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `).bind(auth.user.company_id).all()
  ]);
  const data = {};
  for (const row of stateResult.results || []) {
    data[row.data_key] = {
      value: parseStoredJson(row.data_json, {}),
      revision: Number(row.revision || 1),
      updatedAt: row.updated_at
    };
  }
  const analyses = (analysesResult.results || []).map(row => ({
    ...row,
    raw_result: parseStoredJson(row.raw_result, null)
  }));
  return json({
    user: sanitizeUser(auth),
    company: sanitizeCompany(auth),
    plan: auth.plan,
    data,
    analyses
  });
}

async function handleSave(env, request, auth) {
  requireMemberAccess(auth);
  assertCsrf(request);
  const body = await readJson(request, APP_STATE_MAX_BYTES + 50000);
  const type = String(body.type || "analysis");
  if (type === "analysis") {
    const result = body.result || {};
    if (!result.conclusionText) throw new Error("Résultat d’analyse invalide.");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const sourceType = body.sourceType === "live" ? "live" : "capture";
    const raw = JSON.stringify(result);
    if (raw.length > 60000) throw new Error("Résultat d’analyse trop volumineux.");
    await env.FOREX_D1.prepare(`
      INSERT INTO analyses (
        id, company_id, user_id, source_type, decision, trend, confidence,
        noise, score, risk, rr, timeframe, entry_mode, zone_recommended,
        conclusion, raw_result, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      auth.user.company_id,
      auth.user.id,
      sourceType,
      safeText(result.decision, 30),
      safeText(result.trend, 30),
      numberOrNull(result.conf),
      numberOrNull(result.noise),
      numberOrNull(result.score),
      numberOrNull(result.risk),
      numberOrNull(result.rr),
      safeText(result.tfDetect || result.tfWanted, 20),
      safeText(result.entryMode, 100),
      safeText(result.zoneRec, 100),
      safeText(result.conclusionText, 1000),
      raw,
      now
    ).run();
    await auditBestEffort(env, request, {
      actorUserId: auth.user.id,
      actorCompanyId: auth.user.company_id,
      action: "ANALYSIS_SAVED",
      details: { analysisId: id, decision: result.decision, score: result.score }
    });
    return json({ ok: true, id, createdAt: now }, 201);
  }
  if (type === "delete_analysis") {
    const id = safeText(body.id, 80);
    const deletion = await env.FOREX_D1.prepare(`
      DELETE FROM analyses WHERE id = ? AND company_id = ?
    `).bind(id, auth.user.company_id).run();
    if (!deletion.meta?.changes) {
      const error = new Error("Analyse introuvable.");
      error.status = 404;
      throw error;
    }
    await auditBestEffort(env, request, {
      actorUserId: auth.user.id,
      actorCompanyId: auth.user.company_id,
      action: "ANALYSIS_DELETED",
      details: { analysisId: id }
    });
    return json({ ok: true });
  }
  if (type === "company_state") {
    const key = String(body.key || "app_state").trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,40}$/.test(key)) throw new Error("Clé de données invalide.");
    if (["subscription", "plan", "account", "users", "roles", "status"].includes(key)) {
      const error = new Error("Cette catégorie de données est protégée par le serveur.");
      error.status = 403;
      throw error;
    }
    if (containsSensitiveState(body.data)) {
      const error = new Error("La requête contient des champs protégés.");
      error.status = 403;
      throw error;
    }
    const serialized = JSON.stringify(body.data ?? {});
    if (serialized.length > APP_STATE_MAX_BYTES) throw new Error("Données trop volumineuses.");
    const current = await env.FOREX_D1.prepare(`
      SELECT revision FROM company_data WHERE company_id = ? AND data_key = ? LIMIT 1
    `).bind(auth.user.company_id, key).first();
    const expectedRevision = body.revision == null ? null : Number(body.revision);
    if (current && expectedRevision !== null && Number(current.revision) !== expectedRevision) {
      const error = new Error("Les données ont été modifiées sur un autre appareil. Rechargez avant d’enregistrer.");
      error.status = 409;
      throw error;
    }
    const revision = Number(current?.revision || 0) + 1;
    const now = new Date().toISOString();
    await env.FOREX_D1.prepare(`
      INSERT INTO company_data (company_id, data_key, data_json, revision, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(company_id, data_key) DO UPDATE SET
        data_json = excluded.data_json,
        revision = excluded.revision,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `).bind(auth.user.company_id, key, serialized, revision, auth.user.id, now).run();
    await auditBestEffort(env, request, {
      actorUserId: auth.user.id,
      actorCompanyId: auth.user.company_id,
      action: "COMPANY_DATA_SAVED",
      details: { key, revision }
    });
    return json({ ok: true, key, revision, updatedAt: now });
  }
  throw new Error("Type d’enregistrement non pris en charge.");
}

async function handleChangePassword(env, request, auth) {
  if (!auth) {
    const error = new Error("Authentification requise.");
    error.status = 401;
    throw error;
  }
  assertCsrf(request);
  const body = await readJson(request, 10000);
  const currentPassword = String(body.currentPassword || "");
  const newPassword = validatePassword(body.newPassword);
  const credential = await env.FOREX_D1.prepare(`
    SELECT password_hash FROM password_credentials WHERE user_id = ? LIMIT 1
  `).bind(auth.user.id).first();
  if (!credential || !await verifyPassword(currentPassword, credential.password_hash, env.AUTH_PEPPER || "")) {
    const error = new Error("Mot de passe actuel incorrect.");
    error.status = 401;
    throw error;
  }
  const passwordHash = await hashPassword(newPassword, env.AUTH_PEPPER || "");
  const now = new Date().toISOString();
  await env.FOREX_D1.batch([
    env.FOREX_D1.prepare(`
      UPDATE password_credentials SET password_hash = ?, algorithm = 'pbkdf2_sha256', updated_at = ?
      WHERE user_id = ?
    `).bind(passwordHash, now, auth.user.id),
    env.FOREX_D1.prepare(`
      UPDATE users SET session_version = session_version + 1, updated_at = ? WHERE id = ?
    `).bind(now, auth.user.id)
  ]);
  await invalidateAllUserSessions(env, auth.user.id);
  await auditBestEffort(env, request, {
    actorUserId: auth.user.id,
    actorCompanyId: auth.user.company_id || null,
    targetUserId: auth.user.id,
    action: "PASSWORD_CHANGED"
  });
  return json({ ok: true, reconnect: true }, 200, { "Set-Cookie": clearSessionCookie() });
}

async function listAdminAccounts(env, auth) {
  requireRole(auth, "super_admin");
  const result = await env.FOREX_D1.prepare(`
    SELECT
      u.id, u.name, u.email, u.is_active, u.last_login_at, u.created_at,
      u.updated_at, u.company_id,
      c.name AS company_name, c.plan_code, c.plan_started_at,
      c.plan_expires_at, c.status AS company_status
    FROM users u
    JOIN companies c ON c.id = u.company_id
    WHERE u.role = 'member' AND u.deleted_at IS NULL
    ORDER BY u.created_at DESC
  `).all();
  const accounts = (result.results || []).map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    active: Number(row.is_active) === 1 && row.company_status === "active",
    userActive: Number(row.is_active) === 1,
    companyStatus: row.company_status,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    company: { id: row.company_id, name: row.company_name },
    plan: computePlan({
      plan_code: row.plan_code,
      plan_started_at: row.plan_started_at,
      plan_expires_at: row.plan_expires_at,
      status: row.company_status
    })
  }));
  return json({ accounts });
}

async function createAdminAccount(env, request, auth) {
  requireRole(auth, "super_admin");
  assertCsrf(request);
  const body = await readJson(request, 20000);
  const name = safeText(body.name, 100);
  const companyName = safeText(body.companyName, 140);
  const email = validateEmail(body.email);
  const password = validatePassword(body.password);
  const planCode = body.planCode === "business" ? "business" : "free";
  if (name.length < 2 || companyName.length < 2) throw new Error("Nom du membre ou de l’entreprise invalide.");
  const existing = await env.FOREX_D1.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(email).first();
  if (existing) {
    const error = new Error("Cette adresse e-mail existe déjà.");
    error.status = 409;
    throw error;
  }
  const now = new Date();
  const nowIso = now.toISOString();
  const companyId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const expiresAt = addDays(now, planDurationDays(planCode));
  const passwordHash = await hashPassword(password, env.AUTH_PEPPER || "");
  await env.FOREX_D1.batch([
    env.FOREX_D1.prepare(`
      INSERT INTO companies (
        id, name, plan_code, plan_started_at, plan_expires_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `).bind(companyId, companyName, planCode, nowIso, expiresAt, nowIso, nowIso),
    env.FOREX_D1.prepare(`
      INSERT INTO users (
        id, company_id, name, email, role, is_active, session_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'member', 1, 1, ?, ?)
    `).bind(userId, companyId, name, email, nowIso, nowIso),
    env.FOREX_D1.prepare(`
      INSERT INTO password_credentials (user_id, password_hash, algorithm, updated_at)
      VALUES (?, ?, 'pbkdf2_sha256', ?)
    `).bind(userId, passwordHash, nowIso)
  ]);
  await audit(env, request, {
    actorUserId: auth.user.id,
    targetUserId: userId,
    action: "MEMBER_CREATED",
    details: { email, companyId, companyName, planCode, expiresAt }
  });
  return json({ ok: true, id: userId }, 201);
}

async function updateAdminAccount(env, request, auth, userId) {
  requireRole(auth, "super_admin");
  assertCsrf(request);
  const body = await readJson(request, 15000);
  const target = await env.FOREX_D1.prepare(`
    SELECT id, company_id, role FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1
  `).bind(userId).first();
  if (!target || target.role !== "member") {
    const error = new Error("Compte membre introuvable.");
    error.status = 404;
    throw error;
  }
  const name = safeText(body.name, 100);
  const companyName = safeText(body.companyName, 140);
  const email = validateEmail(body.email);
  if (name.length < 2 || companyName.length < 2) throw new Error("Nom du membre ou de l’entreprise invalide.");
  const duplicate = await env.FOREX_D1.prepare("SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1")
    .bind(email, userId).first();
  if (duplicate) {
    const error = new Error("Cette adresse e-mail est déjà utilisée.");
    error.status = 409;
    throw error;
  }
  const now = new Date().toISOString();
  await env.FOREX_D1.batch([
    env.FOREX_D1.prepare("UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ?")
      .bind(name, email, now, userId),
    env.FOREX_D1.prepare("UPDATE companies SET name = ?, updated_at = ? WHERE id = ?")
      .bind(companyName, now, target.company_id)
  ]);
  await audit(env, request, {
    actorUserId: auth.user.id,
    targetUserId: userId,
    action: "MEMBER_UPDATED",
    details: { email, companyName }
  });
  return json({ ok: true });
}

async function setAdminAccountStatus(env, request, auth, userId) {
  requireRole(auth, "super_admin");
  assertCsrf(request);
  const body = await readJson(request, 5000);
  const active = Boolean(body.active);
  const target = await env.FOREX_D1.prepare(`
    SELECT id, company_id, role FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1
  `).bind(userId).first();
  if (!target || target.role !== "member") {
    const error = new Error("Compte membre introuvable.");
    error.status = 404;
    throw error;
  }
  const now = new Date().toISOString();
  await env.FOREX_D1.batch([
    env.FOREX_D1.prepare(`
      UPDATE users SET is_active = ?, session_version = session_version + 1, updated_at = ? WHERE id = ?
    `).bind(active ? 1 : 0, now, userId),
    env.FOREX_D1.prepare("UPDATE companies SET status = ?, updated_at = ? WHERE id = ?")
      .bind(active ? "active" : "disabled", now, target.company_id)
  ]);
  await invalidateAllUserSessions(env, userId);
  await audit(env, request, {
    actorUserId: auth.user.id,
    targetUserId: userId,
    action: active ? "MEMBER_ACTIVATED" : "MEMBER_DISABLED"
  });
  return json({ ok: true, active });
}

async function setAdminAccountPlan(env, request, auth, userId) {
  requireRole(auth, "super_admin");
  assertCsrf(request);
  const body = await readJson(request, 5000);
  const planCode = body.planCode === "business" ? "business" : body.planCode === "free" ? "free" : null;
  if (!planCode) throw new Error("Plan invalide.");
  const target = await env.FOREX_D1.prepare(`
    SELECT id, company_id, role FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1
  `).bind(userId).first();
  if (!target || target.role !== "member") {
    const error = new Error("Compte membre introuvable.");
    error.status = 404;
    throw error;
  }
  const now = new Date();
  const startedAt = now.toISOString();
  const expiresAt = addDays(now, planDurationDays(planCode));
  await env.FOREX_D1.prepare(`
    UPDATE companies
    SET plan_code = ?, plan_started_at = ?, plan_expires_at = ?, status = 'active', updated_at = ?
    WHERE id = ?
  `).bind(planCode, startedAt, expiresAt, startedAt, target.company_id).run();
  await audit(env, request, {
    actorUserId: auth.user.id,
    targetUserId: userId,
    action: "MEMBER_PLAN_CHANGED",
    details: { planCode, startedAt, expiresAt }
  });
  return json({ ok: true, plan: { code: planCode, startedAt, expiresAt } });
}

async function resetAdminAccountPassword(env, request, auth, userId) {
  requireRole(auth, "super_admin");
  assertCsrf(request);
  const body = await readJson(request, 10000);
  const newPassword = validatePassword(body.newPassword);
  const target = await env.FOREX_D1.prepare(`
    SELECT id, company_id, role FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1
  `).bind(userId).first();
  if (!target || target.role !== "member") {
    const error = new Error("Compte membre introuvable.");
    error.status = 404;
    throw error;
  }
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(newPassword, env.AUTH_PEPPER || "");
  await env.FOREX_D1.batch([
    env.FOREX_D1.prepare(`
      UPDATE password_credentials SET password_hash = ?, algorithm = 'pbkdf2_sha256', updated_at = ?
      WHERE user_id = ?
    `).bind(passwordHash, now, userId),
    env.FOREX_D1.prepare(`
      UPDATE users SET session_version = session_version + 1, updated_at = ? WHERE id = ?
    `).bind(now, userId)
  ]);
  await invalidateAllUserSessions(env, userId);
  await audit(env, request, {
    actorUserId: auth.user.id,
    targetUserId: userId,
    action: "MEMBER_PASSWORD_RESET"
  });
  return json({ ok: true });
}

async function deleteAdminAccount(env, request, auth, userId) {
  requireRole(auth, "super_admin");
  assertCsrf(request);
  const target = await env.FOREX_D1.prepare(`
    SELECT id, company_id, role, email FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1
  `).bind(userId).first();
  if (!target || target.role !== "member") {
    const error = new Error("Compte membre introuvable.");
    error.status = 404;
    throw error;
  }
  await invalidateAllUserSessions(env, userId);
  const companyCount = await env.FOREX_D1.prepare(`
    SELECT COUNT(*) AS total FROM users
    WHERE company_id = ? AND role = 'member' AND deleted_at IS NULL
  `).bind(target.company_id).first();
  if (Number(companyCount?.total || 0) <= 1) {
    await env.FOREX_D1.batch([
      env.FOREX_D1.prepare("DELETE FROM company_data WHERE company_id = ?").bind(target.company_id),
      env.FOREX_D1.prepare("DELETE FROM analyses WHERE company_id = ?").bind(target.company_id),
      env.FOREX_D1.prepare("DELETE FROM password_credentials WHERE user_id = ?").bind(userId),
      env.FOREX_D1.prepare("DELETE FROM users WHERE id = ?").bind(userId),
      env.FOREX_D1.prepare("DELETE FROM companies WHERE id = ?").bind(target.company_id)
    ]);
  } else {
    await env.FOREX_D1.batch([
      env.FOREX_D1.prepare("DELETE FROM password_credentials WHERE user_id = ?").bind(userId),
      env.FOREX_D1.prepare("DELETE FROM analyses WHERE user_id = ?").bind(userId),
      env.FOREX_D1.prepare("DELETE FROM users WHERE id = ?").bind(userId)
    ]);
  }
  await audit(env, request, {
    actorUserId: auth.user.id,
    targetUserId: userId,
    action: "MEMBER_DELETED",
    details: { email: target.email, companyId: target.company_id }
  });
  return json({ ok: true });
}

async function listAuditLogs(env, auth) {
  requireRole(auth, "super_admin");
  const result = await env.FOREX_D1.prepare(`
    SELECT
      l.id, l.action, l.ip_address, l.details, l.created_at,
      actor.name AS actor_name, actor.email AS actor_email,
      target.name AS target_name, target.email AS target_email
    FROM audit_logs l
    LEFT JOIN users actor ON actor.id = l.actor_user_id
    LEFT JOIN users target ON target.id = l.target_user_id
    ORDER BY l.created_at DESC
    LIMIT 200
  `).all();
  return json({
    logs: (result.results || []).map(row => ({
      id: row.id,
      action: row.action,
      ipAddress: row.ip_address,
      details: parseStoredJson(row.details, {}),
      createdAt: row.created_at,
      actor: row.actor_name || row.actor_email ? { name: row.actor_name, email: row.actor_email } : null,
      target: row.target_name || row.target_email ? { name: row.target_name, email: row.target_email } : null
    }))
  });
}

async function handleApi(env, request, auth) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (path === "/api/csrf" && method === "GET") return handleCsrf();
  if (path === "/api/status" && method === "GET") return handleStatus(env, auth);
  if (path === "/api/login" && method === "POST") return handleLogin(env, request);
  if (path === "/api/logout" && method === "POST") return handleLogout(env, request, auth);
  if (path === "/api/me" && method === "GET") return handleMe(auth);
  if (path === "/api/load" && method === "GET") return handleLoad(env, auth);
  if (path === "/api/save" && method === "POST") return handleSave(env, request, auth);
  if (path === "/api/change-password" && method === "POST") return handleChangePassword(env, request, auth);

  if (path === "/api/admin/accounts" && method === "GET") return listAdminAccounts(env, auth);
  if (path === "/api/admin/accounts" && method === "POST") return createAdminAccount(env, request, auth);
  if (path === "/api/admin/audit" && method === "GET") return listAuditLogs(env, auth);

  const accountMatch = path.match(/^\/api\/admin\/accounts\/([^/]+)$/);
  if (accountMatch && method === "PATCH") return updateAdminAccount(env, request, auth, decodeURIComponent(accountMatch[1]));
  if (accountMatch && method === "DELETE") return deleteAdminAccount(env, request, auth, decodeURIComponent(accountMatch[1]));

  const statusMatch = path.match(/^\/api\/admin\/accounts\/([^/]+)\/status$/);
  if (statusMatch && method === "POST") return setAdminAccountStatus(env, request, auth, decodeURIComponent(statusMatch[1]));

  const planMatch = path.match(/^\/api\/admin\/accounts\/([^/]+)\/plan$/);
  if (planMatch && method === "POST") return setAdminAccountPlan(env, request, auth, decodeURIComponent(planMatch[1]));

  const resetMatch = path.match(/^\/api\/admin\/accounts\/([^/]+)\/reset-password$/);
  if (resetMatch && method === "POST") return resetAdminAccountPassword(env, request, auth, decodeURIComponent(resetMatch[1]));

  return json({ error: "Route API introuvable." }, 404);
}

function addSecurityHeaders(response, pathname) {
  const output = new Response(response.body, response);
  output.headers.set("X-Content-Type-Options", "nosniff");
  output.headers.set("X-Frame-Options", "DENY");
  output.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  output.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), display-capture=(self)");
  output.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  output.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  output.headers.set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; form-action 'self'; upgrade-insecure-requests");
  if (pathname.startsWith("/api/") || pathname.endsWith(".html") || pathname === "/") {
    output.headers.set("Cache-Control", "no-store");
  }
  return output;
}

async function serveAsset(env, request, pathname = null) {
  if (!pathname) return env.ASSETS.fetch(request);
  const target = new URL(request.url);
  target.pathname = pathname;
  target.search = "";
  return env.ASSETS.fetch(new Request(target.toString(), {
    method: "GET",
    headers: request.headers
  }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (!env.FOREX_KV || !env.FOREX_D1) {
        return addSecurityHeaders(json({ error: "Bindings FOREX_KV ou FOREX_D1 manquants." }, 503), path);
      }
      let auth = null;
      try { auth = await getAuth(env, request); } catch (error) {
        if (path.startsWith("/api/")) throw error;
      }

      if (path.startsWith("/api/")) {
        const response = await handleApi(env, request, auth);
        return addSecurityHeaders(response, path);
      }

      if (path === "/_worker.js") return addSecurityHeaders(new Response("Not found", { status: 404 }), path);

      // Cloudflare Pages canonicalise automatiquement /page.html vers /page.
      // Ne jamais demander un fichier .html à env.ASSETS ici : cela provoquerait
      // une boucle /login -> /login.html -> /login avec le routage Advanced Mode.
      if (path === "/login.html") {
        const canonical = new URL("/login", url);
        canonical.search = url.search;
        return Response.redirect(canonical, 308);
      }
      if (path === "/plan-expired.html") {
        const canonical = new URL("/plan-expired", url);
        canonical.search = url.search;
        return Response.redirect(canonical, 308);
      }

      const isPublicAsset = PUBLIC_ASSETS.has(path) || path.startsWith("/assets/");
      if (isPublicAsset) return addSecurityHeaders(await serveAsset(env, request), path);

      if (path === "/login") {
        if (auth) return Response.redirect(new URL("/", url), 303);
        return addSecurityHeaders(await serveAsset(env, request, "/login"), "/login");
      }

      if (!auth) {
        const loginUrl = new URL("/login", url);
        loginUrl.searchParams.set("next", `${path}${url.search}`);
        return Response.redirect(loginUrl, 303);
      }

      if (path === "/plan-expired") {
        if (auth.user.role === "member" && !auth.plan?.active) {
          return addSecurityHeaders(await serveAsset(env, request, "/plan-expired"), "/plan-expired");
        }
        return Response.redirect(new URL("/", url), 303);
      }

      if (auth.user.role === "member" && !auth.plan?.active) {
        return Response.redirect(new URL("/plan-expired", url), 303);
      }

      if (path === "/app") return Response.redirect(new URL("/", url), 303);
      return addSecurityHeaders(await serveAsset(env, request), path);
    } catch (error) {
      const status = Number(error.status || 400);
      const headers = error.headers || {};
      const body = {
        error: String(error.message || "Erreur serveur."),
        ...(error.code ? { code: error.code } : {})
      };
      return addSecurityHeaders(json(body, status, headers), path);
    }
  }
};
