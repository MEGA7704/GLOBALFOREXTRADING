import { access, readFile, writeFile, rm } from "node:fs/promises";

// Nettoyage défensif d'un ancien fichier de redirection conservé dans GitHub.
await rm("public/_redirects", { force: true });
await rm("public/login.html", { force: true });
await rm("public/plan-expired.html", { force: true });
await rm("public/index.html", { force: true });
await rm("public/internal-pages/login.page", { force: true });
await rm("public/assets/login.js", { force: true });

const required = [
  "public/internal-pages/home.page",
  "public/internal-pages/app.page",
  "public/internal-pages/plan-expired.page",
  "public/_worker.js",
  "public/assets/cloud-shell.js",
  "public/assets/login.css",
  "public/assets/cloud-shell.css",
  "migrations/0001_initial.sql",
  "migrations/0002_security_multitenancy.sql",
  "migrations/0003_runtime_schema_meta.sql",
  "migrations/0004_password_reset_requests.sql",
  "migrations/0005_subscription_plans_v14.sql",
  "wrangler.toml"
];

for (const file of required) await access(file);
const worker = await readFile("public/_worker.js", "utf8");
for (const route of ["/api/login", "/api/register", "/api/password-reset-request", "/api/load", "/api/save", "/api/admin/accounts"]) {
  if (!worker.includes(route)) throw new Error(`Route serveur manquante : ${route}`);
}
await writeFile("public/build-info.json", JSON.stringify({
  name: "GLOBAL FOREX TRADING",
  version: "2.12.0",
  architecture: "Cloudflare Pages Advanced Mode",
  buildAt: new Date().toISOString()
}, null, 2));
console.log("Build validé : accueil unique avec authentification en popup et ressources Cloudflare prêtes.");
