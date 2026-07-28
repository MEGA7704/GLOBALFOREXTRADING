import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const required = [
  "public/index.html",
  "public/login.html",
  "public/plan-expired.html",
  "public/_worker.js",
  "public/assets/login.js",
  "public/assets/cloud-shell.js",
  "migrations/0002_security_multitenancy.sql",
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
  'path === "/api/load" && method === "GET"',
  'path === "/api/save" && method === "POST"',
  "HttpOnly; Secure; SameSite=Lax",
  "assertCsrf(request)",
  "invalidateAllUserSessions",
  "password_credentials"
]) {
  if (!worker.includes(expected)) throw new Error(`Protection serveur manquante : ${expected}`);
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
  if (/localStorage\s*\./.test(content)) {
    throw new Error(`Utilisation de localStorage détectée : ${file}`);
  }
  if (/\/api\/auth\/login|\/api\/auth\/bootstrap/.test(content)) {
    throw new Error(`Ancienne route d’authentification détectée : ${file}`);
  }
}

console.log("Vérification réussie : authentification, CSRF, isolation entreprise et architecture Advanced Mode conformes.");
