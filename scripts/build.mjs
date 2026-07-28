import { access, readFile, writeFile, rm } from "node:fs/promises";

// Nettoyage défensif d'un ancien fichier de redirection conservé dans GitHub.
await rm("public/_redirects", { force: true });

const required = [
  "public/index.html",
  "public/login.html",
  "public/plan-expired.html",
  "public/_worker.js",
  "public/assets/cloud-shell.js",
  "public/assets/cloud-shell.css",
  "migrations/0001_initial.sql",
  "migrations/0002_security_multitenancy.sql",
  "wrangler.toml"
];

for (const file of required) await access(file);
const worker = await readFile("public/_worker.js", "utf8");
for (const route of ["/api/login", "/api/load", "/api/save", "/api/admin/accounts"]) {
  if (!worker.includes(route)) throw new Error(`Route serveur manquante : ${route}`);
}
await writeFile("public/build-info.json", JSON.stringify({
  name: "GLOBAL FOREX TRADING",
  version: "2.0.2",
  architecture: "Cloudflare Pages Advanced Mode",
  buildAt: new Date().toISOString()
}, null, 2));
console.log("Build validé : public/_worker.js et les ressources statiques sont prêts pour Cloudflare Pages.");
