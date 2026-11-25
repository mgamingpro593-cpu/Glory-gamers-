// COMPTE : abonnement du visiteur connecté (sert à retirer les pubs pour les premium)
(function () {
  const KEY = "gg_acct";
  const NAMES = { free: "Free Gamers", pro: "Gamer Pro", elite: "Élite Gamers" };
  const BADGES = { free: "", pro: "💎", elite: "👑" };
  let cache = null;

  const me = () => (window.Auth && Auth.getUser()) || null;

  function saved() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY));
      const u = me();
      return a && u && a.email === String(u.email || "").toLowerCase() ? a : null;
    } catch (e) {
      return null;
    }
  }

  function identity() {
    const u = me();
    const a = saved();
    return { idToken: (u && u.token) || "", session: (a && a.session) || "" };
  }

  async function load() {
    const u = me();
    if (!u) return { email: "", plan: "free", premium: false };
    const old = saved();
    try {
      const r = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(identity())
      });
      if (r.ok) {
        const d = await r.json();
        const a = { email: d.email, plan: d.plan, premium: !!d.premium, until: d.until || 0, session: d.session || "", checked: Date.now() };
        try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {}
        return a;
      }
    } catch (e) {}
    // Serveur injoignable : on garde le dernier état connu pendant 24 h
    if (old && Date.now() - old.checked < 86400000) return old;
    return { email: String(u.email || "").toLowerCase(), plan: "free", premium: false };
  }

  function status(force) {
    if (!cache || force) cache = load();
    return cache;
  }

  async function api(url, payload) {
    await status();
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({}, identity(), payload))
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Erreur du serveur (" + r.status + ").");
    return d;
  }

  window.Account = { names: NAMES, badges: BADGES, status, api };
  window.addEventListener("auth-changed", () => { cache = null; });
})();

// Enregistre le service worker (installation de l'application + notifications)
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
