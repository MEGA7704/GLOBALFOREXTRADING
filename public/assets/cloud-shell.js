(() => {
  const PAYMENT_URL = "https://pay.wave.com/m/M_ci_Enx-2JNAklk-/c/ci/?amount=365000";
  const FREE_POPUP_INTERVAL = 15 * 60 * 1000;
  const state = {
    user: null,
    company: null,
    plan: null,
    history: [],
    data: {},
    csrfToken: "",
    saving: false,
    freeTimer: null
  };
  const $ = (id) => document.getElementById(id);
  const toastStack = document.createElement("div");
  toastStack.className = "cloud-toast-stack";
  document.body.appendChild(toastStack);

  function toast(message, type = "success") {
    const element = document.createElement("div");
    element.className = `cloud-toast ${type}`;
    element.textContent = message;
    toastStack.appendChild(element);
    setTimeout(() => element.remove(), 4200);
  }

  function setSync(label, mode = "") {
    const element = $("cloudSyncStatus");
    if (!element) return;
    element.className = `cloud-sync ${mode}`.trim();
    const labelNode = element.querySelector("span");
    if (labelNode) labelNode.textContent = label;
    else element.append(` ${label}`);
  }

  async function refreshCsrf() {
    const response = await fetch("/api/csrf", { credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.csrfToken) throw new Error(data.error || "Jeton CSRF indisponible.");
    state.csrfToken = data.csrfToken;
    return state.csrfToken;
  }

  async function api(path, options = {}, retryCsrf = true) {
    const method = String(options.method || "GET").toUpperCase();
    if (!["GET", "HEAD"].includes(method) && !state.csrfToken) await refreshCsrf();
    const headers = {
      "Content-Type": "application/json",
      "X-Requested-With": "ForexCloud",
      ...(options.headers || {})
    };
    if (!["GET", "HEAD"].includes(method)) headers["X-CSRF-Token"] = state.csrfToken;
    const response = await fetch(path, {
      ...options,
      method,
      headers,
      credentials: "same-origin"
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      location.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      throw new Error("Session expirée.");
    }
    if (response.status === 403 && /CSRF/i.test(data.error || "") && retryCsrf) {
      await refreshCsrf();
      return api(path, options, false);
    }
    if (data.code === "PLAN_EXPIRED") {
      location.replace("/plan-expired");
      throw new Error(data.error || "Abonnement expiré.");
    }
    if (!response.ok) {
      const error = new Error(data.error || "Erreur de communication avec le cloud.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function closeDialog() {
    document.querySelector(".cloud-dialog-backdrop")?.remove();
  }

  function dialog(title, content, options = {}) {
    closeDialog();
    const backdrop = document.createElement("div");
    backdrop.className = `cloud-dialog-backdrop${options.className ? ` ${options.className}` : ""}`;
    backdrop.innerHTML = `<section class="cloud-dialog" role="dialog" aria-modal="true"><div class="cloud-dialog__head"><h3></h3><button type="button" aria-label="Fermer">Fermer</button></div><div class="cloud-dialog__body"></div></section>`;
    backdrop.querySelector("h3").textContent = title;
    backdrop.querySelector(".cloud-dialog__body").append(content);
    backdrop.querySelector(".cloud-dialog__head button").addEventListener("click", closeDialog);
    if (!options.locked) backdrop.addEventListener("click", event => { if (event.target === backdrop) closeDialog(); });
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function value(input) {
    return input === null || input === undefined || input === "" ? "—" : String(input);
  }

  function formatDate(input) {
    try {
      return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(input));
    } catch {
      return value(input);
    }
  }

  function formatDateOnly(input) {
    try {
      return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(input));
    } catch {
      return value(input);
    }
  }

  function escapeHtml(text) {
    return String(text ?? "").replace(/[&<>'"]/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[character]));
  }

  function randomPassword() {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnopqrstuvwxyz";
    const digits = "23456789";
    const symbols = "@#$%!?";
    const all = upper + lower + digits + symbols;
    const random = (alphabet) => alphabet[crypto.getRandomValues(new Uint32Array(1))[0] % alphabet.length];
    let password = random(upper) + random(lower) + random(digits) + random(symbols);
    while (password.length < 14) password += random(all);
    return password.split("").sort(() => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 - 0.5).join("");
  }

  function updateHeader() {
    if (!state.user) return;
    $("cloudUserName").textContent = state.user.name;
    $("cloudUserRole").textContent = state.user.role === "super_admin" ? "Super Admin" : `${state.company?.name || "Entreprise"}`;
    $("cloudAvatar").textContent = state.user.name.trim().charAt(0).toUpperCase() || "U";

    document.querySelectorAll("[data-role-scope]").forEach(element => {
      element.hidden = element.dataset.roleScope !== state.user.role;
    });

    const planBadge = $("cloudPlanBadge");
    if (planBadge) {
      if (state.user.role === "super_admin") {
        planBadge.textContent = "ADMINISTRATION";
        planBadge.className = "cloud-plan-badge admin";
        planBadge.removeAttribute("title");
      } else {
        planBadge.textContent = `${state.plan?.label || "Plan"} · ${state.plan?.daysRemaining ?? 0} j`;
        planBadge.className = `cloud-plan-badge ${state.plan?.code || "free"}`;
        planBadge.title = `Expiration : ${formatDateOnly(state.plan?.expiresAt)}`;
      }
    }
  }

  function activateRoleInterface() {
    const isAdmin = state.user?.role === "super_admin";
    document.body.dataset.cloudRole = isAdmin ? "super_admin" : "member";
    document.body.classList.remove("role-pending", "member-mode", "super-admin-mode", "locked");
    document.body.classList.add(isAdmin ? "super-admin-mode" : "member-mode");

    const tradingWorkspace = $("tradingWorkspace");
    const adminWorkspace = $("superAdminWorkspace");
    if (tradingWorkspace) tradingWorkspace.hidden = isAdmin;
    if (adminWorkspace) adminWorkspace.hidden = !isAdmin;

    if (isAdmin) {
      const disclaimer = $("disclaimerOverlay");
      if (disclaimer) disclaimer.style.display = "none";
    }

    window.dispatchEvent(new CustomEvent("cloud-auth-ready", { detail: { role: state.user?.role } }));
  }

  async function loadUser() {
    await refreshCsrf();
    const data = await api("/api/me");
    state.user = data.user;
    state.company = data.company;
    state.plan = data.plan;
    updateHeader();
    activateRoleInterface();
    setSync("Cloud connecté");
    if (state.user.role === "member") {
      await loadCompanyData();
      setupFreePlanMessages();
    } else {
      await showAdmin({ inline: true });
    }
  }

  async function loadCompanyData() {
    setSync("Chargement…", "busy");
    const data = await api("/api/load");
    state.history = data.analyses || [];
    state.data = data.data || {};
    state.plan = data.plan || state.plan;
    updateHeader();
    setSync("Synchronisé");
    window.dispatchEvent(new CustomEvent("forex-cloud-loaded", { detail: data }));
    return data;
  }

  async function saveAnalysis(meta, options = {}) {
    if (!meta || !meta.conclusionText || state.saving || state.user?.role !== "member") return;
    state.saving = true;
    setSync("Enregistrement…", "busy");
    try {
      await api("/api/save", {
        method: "POST",
        body: JSON.stringify({
          type: "analysis",
          sourceType: options.sourceType || "capture",
          result: meta
        })
      });
      setSync("Synchronisé");
      if (!options.silent) toast(options.automatic ? "Analyse enregistrée dans D1." : "Résultat enregistré.");
    } catch (error) {
      setSync("Erreur cloud", "error");
      toast(error.message, "error");
    } finally {
      state.saving = false;
      setTimeout(() => setSync("Cloud connecté"), 1800);
    }
  }

  async function saveCompanyState(key, data, revision = null) {
    const response = await api("/api/save", {
      method: "POST",
      body: JSON.stringify({ type: "company_state", key, data, revision })
    });
    state.data[key] = { value: data, revision: response.revision, updatedAt: response.updatedAt };
    return response;
  }

  window.CloudApp = { saveAnalysis, saveCompanyState, reload: loadCompanyData };

  function showPlanPopup() {
    if (state.user?.role !== "member" || state.plan?.code !== "free") return;
    if (document.querySelector(".cloud-upgrade-backdrop")) return;
    const backdrop = document.createElement("div");
    backdrop.className = "cloud-upgrade-backdrop";
    backdrop.innerHTML = `
      <section class="cloud-dialog" role="dialog" aria-modal="true" aria-labelledby="upgradeTitle">
        <div class="cloud-dialog__body">
          <div class="cloud-upgrade">
            <div class="cloud-upgrade__icon">365</div>
            <div class="cloud-upgrade__eyebrow">PLAN FREE ACTIF</div>
            <h2 id="upgradeTitle">Passez à la version Business</h2>
            <p>Votre plan Free donne un accès complet pendant <b>21 jours</b>. Le plan Business maintient l’accès complet pendant <b>365 jours</b>.</p>
            <div class="cloud-upgrade__grid">
              <article><span>Plan actuel</span><b>Free</b><small>${escapeHtml(String(state.plan.daysRemaining ?? 0))} jour(s) restant(s)</small></article>
              <article><span>Plan recommandé</span><b>Business</b><small>365 jours d’accès complet</small></article>
            </div>
            <div class="cloud-upgrade__actions">
              <button type="button" class="secondary" data-understood>Compris</button>
              <button type="button" class="primary" data-buy>Acheter mon plan Business</button>
            </div>
          </div>
        </div>
      </section>`;
    const closeUpgrade = () => backdrop.remove();
    backdrop.querySelector("[data-understood]").addEventListener("click", closeUpgrade);
    backdrop.querySelector("[data-buy]").addEventListener("click", () => window.open(PAYMENT_URL, "_blank", "noopener,noreferrer"));
    document.body.appendChild(backdrop);
  }

  function setupFreePlanMessages() {
    if (state.freeTimer) clearInterval(state.freeTimer);
    if (state.plan?.code !== "free") return;
    setTimeout(showPlanPopup, 700);
    state.freeTimer = setInterval(showPlanPopup, FREE_POPUP_INTERVAL);
  }

  async function showHistory() {
    if (state.user?.role !== "member") return;
    const wrap = document.createElement("div");
    wrap.innerHTML = `<div class="cloud-toolbar"><div><b>Analyses de ${escapeHtml(state.company?.name || "l’entreprise")}</b><div class="note">Historique isolé par entreprise dans Cloudflare D1.</div></div><div><button class="primary" data-refresh>Actualiser</button></div></div><div class="cloud-history-list"><div class="cloud-empty">Chargement…</div></div>`;
    dialog("Historique des analyses", wrap);
    const list = wrap.querySelector(".cloud-history-list");
    async function refresh() {
      list.innerHTML = `<div class="cloud-empty">Chargement…</div>`;
      try {
        await loadCompanyData();
        if (!state.history.length) {
          list.innerHTML = `<div class="cloud-empty">Aucune analyse enregistrée pour le moment.</div>`;
          return;
        }
        list.innerHTML = state.history.map(item => `<article class="cloud-history-card" data-id="${escapeHtml(item.id)}"><div><strong>${escapeHtml(item.conclusion || item.decision || "Analyse")}</strong><small>${escapeHtml(formatDate(item.created_at))} · ${escapeHtml(item.source_type)}</small></div><div class="cloud-metric"><span>Décision</span><b>${escapeHtml(value(item.decision))}</b></div><div class="cloud-metric"><span>Score</span><b>${escapeHtml(value(item.score))}/100</b></div><div class="cloud-metric"><span>Risque</span><b>${escapeHtml(value(item.risk))}/100</b></div><div class="cloud-metric"><span>Timeframe</span><b>${escapeHtml(value(item.timeframe))}</b></div><div class="cloud-history-actions"><button data-view>Voir</button><button class="delete" data-delete>Supprimer</button></div></article>`).join("");
        list.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => {
          const item = state.history.find(entry => entry.id === button.closest("article").dataset.id);
          const pre = document.createElement("pre");
          pre.className = "cloud-json";
          pre.textContent = JSON.stringify(item?.raw_result || item, null, 2);
          dialog("Détail de l’analyse", pre);
        }));
        list.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", async () => {
          const id = button.closest("article").dataset.id;
          if (!confirm("Supprimer définitivement cette analyse ?")) return;
          try {
            await api("/api/save", { method: "POST", body: JSON.stringify({ type: "delete_analysis", id }) });
            toast("Analyse supprimée.");
            await refresh();
          } catch (error) {
            toast(error.message, "error");
          }
        }));
      } catch (error) {
        list.innerHTML = `<div class="cloud-empty">${escapeHtml(error.message)}</div>`;
      }
    }
    wrap.querySelector("[data-refresh]").addEventListener("click", refresh);
    refresh();
  }

  function accountCard(account) {
    const planClass = account.plan?.code === "business" ? "business" : "free";
    return `<article class="admin-account-card" data-id="${escapeHtml(account.id)}">
      <div class="admin-account-main"><span class="admin-state ${account.active ? "active" : "disabled"}">${account.active ? "ACTIF" : "DÉSACTIVÉ"}</span><h4>${escapeHtml(account.name)}</h4><p>${escapeHtml(account.email)}</p><small>${escapeHtml(account.company?.name || "Entreprise")}</small></div>
      <div class="admin-account-plan ${planClass}"><span>PLAN</span><b>${escapeHtml(account.plan?.label || "Free")}</b><small>Expire le ${escapeHtml(formatDateOnly(account.plan?.expiresAt))}</small><em>${escapeHtml(String(account.plan?.daysRemaining ?? 0))} jour(s)</em></div>
      <div class="admin-account-meta"><span>Dernière connexion</span><b>${escapeHtml(account.lastLoginAt ? formatDate(account.lastLoginAt) : "Jamais")}</b><span>Créé le</span><b>${escapeHtml(formatDateOnly(account.createdAt))}</b></div>
      <div class="admin-account-actions"><button data-edit>Modifier</button><button data-status>${account.active ? "Désactiver" : "Activer"}</button><button data-plan>Changer le plan</button><button data-reset>Mot de passe perdu</button><button class="danger" data-delete>Supprimer</button></div>
    </article>`;
  }

  async function showAdmin(options = {}) {
    if (state.user?.role !== "super_admin") return;
    const inline = options.inline ?? document.body.classList.contains("super-admin-mode");
    const wrap = document.createElement("div");
    wrap.className = "admin-console";
    wrap.innerHTML = `
      <section class="admin-overview">
        <div><span>CENTRE D’ADMINISTRATION</span><h1>Gestion des membres</h1><p>Gérez les comptes, les accès, les abonnements et les opérations sensibles.</p></div>
        <div class="admin-overview-actions"><button class="primary" data-create>+ Nouveau membre</button><button data-audit>Journal sensible</button><button data-system>État du système</button><button data-refresh>Actualiser</button></div>
      </section>
      <section class="admin-summary" aria-label="Résumé des comptes">
        <article><span>Total membres</span><b data-total>—</b></article>
        <article><span>Comptes actifs</span><b data-active>—</b></article>
        <article><span>Plan Free</span><b data-free>—</b></article>
        <article><span>Plan Business</span><b data-business>—</b></article>
      </section>
      <section class="admin-members-panel">
        <div class="admin-panel-head"><div><span>RÉPERTOIRE</span><h2>Liste des membres</h2></div><p>Chaque compte reste isolé dans son entreprise.</p></div>
        <div class="admin-account-list"><div class="cloud-empty">Chargement des comptes…</div></div>
      </section>`;

    if (inline) {
      const workspace = $("superAdminWorkspace");
      if (!workspace) return;
      workspace.hidden = false;
      workspace.replaceChildren(wrap);
    } else {
      dialog("Gestion des membres", wrap, { className: "admin-dialog" });
    }

    const list = wrap.querySelector(".admin-account-list");

    function updateSummary(accounts) {
      wrap.querySelector("[data-total]").textContent = String(accounts.length);
      wrap.querySelector("[data-active]").textContent = String(accounts.filter(account => account.active).length);
      wrap.querySelector("[data-free]").textContent = String(accounts.filter(account => account.plan?.code === "free").length);
      wrap.querySelector("[data-business]").textContent = String(accounts.filter(account => account.plan?.code === "business").length);
    }

    async function refresh() {
      list.innerHTML = `<div class="cloud-empty">Chargement des comptes…</div>`;
      try {
        const data = await api("/api/admin/accounts");
        const accounts = data.accounts || [];
        updateSummary(accounts);
        if (!accounts.length) {
          list.innerHTML = `<div class="cloud-empty">Aucun compte membre. Cliquez sur « Nouveau membre ».</div>`;
          return;
        }
        list.innerHTML = accounts.map(accountCard).join("");
        wireAccountActions(accounts);
      } catch (error) {
        list.innerHTML = `<div class="cloud-empty">${escapeHtml(error.message)}</div>`;
      }
    }

    function wireAccountActions(accounts) {
      list.querySelectorAll(".admin-account-card").forEach(card => {
        const account = accounts.find(item => item.id === card.dataset.id);
        card.querySelector("[data-edit]").addEventListener("click", async () => {
          const name = prompt("Nom du membre :", account.name);
          if (name === null) return;
          const email = prompt("Adresse e-mail :", account.email);
          if (email === null) return;
          const companyName = prompt("Nom de l’entreprise :", account.company?.name || "");
          if (companyName === null) return;
          try {
            await api(`/api/admin/accounts/${encodeURIComponent(account.id)}`, {
              method: "PATCH",
              body: JSON.stringify({ name, email, companyName })
            });
            toast("Compte modifié.");
            refresh();
          } catch (error) { toast(error.message, "error"); }
        });
        card.querySelector("[data-status]").addEventListener("click", async () => {
          const active = !account.active;
          if (!confirm(`${active ? "Activer" : "Désactiver"} le compte de ${account.name} ?`)) return;
          try {
            await api(`/api/admin/accounts/${encodeURIComponent(account.id)}/status`, {
              method: "POST",
              body: JSON.stringify({ active })
            });
            toast(active ? "Compte activé." : "Compte désactivé.");
            refresh();
          } catch (error) { toast(error.message, "error"); }
        });
        card.querySelector("[data-plan]").addEventListener("click", async () => {
          const current = account.plan?.code || "free";
          const requested = prompt("Saisissez FREE ou BUSINESS :", current.toUpperCase());
          if (requested === null) return;
          const planCode = requested.trim().toLowerCase();
          if (!["free", "business"].includes(planCode)) return toast("Plan invalide.", "error");
          if (!confirm(`Appliquer le plan ${planCode.toUpperCase()} à partir d’aujourd’hui ?`)) return;
          try {
            await api(`/api/admin/accounts/${encodeURIComponent(account.id)}/plan`, {
              method: "POST",
              body: JSON.stringify({ planCode })
            });
            toast(`Plan ${planCode === "business" ? "Business 365 jours" : "Free 21 jours"} appliqué.`);
            refresh();
          } catch (error) { toast(error.message, "error"); }
        });
        card.querySelector("[data-reset]").addEventListener("click", async () => {
          const suggested = randomPassword();
          const newPassword = prompt(`Nouveau mot de passe temporaire pour ${account.name} :`, suggested);
          if (newPassword === null) return;
          if (!confirm("Réinitialiser le mot de passe et déconnecter toutes les sessions de ce membre ?")) return;
          try {
            await api(`/api/admin/accounts/${encodeURIComponent(account.id)}/reset-password`, {
              method: "POST",
              body: JSON.stringify({ newPassword })
            });
            toast("Mot de passe réinitialisé. Communiquez-le au membre par un canal sûr.");
          } catch (error) { toast(error.message, "error"); }
        });
        card.querySelector("[data-delete]").addEventListener("click", async () => {
          if (!confirm(`Supprimer définitivement le compte de ${account.name} et ses données d’entreprise ?`)) return;
          const confirmation = prompt("Tapez SUPPRIMER pour confirmer :", "");
          if (confirmation !== "SUPPRIMER") return;
          try {
            await api(`/api/admin/accounts/${encodeURIComponent(account.id)}`, { method: "DELETE", body: "{}" });
            toast("Compte supprimé.");
            refresh();
          } catch (error) { toast(error.message, "error"); }
        });
      });
    }

    wrap.querySelector("[data-create]").addEventListener("click", () => showCreateMember(refresh));
    wrap.querySelector("[data-audit]").addEventListener("click", showAuditLogs);
    wrap.querySelector("[data-system]").addEventListener("click", showSystemStatus);
    wrap.querySelector("[data-refresh]").addEventListener("click", refresh);
    await refresh();
  }

  function showCreateMember(onCreated) {
    const form = document.createElement("form");
    form.className = "admin-form";
    const generatedPassword = randomPassword();
    form.innerHTML = `
      <div class="admin-form-grid">
        <label>Nom du membre<input name="name" required minlength="2" maxlength="100" placeholder="Nom et prénoms"/></label>
        <label>Adresse e-mail<input name="email" type="email" required maxlength="180" placeholder="membre@entreprise.com"/></label>
        <label>Nom de l’entreprise<input name="companyName" required minlength="2" maxlength="140" placeholder="Entreprise du membre"/></label>
        <label>Plan<select name="planCode"><option value="free">Free — 21 jours</option><option value="business">Business — 365 jours</option></select></label>
        <label class="wide">Mot de passe initial<input name="password" required minlength="12" maxlength="128" value="${escapeHtml(generatedPassword)}"/></label>
      </div>
      <div class="admin-form-note">Le mot de passe est haché uniquement dans <code>public/_worker.js</code>. Aucun hash ni sel n’est renvoyé au navigateur.</div>
      <div class="admin-form-actions"><button type="button" data-cancel>Annuler</button><button type="submit" class="primary">Créer le compte</button></div>`;
    dialog("Créer un compte membre", form);
    form.querySelector("[data-cancel]").addEventListener("click", () => { closeDialog(); showAdmin(); });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        await api("/api/admin/accounts", { method: "POST", body: JSON.stringify(payload) });
        toast("Compte membre créé.");
        closeDialog();
        await showAdmin();
        if (typeof onCreated === "function") onCreated();
      } catch (error) {
        toast(error.message, "error");
        button.disabled = false;
      }
    });
  }

  async function showAuditLogs() {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<div class="cloud-empty">Chargement du journal…</div>`;
    dialog("Journal des actions sensibles", wrap);
    try {
      const data = await api("/api/admin/audit");
      const logs = data.logs || [];
      wrap.innerHTML = logs.length ? `<div class="audit-list">${logs.map(log => `<article><div><strong>${escapeHtml(log.action)}</strong><small>${escapeHtml(formatDate(log.createdAt))} · IP ${escapeHtml(log.ipAddress || "—")}</small></div><div><span>Acteur</span><b>${escapeHtml(log.actor?.name || log.actor?.email || "Système")}</b></div><div><span>Cible</span><b>${escapeHtml(log.target?.name || log.target?.email || "—")}</b></div><pre>${escapeHtml(JSON.stringify(log.details || {}))}</pre></article>`).join("")}</div>` : `<div class="cloud-empty">Aucune action sensible enregistrée.</div>`;
    } catch (error) {
      wrap.innerHTML = `<div class="cloud-empty">${escapeHtml(error.message)}</div>`;
    }
  }

  async function showSystemStatus() {
    const box = document.createElement("div");
    box.innerHTML = `<div class="cloud-empty">Vérification des services…</div>`;
    dialog("État du système", box);
    try {
      const data = await api("/api/status");
      box.innerHTML = `<div class="cloud-history-list"><article class="cloud-history-card"><div><strong>Cloudflare Pages Advanced Mode</strong><small>Routeur serveur public/_worker.js</small></div><div class="cloud-metric"><span>État</span><b>OPÉRATIONNEL</b></div></article><article class="cloud-history-card"><div><strong>Workers KV</strong><small>Sessions, index et limitation des connexions</small></div><div class="cloud-metric"><span>Binding</span><b>${escapeHtml(data.services?.kv || "OK")}</b></div></article><article class="cloud-history-card"><div><strong>Cloudflare D1</strong><small>Entreprises, utilisateurs, données et audit</small></div><div class="cloud-metric"><span>Binding</span><b>${escapeHtml(data.services?.d1 || "OK")}</b></div></article></div>`;
    } catch (error) {
      box.innerHTML = `<div class="cloud-empty">${escapeHtml(error.message)}</div>`;
    }
  }

  async function changePassword() {
    const currentPassword = prompt("Mot de passe actuel :", "");
    if (currentPassword === null) return;
    const newPassword = prompt("Nouveau mot de passe (12 caractères minimum) :", "");
    if (newPassword === null) return;
    const confirmation = prompt("Confirmez le nouveau mot de passe :", "");
    if (confirmation !== newPassword) return toast("Les mots de passe ne correspondent pas.", "error");
    try {
      await api("/api/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword })
      });
      alert("Mot de passe modifié. Toutes vos sessions ont été invalidées. Reconnectez-vous.");
      location.replace("/login");
    } catch (error) { toast(error.message, "error"); }
  }

  async function logout() {
    try {
      await api("/api/logout", { method: "POST", body: "{}" });
    } finally {
      location.replace("/login");
    }
  }

  function support() {
    window.open("https://wa.me/2250777041790?text=" + encodeURIComponent("Bonjour, j’ai besoin d’aide sur GOBAL TRADING — Forex Capture Analyzer Edition."), "_blank", "noopener,noreferrer");
  }

  function action(name) {
    const map = {
      home: () => window.scrollTo({ top: 0, behavior: "smooth" }),
      upload: () => $("btnPick")?.click(),
      analyze: () => $("btnAnalyze")?.click(),
      live: () => window.openModal?.("LIVE + Réglage bougies", "tpl_live"),
      results: () => window.openModal?.("Résultats", "tpl_results"),
      history: showHistory,
      guide: () => window.openModal?.("Guide d’utilisation", "tpl_guide"),
      admin: () => showAdmin({ inline: true }),
      audit: showAuditLogs,
      save: () => saveAnalysis(window.__FOREX_LAST_RESULT, { sourceType: "capture" }),
      status: showSystemStatus,
      password: changePassword,
      support,
      logout
    };
    if (name === "save" && !window.__FOREX_LAST_RESULT) {
      toast("Effectuez d’abord une analyse.", "error");
      return;
    }
    map[name]?.();
    if (["home", "upload", "analyze", "live", "results", "history", "guide"].includes(name)) {
      setTimeout(showPlanPopup, 250);
    }
    $("cloudUserMenu")?.classList.remove("show");
    $("cloudMenu")?.classList.remove("show");
    $("cloudShell")?.classList.remove("menu-open");
    $("cloudMenuToggle")?.setAttribute("aria-expanded", "false");
  }

  document.querySelectorAll("[data-cloud-action]").forEach(button => button.addEventListener("click", event => { event.preventDefault(); action(button.dataset.cloudAction); }));
  ["btnPick", "btnAnalyze", "btnFit", "btnReset", "btnOpenResults"].forEach(id => {
    $(id)?.addEventListener("click", () => setTimeout(showPlanPopup, 250));
  });
  $("cloudUserButton")?.addEventListener("click", event => {
    event.stopPropagation();
    const menu = $("cloudUserMenu");
    menu.classList.toggle("show");
    $("cloudUserButton").setAttribute("aria-expanded", menu.classList.contains("show"));
  });
  $("cloudMenuToggle")?.addEventListener("click", () => {
    const menu = $("cloudMenu");
    menu.classList.toggle("show");
    $("cloudShell").classList.toggle("menu-open", menu.classList.contains("show"));
    $("cloudMenuToggle").setAttribute("aria-expanded", menu.classList.contains("show"));
  });
  document.addEventListener("click", () => $("cloudUserMenu")?.classList.remove("show"));
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeDialog(); });

  loadUser().catch(error => {
    setSync("Hors connexion", "error");
    toast(error.message, "error");
  });
})();
