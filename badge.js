// BADGES : insigne Gamer Pro / badge certifié Élite à côté du nom dans le menu du compte
(function () {
  async function apply() {
    if (!window.Account || !window.Auth || !Auth.getUser()) return;
    const a = await Account.status();
    document.querySelectorAll(".user-panel strong").forEach(n => {
      const b = Account.badge(a.plan, a.badgeColor);
      const cur = n.querySelector(".vbadge");
      if (!b) { if (cur) cur.remove(); return; }
      if (cur && cur.dataset.key === b.dataset.key) return;
      if (cur) cur.remove();
      n.appendChild(b);
    });
  }
  window.addEventListener("auth-changed", apply);
  window.addEventListener("account-changed", apply);
  window.addEventListener("load", apply);
  const area = document.getElementById("authArea");
  if (area) new MutationObserver(apply).observe(area, { childList: true, subtree: true });
})();
