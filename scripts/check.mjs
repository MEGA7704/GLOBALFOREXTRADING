import { access, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

const required = [
  "public/internal-pages/home.page",
  "public/internal-pages/app.page",
  "public/internal-pages/plan-expired.page",
  "public/_worker.js",
  "public/assets/home.css",
  "public/assets/home.js",
  "public/assets/login.css",
  "public/assets/cloud-shell.css",
  "public/assets/cloud-shell.js",
  "migrations/0002_security_multitenancy.sql",
  "migrations/0003_runtime_schema_meta.sql",
  "migrations/0004_password_reset_requests.sql",
  "migrations/0005_subscription_plans_v14.sql",
  "wrangler.toml"
];
for (const file of required) await access(file);

const wrangler = await readFile("wrangler.toml", "utf8");
for (const expected of [
  "FOREX_KV",
  "8e8f17076a7840eba723ca071ae8b76a",
  "FOREX_D1",
  "c15a88c1-f0c6-4c1d-9807-b29c0c0a25ea",
  "SUPER_ADMIN_EMAIL",
  'FREE_PLAN_DAYS = "7"',
  'STANDARD_PLAN_DAYS = "30"',
  'BUSINESS_PLAN_DAYS = "365"',
  'STANDARD_PRICE_FCFA = "20600"',
  'BUSINESS_PRICE_FCFA = "100600"'
]) {
  if (!wrangler.includes(expected)) throw new Error(`Configuration manquante : ${expected}`);
}

const worker = await readFile("public/_worker.js", "utf8");
for (const expected of [
  'path === "/api/login" && method === "POST"',
  'path === "/api/register" && method === "POST"',
  'path === "/api/password-reset-request" && method === "POST"',
  'path === "/api/load" && method === "GET"',
  'path === "/api/save" && method === "POST"',
  'MEMBER_SELF_REGISTERED',
  "HttpOnly; Secure; SameSite=Lax",
  "assertCsrf(request)",
  "invalidateAllUserSessions",
  "password_credentials",
  "password_reset_requests",
  "company_subscriptions",
  "STANDARD_PLAN_DAYS",
  "STANDARD_PRICE_FCFA",
  "ensureDatabaseSchema",
  'serveInternalHtml(env, request, "/internal-pages/home.page")',
  'serveInternalHtml(env, request, "/internal-pages/app.page")',
  'serveInternalHtml(env, request, "/internal-pages/plan-expired.page")',
  'path.startsWith("/internal-pages/")'
]) {
  if (!worker.includes(expected)) throw new Error(`Protection ou fonctionnalité serveur manquante : ${expected}`);
}
if (worker.includes('serveAsset(env, request, "/login")') || worker.includes('serveAsset(env, request, "/login.html")')) {
  throw new Error("Risque de boucle Cloudflare détecté sur /login.");
}
if (/const PBKDF2_ITERATIONS = (?!100000)/.test(worker)) throw new Error("PBKDF2 doit utiliser exactement 100000 itérations.");

await rm("public/_redirects", { force: true });
await rm("public/login.html", { force: true });
await rm("public/plan-expired.html", { force: true });
await rm("public/index.html", { force: true });
await rm("public/internal-pages/login.page", { force: true });
await rm("public/assets/login.js", { force: true });

try { await access("public/index.html"); throw new Error("L’ancienne page d’accueil public/index.html ne doit plus être présente."); } catch (error) { if (error && error.message && error.message.includes("ancienne page")) throw error; }

const homePage = await readFile("public/internal-pages/home.page", "utf8");
for (const expected of [
  "GLOBAL FOREX TRADING",
  "Forex Capture Analyzer Edition",
  "Commencer l’analyse",
  "FORMULES D’ACCÈS",
  "7 jours",
  "30 jours",
  "365 jours",
  "20 600 FCFA",
  "100 600 FCFA",
  'id="loginDialog"',
  'id="registerDialog"',
  'data-auth="login"',
  'data-auth="register"'
]) {
  if (!homePage.includes(expected)) throw new Error(`Page d’accueil incomplète : ${expected}`);
}

const homeScript = await readFile("public/assets/home.js", "utf8");
for (const expected of ["/api/login", "/api/register", "/api/password-reset-request", "openDialog", "registerDialog", "loginDialog"]) {
  if (!homeScript.includes(expected)) throw new Error(`Authentification popup incomplète : ${expected}`);
}
if (await readFile("public/internal-pages/home.page", "utf8").then(v => !v.includes('id="loginDialog"') || !v.includes('id="registerDialog"'))) {
  throw new Error("Les popups Connexion / Inscription doivent être intégrés à la page d’accueil.");
}

const appPage = await readFile("public/internal-pages/app.page", "utf8");
for (const expected of ["GLOBAL FOREX TRADING", "Forex Capture Analyzer Edition", "superAdminWorkspace", 'data-role-scope="super_admin"']) {
  if (!appPage.includes(expected)) throw new Error(`Interface application manquante : ${expected}`);
}
if (appPage.includes('<section class="topbar">')) throw new Error("Ancien en-tête dupliqué encore présent.");
if ((appPage.match(/id="btnPick"/g) || []).length !== 1) throw new Error("Le bouton Téléverser doit exister une seule fois.");
if ((appPage.match(/id="overlayToggles"/g) || []).length !== 1) throw new Error("Les outils graphiques ne doivent pas être dupliqués.");

const shellScript = await readFile("public/assets/cloud-shell.js", "utf8");
for (const expected of [
  "activateRoleInterface",
  'showAdmin({ inline: true })',
  '"standard"',
  "20 600 FCFA",
  "100 600 FCFA"
]) {
  if (!shellScript.includes(expected)) throw new Error(`Gestion des plans ou des rôles incomplète : ${expected}`);
}


async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else files.push(path);
  }
  return files;
}
const browserFiles = (await collectFiles("public")).filter(file => file !== "public/_worker.js");
for (const file of browserFiles) {
  const content = await readFile(file, "utf8").catch(() => "");
  if (/pbkdf2|password_hash|passwordHash|saltText|derivePassword/i.test(content)) {
    throw new Error(`Logique ou données de mot de passe détectées côté navigateur : ${file}`);
  }
  if (/localStorage\s*\./.test(content)) throw new Error(`Utilisation de localStorage détectée : ${file}`);
}

console.log("Vérification réussie : accueil public, authentification en popup, trois plans et sécurité conformes.");
