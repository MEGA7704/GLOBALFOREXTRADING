(() => {
  const $ = (id) => document.getElementById(id);
  const alertBox = $("authAlert");
  const loginForm = $("loginForm");
  let csrfToken = "";

  function showAlert(message, type = "error") {
    alertBox.textContent = message;
    alertBox.className = `alert${type === "success" ? " success" : ""}`;
    alertBox.hidden = false;
  }

  function clearAlert() {
    alertBox.hidden = true;
    alertBox.textContent = "";
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
      credentials: "same-origin"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "Une erreur est survenue.");
      error.status = response.status;
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

  async function loadStatus() {
    try {
      await refreshCsrf();
      const status = await api("/api/status", { method: "GET" });
      if (status.authenticated) {
        location.replace(safeNext());
        return;
      }
      $("systemState").textContent = status.ok ? "Système opérationnel" : "Configuration Cloudflare requise";
    } catch (error) {
      showAlert("Impossible de joindre le serveur Cloudflare. Vérifiez les bindings, secrets et migrations D1.");
      $("systemState").textContent = "Système indisponible";
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert();
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
      showAlert("Connexion réussie. Ouverture de votre espace…", "success");
      location.replace(safeNext());
    } catch (error) {
      if (error.status === 403) {
        try { await refreshCsrf(); } catch { /* A new attempt will display the server error. */ }
      }
      showAlert(error.message);
      button.disabled = false;
    }
  });

  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = $(button.dataset.togglePassword);
      input.type = input.type === "password" ? "text" : "password";
    });
  });

  $("currentYear").textContent = new Date().getFullYear();
  loadStatus();
})();
