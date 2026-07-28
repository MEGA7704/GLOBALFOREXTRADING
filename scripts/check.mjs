import { access, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

const required = [
  "public/index.html",
  "public/internal-pages/login.page",
  "public/internal-pages/plan-expired.page",
  "public/_worker.js",
  "public/assets/login.js",
  "public/assets/cloud-shell.js",
  "migrations/0002_security_multitenancy.sql",
  "migrations/0003_runtime_schema_meta.sql",
  "wrangler.toml"
];
for (const file of required) await access(file);

const wrangler = await readFile("wrangler.toml", "utf8");
for (const expected of [
  "FOREX_KV",
  "8e8f17076a7840eba723ca071ae8b76a",
  "FOREX_D1",
  "c15a88c1-f0c6-4c1d-9807-b29c0c0a25ea",
  "SUPER_ADMIN_EMAIL"
]) {
  if (!wrangler.includes(expected)) throw new Error(`Configuration manquante : ${expected}`);
}

const worker = await readFile("public/_worker.js", "utf8");
for (const expected of [
  'path === "/api/login" && method === "POST"',
  'path === "/api/register" && method === "POST"',
  'MEMBER_SELF_REGISTERED',
  'path === "/api/load" && method === "GET"',
  'path === "/api/save" && method === "POST"',
  "HttpOnly; Secure; SameSite=Lax",
  "assertCsrf(request)",
  "invalidateAllUserSessions",
  "password_credentials",
  "ensureDatabaseSchema",
  "CREATE TABLE IF NOT EXISTS users",
  "APP_SCHEMA_VERSION"
]) {
  if (!worker.includes(expected)) throw new Error(`Protection serveur manquante : ${expected}`);
}


if (worker.includes('serveAsset(env, request, "/login")') || worker.includes('serveAsset(env, request, "/login.html")')) {
  throw new Error("Risque de boucle Cloudflare détecté : /login ne doit jamais être demandé à env.ASSETS.");
}
for (const expected of [
  'serveInternalHtml(env, request, "/internal-pages/login.page")',
  'serveInternalHtml(env, request, "/internal-pages/plan-expired.page")',
  'path.startsWith("/internal-pages/")'
]) {
  if (!worker.includes(expected)) throw new Error(`Protection anti-redirection manquante : ${expected}`);
}
// Un ancien fichier _redirects peut rester dans GitHub après un simple téléversement.
// On le supprime dans l'espace de build afin d'empêcher les boucles /login.
await rm("public/_redirects", { force: true });
await rm("public/login.html", { force: true });
await rm("public/plan-expired.html", { force: true });

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

const loginPage = await readFile("public/internal-pages/login.page", "utf8");
for (const expected of ["showRegisterButton", "registerForm", "Créer mon compte", "plan Free de 21 jours"]) {
  if (!loginPage.includes(expected)) throw new Error(`Interface d’inscription manquante : ${expected}`);
}
const loginScript = await readFile("public/assets/login.js", "utf8");
if (!loginScript.includes('/api/register')) throw new Error("Appel navigateur /api/register manquant.");

const browserFiles = (await collectFiles("public")).filter(file => file !== "public/_worker.js");
for (const file of browserFiles) {
  const content = await readFile(file, "utf8").catch(() => "");
  if (/pbkdf2|password_hash|passwordHash|saltText|derivePassword/i.test(content)) {
    throw new Error(`Logique ou données de mot de passe détectées côté navigateur : ${file}`);
  }
  if (/localStorage\s*\./.test(content)) {
    throw new Error(`Utilisation de localStorage détectée : ${file}`);
  }
  if (/\/api\/auth\/login|\/api\/auth\/bootstrap/.test(content)) {
    throw new Error(`Ancienne route d’authentification détectée : ${file}`);
  }
}

console.log("Vérification réussie : sécurité, inscription membre et routage Cloudflare conformes.");
