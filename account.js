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
        const a = { email: d.email, plan: d.plan, premium: !!d.premium, until: d.until || 0, badgeColor: d.badgeColor || "blue", session: d.session || "", checked: Date.now() };
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

  const PALETTE = { blue: "#1877f2", green: "#1fa463", black: "#111111" };

  // Insigne Gamer Pro (gemme) ou badge certifié Élite (sceau + coche, couleur au choix)
  function badge(plan, color) {
    if (plan !== "pro" && plan !== "elite") return null;
    const s = document.createElement("span");
    s.dataset.key = plan + ":" + (plan === "elite" ? color || "blue" : "");
    if (plan === "elite") {
      const c = PALETTE[color] || PALETTE.blue;
      const seal = '<rect x="4.5" y="4.5" width="15" height="15" rx="2.5" fill="' + c + '"';
      s.className = "vbadge" + (color === "black" ? " black" : "");
      s.title = "Élite Gamers : compte certifié";
      s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + seal + '/>' + seal + ' transform="rotate(45 12 12)"/>' +
        '<path d="M7.6 12.4l3 3 5.9-6.2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else {
      s.className = "vbadge";
      s.title = "Gamer Pro";
      s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9z" fill="#8b5cf6"/>' +
        '<path d="M2 9h20M9 3l3 6 3-6M12 9v12" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1"/></svg>';
    }
    return s;
  }

  async function setColor(color) {
    await api("/api/me", { badgeColor: color });
    const a = await status(true);
    window.dispatchEvent(new Event("account-changed"));
    return a;
  }

  window.Account = { names: NAMES, badges: BADGES, status, api, badge, setColor };
  window.addEventListener("auth-changed", () => { cache = null; });
})();

// Enregistre le service worker (installation de l'application + notifications)
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
