import { readFile } from "node:fs/promises";
import worker from "../public/_worker.js";

const env = {
  FOREX_KV: { get: async () => null },
  FOREX_D1: {},
  ASSETS: {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/internal-pages/login.page") {
        return new Response(await readFile("public/internal-pages/login.page"), {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" }
        });
      }
      if (path === "/internal-pages/plan-expired.page") {
        return new Response(await readFile("public/internal-pages/plan-expired.page"), {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" }
        });
      }
      return new Response("Not found", { status: 404 });
    }
  }
};

async function request(path) {
  return worker.fetch(new Request(`https://test.local${path}`), env);
}

const login = await request("/login?next=%2F");
if (login.status !== 200) throw new Error(`/login doit répondre 200, reçu ${login.status}`);
if (!String(login.headers.get("content-type") || "").startsWith("text/html")) {
  throw new Error("/login doit répondre avec Content-Type text/html.");
}
if (login.headers.has("location")) throw new Error("/login ne doit pas rediriger.");
const loginBody = await login.text();
if (!loginBody.includes("Connexion sécurisée")) throw new Error("Contenu de connexion absent.");

const legacy = await request("/login.html?next=%2F");
if (legacy.status !== 308) throw new Error(`/login.html doit répondre 308, reçu ${legacy.status}`);
if (legacy.headers.get("location") !== "https://test.local/login?next=%2F") {
  throw new Error(`Redirection héritée incorrecte : ${legacy.headers.get("location")}`);
}

const root = await request("/");
if (root.status !== 303 || root.headers.get("location") !== "https://test.local/login?next=%2F") {
  throw new Error("La racine non authentifiée doit rediriger une seule fois vers /login?next=%2F.");
}

const internal = await request("/internal-pages/login.page");
if (internal.status !== 404) throw new Error("Les pages internes ne doivent pas être accessibles directement.");

console.log("Test anti-boucle réussi : /login répond 200 sans en-tête Location.");
