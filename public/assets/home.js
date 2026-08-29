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


  const legalModal = document.getElementById("legalModal");
  const legalTitle = document.getElementById("legalModalTitle");
  const legalContent = document.getElementById("legalModalContent");
  const legalLabels = { cgu: "Conditions Générales d’Utilisation", privacy: "Politique de confidentialité" };

  function closeLegalModal() {
    if (!legalModal) return;
    legalModal.classList.remove("open");
    legalModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("legal-open");
    if (legalContent) legalContent.innerHTML = "";
  }

  function openLegalModal(kind) {
    if (!legalModal || !legalContent || !legalTitle) return;
    const template = document.getElementById(`legal-${kind}`);
    if (!template) return;
    legalTitle.textContent = legalLabels[kind] || "Document juridique";
    legalContent.innerHTML = "";
    legalContent.appendChild(template.content.cloneNode(true));
    legalModal.classList.add("open");
    legalModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("legal-open");
    const close = legalModal.querySelector(".legal-close");
    if (close) close.focus();
  }

  document.querySelectorAll("[data-legal-open]").forEach((button) => {
    button.addEventListener("click", () => openLegalModal(button.dataset.legalOpen));
  });
  document.querySelectorAll("[data-legal-close]").forEach((button) => {
    button.addEventListener("click", closeLegalModal);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && legalModal?.classList.contains("open")) closeLegalModal();
  });

  syncAccountState();
})();
