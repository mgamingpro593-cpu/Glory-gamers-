// NOTIFICATIONS : cloche dans l'en-tête + notifications du navigateur (quand le site est ouvert)
(function () {
  const area = document.getElementById("authArea");
  if (!area) return;

  const tr = (fr, en) => (window.Prefs && Prefs.getLang() === "en" ? en : fr);
  const SEEN_KEY = "gg_notif_seen";   // dernière notification vue (ouverture de la cloche)
  const SHOWN_KEY = "gg_notif_shown"; // dernière notification déjà affichée par le navigateur
  const POLL_MS = 60000;

  let items = [];

  const num = key => { try { return Number(localStorage.getItem(key)) || 0; } catch (e) { return 0; } };
  const save = (key, v) => { try { localStorage.setItem(key, String(v)); } catch (e) {} };

  // ----- Cloche -----
  const wrap = document.createElement("div");
  wrap.className = "bell-wrap";

  const btn = document.createElement("button");
  btn.className = "icon-btn bell-btn";
  btn.setAttribute("aria-label", tr("Notifications", "Notifications"));
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>';

  const dot = document.createElement("span");
  dot.className = "bell-dot";
  dot.hidden = true;
  btn.appendChild(dot);

  const panel = document.createElement("div");
  panel.className = "notif-panel";
  panel.hidden = true;

  wrap.append(btn, panel);
  area.before(wrap);

  // Première visite : on ne signale pas tout l'historique comme « nouveau »
  if (!num(SEEN_KEY)) save(SEEN_KEY, Date.now());

  function ago(ts) {
    const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (m < 1) return tr("à l'instant", "just now");
    if (m < 60) return tr("il y a " + m + " min", m + " min ago");
    const h = Math.round(m / 60);
    if (h < 24) return tr("il y a " + h + " h", h + " h ago");
    const d = Math.round(h / 24);
    return tr("il y a " + d + " j", d + " d ago");
  }

  function unreadCount() {
    const seen = num(SEEN_KEY);
    return items.filter(n => n.createdAt > seen).length;
  }

  function updateDot() {
    const n = unreadCount();
    dot.hidden = n === 0;
    dot.textContent = n > 9 ? "9+" : String(n);
  }

  function permissionLabel() {
    if (!("Notification" in window)) return "";
    if (Notification.permission === "granted") return tr("Notifications du navigateur activées ✓", "Browser notifications on ✓");
    if (Notification.permission === "denied") return tr("Notifications bloquées dans le navigateur", "Notifications blocked in the browser");
    return tr("Activer les notifications du navigateur", "Turn on browser notifications");
  }

  function renderPanel() {
    panel.innerHTML = "";
    const seen = num(SEEN_KEY);

    const head = document.createElement("div");
    head.className = "notif-head";
    const title = document.createElement("span");
    title.textContent = tr("Notifications", "Notifications");
    head.appendChild(title);
    panel.appendChild(head);

    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "notif-empty";
      empty.textContent = tr("Aucune notification pour le moment.", "No notifications yet.");
      panel.appendChild(empty);
    }

    items.forEach(n => {
      const a = document.createElement("a");
      a.className = "notif-item" + (n.createdAt > seen ? " unread" : "");
      a.href = n.url || "index.html";
      const t = document.createElement("strong");
      t.textContent = n.title;
      a.appendChild(t);
      if (n.body) {
        const b = document.createElement("span");
        b.textContent = n.body;
        a.appendChild(b);
      }
      const when = document.createElement("small");
      when.textContent = ago(n.createdAt);
      a.appendChild(when);
      panel.appendChild(a);
    });

    const label = permissionLabel();
    if (label) {
      const foot = document.createElement("div");
      foot.className = "notif-foot";
      const b = document.createElement("button");
      b.textContent = label;
      b.disabled = Notification.permission !== "default";
      b.addEventListener("click", askPermission);
      foot.appendChild(b);
      panel.appendChild(foot);
    }
  }

  btn.addEventListener("click", e => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      renderPanel();
      // les notifications affichées sont considérées comme vues à la fermeture
    } else {
      markSeen();
    }
  });

  document.addEventListener("click", e => {
    if (!panel.hidden && !wrap.contains(e.target)) {
      panel.hidden = true;
      markSeen();
    }
  });

  function markSeen() {
    if (items.length) save(SEEN_KEY, Math.max(num(SEEN_KEY), items[0].createdAt));
    updateDot();
  }

  // ----- Notifications du navigateur -----
  async function askPermission() {
    if (!("Notification" in window)) return;
    try { await Notification.requestPermission(); } catch (e) {}
    renderPanel();
  }

  async function showSystem(n) {
    const options = { body: n.body || "", data: { url: n.url || "index.html" } };
    try {
      if ("serviceWorker" in navigator) {
        const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("sw.js"));
        await navigator.serviceWorker.ready;
        return reg.showNotification(n.title, options);
      }
    } catch (e) {}
    try {
      const note = new Notification(n.title, options);
      note.onclick = () => { window.focus(); window.location.href = options.data.url; };
    } catch (e) {}
  }

  function announceNew() {
    const shown = num(SHOWN_KEY);
    if (!shown) { // premier chargement : on ne rejoue pas l'historique
      save(SHOWN_KEY, items.length ? items[0].createdAt : Date.now());
      return;
    }
    const fresh = items.filter(n => n.createdAt > shown).reverse();
    if (!fresh.length) return;

    save(SHOWN_KEY, items[0].createdAt);
    if ("Notification" in window && Notification.permission === "granted") {
      fresh.slice(-3).forEach(showSystem);
    }
  }

  // ----- Récupération -----
  async function poll() {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const list = await response.json();
      if (!Array.isArray(list)) return;
      items = list.sort((a, b) => b.createdAt - a.createdAt);
      announceNew();
      updateDot();
      if (!panel.hidden) renderPanel();
    } catch (e) {
      // pas de serveur : la cloche reste vide
    }
  }

  poll();
  setInterval(() => { if (!document.hidden) poll(); }, POLL_MS);
})();
