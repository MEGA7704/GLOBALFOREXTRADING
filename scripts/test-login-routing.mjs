import { readFile } from "node:fs/promises";
import worker from "../public/_worker.js";

const env = {
  FOREX_KV: { get: async () => null },
  FOREX_D1: {
    prepare(sql) {
      const statement = { sql, values: [], bind(...values) { this.values = values; return this; },
        async first() { if (sql.includes("sqlite_master") && sql.includes("name = ?")) return { name: this.values[0] }; return null; },
        async all() {
          if (sql.includes("PRAGMA table_info(users)")) return { results: ["id","company_id","name","email","role","is_active","session_version","last_login_at","created_at","updated_at","deleted_at"].map(name=>({name})) };
          if (sql.includes("PRAGMA table_info(password_credentials)")) return { results: ["user_id","password_hash","algorithm","updated_at"].map(name=>({name})) };
          if (sql.includes("PRAGMA table_info(password_reset_requests)")) return { results: ["id","user_id","email","requester_name","message","status","created_at","resolved_at","resolved_by"].map(name=>({name})) };
          if (sql.includes("sqlite_master") && sql.includes("name IN")) return { results: ["companies","company_subscriptions","users","password_credentials","password_reset_requests","analyses","audit_logs","company_data","app_schema_meta"].map(name=>({name})) };
          return { results: [] };
        }, async run(){ return {success:true,meta:{changes:0}}; } };
      return statement;
    }, async batch(statements){ return statements.map(()=>({success:true})); }
  },
  ASSETS: { async fetch(request) {
    const path = new URL(request.url).pathname;
    const map = { "/internal-pages/home.page":"public/internal-pages/home.page", "/internal-pages/app.page":"public/internal-pages/app.page", "/internal-pages/plan-expired.page":"public/internal-pages/plan-expired.page" };
    if (map[path]) return new Response(await readFile(map[path]), { status:200, headers:{"Content-Type":"application/octet-stream"} });
    return new Response("Not found",{status:404});
  }}
};
async function request(path){ return worker.fetch(new Request(`https://test.local${path}`),env); }

const root=await request("/");
if(root.status!==200) throw new Error(`La page d’accueil doit répondre 200, reçu ${root.status}`);
const body=await root.text();
for(const expected of ['id="loginDialog"','id="registerDialog"','data-auth="login"','data-auth="register"']) if(!body.includes(expected)) throw new Error(`Popup d’authentification absent : ${expected}`);

const login=await request("/login?next=%2Fapp");
if(login.status!==303) throw new Error(`/login doit rediriger vers l’accueil popup, reçu ${login.status}`);
if(login.headers.get("location")!=="https://test.local/?auth=login&next=%2Fapp") throw new Error(`Redirection /login incorrecte : ${login.headers.get("location")}`);

const register=await request("/login?register=1&next=%2Fapp");
if(register.status!==303) throw new Error(`Inscription héritée doit rediriger, reçu ${register.status}`);
if(register.headers.get("location")!=="https://test.local/?auth=register&next=%2Fapp") throw new Error(`Redirection inscription incorrecte : ${register.headers.get("location")}`);

const legacy=await request("/login.html?next=%2Fapp");
if(legacy.status!==303) throw new Error(`/login.html doit rediriger vers l’accueil popup, reçu ${legacy.status}`);
if(legacy.headers.get("location")!=="https://test.local/?auth=login&next=%2Fapp") throw new Error(`Redirection /login.html incorrecte : ${legacy.headers.get("location")}`);

const internal=await request("/internal-pages/login.page");
if(internal.status!==404) throw new Error("L’ancienne page interne de connexion ne doit pas être accessible.");
console.log("Test réussi : toute connexion/inscription passe par un popup de la page d’accueil.");
