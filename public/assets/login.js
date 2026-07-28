(() => {
  const $ = (id) => document.getElementById(id);
  const loginAlert = $("authAlert");
  const registerAlert = $("registerAlert");
  const loginForm = $("loginForm");
  const registerForm = $("registerForm");
  const registerDialog = $("registerDialog");
  const forgotPasswordDialog = $("forgotPasswordDialog");
  const forgotPasswordForm = $("forgotPasswordForm");
  const forgotPasswordAlert = $("forgotPasswordAlert");
  let csrfToken = "";

  function showAlert(target, message, type = "error") {
    target.textContent = message;
    target.className = `alert${type === "success" ? " success" : ""}${target !== loginAlert ? " dialog-alert" : ""}`;
    target.hidden = false;
  }

  function clearAlert(target) {
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
    const response = await fetch(path, {
      ...options,
      headers,
      credentials: "same-origin",
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "Une erreur est survenue.");
      error.status = response.status;
      error.code = data.code || "";
      throw error;
    }
    return data;
  }

  function safeNext() {
    const next = new URLSearchParams(location.search).get("next") || "/";
    return next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }

  async function refreshCsrf() {
    const data = await api("/api/csrf", { method: "GET" });
    csrfToken = data.csrfToken || "";
    if (!csrfToken) throw new Error("Impossible d’obtenir le jeton de sécurité.");
  }

  function clearRegistrationFields() {
    registerForm.reset();
    for (const id of ["registerName", "registerCompany", "registerEmail", "registerPassword", "registerPasswordConfirm"]) {
      const field = $(id);
      if (field) field.value = "";
    }
  }

  function openRegisterDialog() {
    clearAlert(registerAlert);
    // Empêche le navigateur de recopier l’adresse de connexion (notamment celle du Super Admin)
    // dans le formulaire d’inscription membre.
    clearRegistrationFields();
    if (typeof registerDialog.showModal === "function") registerDialog.showModal();
    else registerDialog.setAttribute("open", "");
    requestAnimationFrame(() => {
      clearRegistrationFields();
      $("registerName")?.focus();
    });
    window.setTimeout(() => {
      const email = $("registerEmail");
      if (email && email.value === $("loginEmail")?.value) email.value = "";
    }, 180);
  }

  function closeRegisterDialog() {
    clearAlert(registerAlert);
    if (typeof registerDialog.close === "function") registerDialog.close();
    else registerDialog.removeAttribute("open");
  }

  function clearForgotPasswordFields() {
    forgotPasswordForm.reset();
    const loginEmail = $("loginEmail")?.value.trim() || "";
    $("forgotPasswordEmail").value = loginEmail;
  }

  function openForgotPasswordDialog() {
    clearAlert(forgotPasswordAlert);
    clearForgotPasswordFields();
    if (typeof forgotPasswordDialog.showModal === "function") forgotPasswordDialog.showModal();
    else forgotPasswordDialog.setAttribute("open", "");
    requestAnimationFrame(() => {
      const email = $("forgotPasswordEmail");
      (email?.value ? $("forgotPasswordName") : email)?.focus();
    });
  }

  function closeForgotPasswordDialog() {
    clearAlert(forgotPasswordAlert);
    if (typeof forgotPasswordDialog.close === "function") forgotPasswordDialog.close();
    else forgotPasswordDialog.removeAttribute("open");
  }

  async function loadStatus() {
    try {
      await refreshCsrf();
      const status = await api("/api/status", { method: "GET" });
      if (status.authenticated) {
        location.replace(safeNext());
        return;
      }
      $("systemState").textContent = status.ok ? "Système opérationnel" : "Configuration Cloudflare requise";
    } catch {
      showAlert(loginAlert, "Impossible de joindre le serveur Cloudflare. Vérifiez les bindings, les secrets et la base D1.");
      $("systemState").textContent = "Système indisponible";
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert(loginAlert);
    const button = $("loginButton");
    button.disabled = true;
    try {
      if (!csrfToken) await refreshCsrf();
      await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          email: $("loginEmail").value.trim(),
          password: $("loginPassword").value
        })
      });
      showAlert(loginAlert, "Connexion réussie. Ouverture de votre espace…", "success");
      location.replace(safeNext());
    } catch (error) {
      if (error.status === 403) {
        try { await refreshCsrf(); } catch { /* Nouvelle tentative manuelle. */ }
      }
      showAlert(loginAlert, error.message);
      button.disabled = false;
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert(registerAlert);
    const button = $("registerButton");
    const password = $("registerPassword").value;
    const passwordConfirm = $("registerPasswordConfirm").value;
    if (password !== passwordConfirm) {
      showAlert(registerAlert, "Les deux mots de passe ne correspondent pas.");
      return;
    }
    button.disabled = true;
    try {
      if (!csrfToken) await refreshCsrf();
      await api("/api/register", {
        method: "POST",
        body: JSON.stringify({
          name: $("registerName").value.trim(),
          companyName: $("registerCompany").value.trim(),
          email: $("registerEmail").value.trim(),
          password,
          passwordConfirm
        })
      });
      showAlert(registerAlert, "Compte créé. Votre plan Free de 21 jours est activé…", "success");
      window.setTimeout(() => location.replace(safeNext()), 450);
    } catch (error) {
      if (error.status === 403) {
        try { await refreshCsrf(); } catch { /* Nouvelle tentative manuelle. */ }
      }
      showAlert(registerAlert, error.message);
      if (error.code === "SUPER_ADMIN_EMAIL_RESERVED") {
        const emailField = $("registerEmail");
        emailField?.focus();
        emailField?.select();
      }
      button.disabled = false;
    }
  });


  forgotPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert(forgotPasswordAlert);
    const button = $("forgotPasswordSubmitButton");
    button.disabled = true;
    try {
      if (!csrfToken) await refreshCsrf();
      await api("/api/password-reset-request", {
        method: "POST",
        body: JSON.stringify({
          name: $("forgotPasswordName").value.trim(),
          email: $("forgotPasswordEmail").value.trim(),
          message: $("forgotPasswordMessage").value.trim()
        })
      });
      showAlert(
        forgotPasswordAlert,
        "Votre demande a été transmise. Le Super Admin pourra vous assister après vérification de votre compte.",
        "success"
      );
      forgotPasswordForm.reset();
      window.setTimeout(closeForgotPasswordDialog, 1600);
    } catch (error) {
      if (error.status === 403) {
        try { await refreshCsrf(); } catch { /* Nouvelle tentative manuelle. */ }
      }
      showAlert(forgotPasswordAlert, error.message);
    } finally {
      button.disabled = false;
    }
  });

  $("showRegisterButton").addEventListener("click", openRegisterDialog);
  $("closeRegisterDialog").addEventListener("click", closeRegisterDialog);
  $("cancelRegisterButton").addEventListener("click", closeRegisterDialog);
  $("showForgotPasswordButton").addEventListener("click", openForgotPasswordDialog);
  $("closeForgotPasswordDialog").addEventListener("click", closeForgotPasswordDialog);
  $("cancelForgotPasswordButton").addEventListener("click", closeForgotPasswordDialog);
  registerDialog.addEventListener("click", (event) => {
    if (event.target === registerDialog) closeRegisterDialog();
  });
  registerDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeRegisterDialog();
  });
  forgotPasswordDialog.addEventListener("click", (event) => {
    if (event.target === forgotPasswordDialog) closeForgotPasswordDialog();
  });
  forgotPasswordDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeForgotPasswordDialog();
  });

  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = $(button.dataset.togglePassword);
      input.type = input.type === "password" ? "text" : "password";
      button.setAttribute("aria-label", input.type === "password" ? "Afficher le mot de passe" : "Masquer le mot de passe");
    });
  });

  $("currentYear").textContent = new Date().getFullYear();
  loadStatus();
})();
