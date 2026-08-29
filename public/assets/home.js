(() => {
  const $ = (id) => document.getElementById(id);
  const year = $("homeYear");
  if (year) year.textContent = new Date().getFullYear();

  let accountAuthenticated = false;
  let csrfToken = "";

  const dialogs = {
    login: $("loginDialog"),
    register: $("registerDialog"),
    forgot: $("forgotPasswordDialog")
  };

  const alerts = {
    login: $("authAlert"),
    register: $("registerAlert"),
    forgot: $("forgotPasswordAlert")
  };

  function safeNext() {
    const next = new URLSearchParams(location.search).get("next") || "/app";
    return next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  }

  function showAlert(target, message, type = "error") {
    if (!target) return;
    target.textContent = message;
    target.className = `auth-alert${type === "success" ? " success" : ""}`;
    target.hidden = false;
  }

  function clearAlert(target) {
    if (!target) return;
    target.hidden = true;
    target.textContent = "";
  }

  async function api(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      "X-Requested-With": "ForexCloud",
      ...(options.headers || {})
    };
    if (options.method && options.method !== "GET") headers["X-CSRF-Token"] = csrfToken;
    const response = await fetch(path, { ...options, headers, credentials: "same-origin", cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "Une erreur est survenue.");
      error.status = response.status;
      error.code = data.code || "";
      throw error;
    }
    return data;
  }

  async function refreshCsrf() {
    const data = await api("/api/csrf", { method: "GET" });
    csrfToken = data.csrfToken || "";
    if (!csrfToken) throw new Error("Impossible d’obtenir le jeton de sécurité.");
  }

  function closeDialog(name) {
    const dialog = dialogs[name];
    if (!dialog) return;
    clearAlert(alerts[name]);
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    if (!Object.values(dialogs).some(item => item?.open)) document.body.classList.remove("auth-open");
  }

  function closeAllAuthDialogs() {
    Object.keys(dialogs).forEach(closeDialog);
  }

  async function openDialog(name) {
    if (accountAuthenticated) {
      location.href = "/app";
      return;
    }
    closeAllAuthDialogs();
    const dialog = dialogs[name];
    if (!dialog) return;
    clearAlert(alerts[name]);
    if (name === "register") {
      $("registerForm")?.reset();
      ["registerName","registerContact","registerEmail","registerPassword","registerPasswordConfirm"].forEach(id => { const field=$(id); if(field) field.value=""; });
    }
    if (name === "forgot") {
      $("forgotPasswordForm")?.reset();
      const email = $("loginEmail")?.value.trim();
      if (email && $("forgotPasswordEmail")) $("forgotPasswordEmail").value = email;
    }
    try { if (!csrfToken) await refreshCsrf(); } catch (error) { showAlert(alerts[name], error.message); }
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    document.body.classList.add("auth-open");
    requestAnimationFrame(() => {
      const focusId = name === "login" ? "loginEmail" : name === "register" ? "registerName" : "forgotPasswordEmail";
      $(focusId)?.focus();
    });
  }

  async function syncAccountState() {
    try {
      const response = await fetch("/api/status", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      accountAuthenticated = !!data.authenticated;
      if (!accountAuthenticated) return data;
      document.querySelectorAll("[data-auth]").forEach((item) => { item.href = "/app"; });
      const login = $("loginLink");
      const register = $("registerLink");
      const start = $("startAnalysis");
      if (login) login.textContent = "Mon espace";
      if (register) register.innerHTML = '<span class="user-icon">♙</span>Ouvrir l’application';
      if (start) start.innerHTML = "↗ &nbsp; Ouvrir l’application";
      return data;
    } catch {
      return { authenticated: false };
    }
  }

  document.querySelectorAll("[data-auth]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (accountAuthenticated) return;
      event.preventDefault();
      openDialog(link.dataset.auth === "register" ? "register" : "login");
    });
  });
  document.querySelectorAll("[data-auth-close]").forEach((button) => button.addEventListener("click", () => closeDialog(button.dataset.authClose)));
  Object.entries(dialogs).forEach(([name, dialog]) => {
    if (!dialog) return;
    dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(name); });
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(name); });
  });

  $("showRegisterFromLogin")?.addEventListener("click", () => openDialog("register"));
  $("showForgotPasswordButton")?.addEventListener("click", () => openDialog("forgot"));

  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = $(button.dataset.togglePassword);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
      button.setAttribute("aria-label", input.type === "password" ? "Afficher le mot de passe" : "Masquer le mot de passe");
    });
  });

  $("loginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert(alerts.login);
    const button = $("loginButton");
    if (button) button.disabled = true;
    try {
      if (!csrfToken) await refreshCsrf();
      await api("/api/login", { method: "POST", body: JSON.stringify({ email: $("loginEmail").value.trim(), password: $("loginPassword").value }) });
      showAlert(alerts.login, "Connexion réussie. Ouverture de votre espace…", "success");
      window.setTimeout(() => location.replace(safeNext()), 260);
    } catch (error) {
      if (error.status === 403) { try { await refreshCsrf(); } catch {} }
      showAlert(alerts.login, error.message);
      if (button) button.disabled = false;
    }
  });

  $("registerForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert(alerts.register);
    const button = $("registerButton");
    const password = $("registerPassword").value;
    const passwordConfirm = $("registerPasswordConfirm").value;
    if (password !== passwordConfirm) { showAlert(alerts.register, "Les deux mots de passe ne correspondent pas."); return; }
    if (button) button.disabled = true;
    try {
      if (!csrfToken) await refreshCsrf();
      await api("/api/register", { method: "POST", body: JSON.stringify({ name: $("registerName").value.trim(), companyName: $("registerContact").value.trim(), email: $("registerEmail").value.trim(), password, passwordConfirm }) });
      showAlert(alerts.register, "Compte créé. Votre plan Free de 7 jours est activé…", "success");
      window.setTimeout(() => location.replace(safeNext()), 420);
    } catch (error) {
      if (error.status === 403) { try { await refreshCsrf(); } catch {} }
      showAlert(alerts.register, error.message);
      if (error.code === "SUPER_ADMIN_EMAIL_RESERVED") { $("registerEmail")?.focus(); $("registerEmail")?.select(); }
      if (button) button.disabled = false;
    }
  });

  $("forgotPasswordForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert(alerts.forgot);
    const button = $("forgotPasswordSubmitButton");
    if (button) button.disabled = true;
    try {
      if (!csrfToken) await refreshCsrf();
      await api("/api/password-reset-request", { method: "POST", body: JSON.stringify({ name: $("forgotPasswordName").value.trim(), email: $("forgotPasswordEmail").value.trim(), message: $("forgotPasswordMessage").value.trim() }) });
      showAlert(alerts.forgot, "Votre demande a été transmise au Super Admin.", "success");
      $("forgotPasswordForm")?.reset();
      window.setTimeout(() => closeDialog("forgot"), 1400);
    } catch (error) {
      if (error.status === 403) { try { await refreshCsrf(); } catch {} }
      showAlert(alerts.forgot, error.message);
    } finally { if (button) button.disabled = false; }
  });

  const legalModal = $("legalModal");
  const legalTitle = $("legalModalTitle");
  const legalContent = $("legalModalContent");
  const legalLabels = { cgu: "Conditions Générales d’Utilisation", privacy: "Politique de confidentialité" };
  function closeLegalModal() {
    if (!legalModal) return;
    legalModal.classList.remove("open"); legalModal.setAttribute("aria-hidden", "true"); document.body.classList.remove("legal-open");
    if (legalContent) legalContent.innerHTML = "";
  }
  function openLegalModal(kind) {
    if (!legalModal || !legalContent || !legalTitle) return;
    const template = $(`legal-${kind}`); if (!template) return;
    legalTitle.textContent = legalLabels[kind] || "Document juridique"; legalContent.innerHTML = ""; legalContent.appendChild(template.content.cloneNode(true));
    legalModal.classList.add("open"); legalModal.setAttribute("aria-hidden", "false"); document.body.classList.add("legal-open"); legalModal.querySelector(".legal-close")?.focus();
  }
  document.querySelectorAll("[data-legal-open]").forEach((button) => button.addEventListener("click", () => openLegalModal(button.dataset.legalOpen)));
  document.querySelectorAll("[data-legal-close]").forEach((button) => button.addEventListener("click", closeLegalModal));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && legalModal?.classList.contains("open")) closeLegalModal(); });

  (async () => {
    const status = await syncAccountState();
    const params = new URLSearchParams(location.search);
    if (!status?.authenticated) {
      const mode = params.get("auth");
      if (mode === "register") openDialog("register");
      else if (mode === "login") openDialog("login");
    }
  })();
})();
