(() => {
  const year = document.getElementById("homeYear");
  if (year) year.textContent = new Date().getFullYear();

  async function syncAccountState() {
    try {
      const response = await fetch("/api/status", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!data.authenticated) return;
      const login = document.getElementById("loginLink");
      const register = document.getElementById("registerLink");
      const start = document.getElementById("startAnalysis");
      if (login) { login.textContent = "Mon espace"; login.href = "/app"; }
      if (register) { register.textContent = "Ouvrir l’application"; register.href = "/app"; }
      if (start) start.href = "/app";
    } catch { /* La page d’accueil reste utilisable même si le statut cloud est indisponible. */ }
  }

  syncAccountState();
})();
