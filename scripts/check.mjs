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
for (const expected of ["showRegisterButton", "registerDialog", "registerForm", "Créer mon compte", "plan Free"]) {
  if (!loginPage.includes(expected)) throw new Error(`Interface d’inscription manquante : ${expected}`);
}
const appPage = await readFile("public/index.html", "utf8");
for (const expected of ["GOBAL TRADING", "Forex Capture Analyzer Edition", "superAdminWorkspace", 'data-role-scope="super_admin"']) {
  if (!appPage.includes(expected)) throw new Error(`Correction d’interface manquante : ${expected}`);
}
if (appPage.includes('<section class="topbar">')) throw new Error("Ancien en-tête dupliqué encore présent.");
if (/onclick="openModal\('CONDITIONS GÉNÉRALES D’UTILISATION/.test(appPage)) throw new Error("Les boutons légaux sous la carte principale doivent être supprimés.");
for (const expected of [
  'id="btnPick" data-role-scope="member">Téléverser',
  'id="btnAnalyze" data-role-scope="member">Analyser',
  'id="btnFit" data-role-scope="member">Ajuster',
  'id="btnReset" data-role-scope="member">Reset',
  'id="btnOpenResults" data-role-scope="member">Résultats',
  'data-cloud-action="history" data-role-scope="member">Historique',
  'id="overlayToggles" data-role-scope="member"'
]) {
  if (!appPage.includes(expected)) throw new Error(`Action d’analyse absente du menu supérieur : ${expected}`);
}
if (appPage.includes("Contrôle — Upload / LIVE / Analyse")) throw new Error("Le titre de contrôle doit être supprimé de la carte d’analyse.");
if (appPage.includes("Dépose une capture sur le canvas, ou clique “Téléverser”, puis “Analyser”.")) throw new Error("Le texte d’aide visible doit être supprimé de la carte d’analyse.");
if ((appPage.match(/id="btnPick"/g) || []).length !== 1) throw new Error("Le bouton Téléverser doit exister une seule fois.");
if ((appPage.match(/id="overlayToggles"/g) || []).length !== 1) throw new Error("Les outils graphiques ne doivent pas être dupliqués.");
const shellScript = await readFile("public/assets/cloud-shell.js", "utf8");
for (const expected of ["activateRoleInterface", 'showAdmin({ inline: true })', 'document.body.classList.add(isAdmin ? "super-admin-mode" : "member-mode")']) {
  if (!shellScript.includes(expected)) throw new Error(`Séparation visuelle des rôles manquante : ${expected}`);
}
const loginScript = await readFile("public/assets/login.js", "utf8");
if (!loginScript.includes('/api/register')) throw new Error("Appel navigateur /api/register manquant.");
if (!loginScript.includes('showModal')) throw new Error("La fenêtre modale d’inscription n’est pas activée au clic.");
if (!loginScript.includes('clearRegistrationFields')) throw new Error("Le formulaire d’inscription doit être vidé à son ouverture pour éviter l’autoremplissage administrateur.");
if (!loginScript.includes('SUPER_ADMIN_EMAIL_RESERVED')) throw new Error("La gestion explicite de l’adresse Super Admin réservée est manquante côté interface.");
if (!worker.includes('constantTimeEqual(email, superAdminEmail)')) throw new Error("La réservation doit viser uniquement l’adresse exacte du Super Admin.");
if (!worker.includes('error.code = "SUPER_ADMIN_EMAIL_RESERVED"')) throw new Error("Code d’erreur d’adresse Super Admin manquant.");
if (!loginPage.includes('name="memberRegistrationEmail"') || !loginPage.includes('autocomplete="off"')) throw new Error("Le champ e-mail membre doit empêcher l’autoremplissage administrateur.");
if (/const PBKDF2_ITERATIONS = (?!100000)/.test(worker)) throw new Error("PBKDF2 doit utiliser exactement 100000 itérations sur Cloudflare Pages.");
if (worker.includes('PBKDF2_ITERATIONS = 600000')) throw new Error("Ancienne valeur PBKDF2 incompatible détectée.");

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

console.log("Vérification réussie : connexion professionnelle, inscription membre sans autoremplissage administrateur, PBKDF2 Cloudflare et sécurité conformes.");
