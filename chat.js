// MESSAGERIE FLOTTANTE : les joueurs posent une question à l'équipe, la réponse s'affiche ici
(function () {
  const SEEN = "gg_chat_seen";
  const user = () => (window.Auth && Auth.getUser()) || null;
  const store = {
    get: k => { try { return Number(localStorage.getItem(k)) || 0; } catch (e) { return 0; } },
    set: (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} }
  };

  const fab = document.createElement("button");
  fab.className = "chat-fab";
  fab.type = "button";
  fab.setAttribute("aria-label", "Poser une question");
  fab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg><span class="chat-dot" hidden></span>';

  const box = document.createElement("div");
  box.className = "chat-box";
  box.hidden = true;
  box.innerHTML =
    '<div class="chat-head"><span>💬 Poser une question</span><button type="button" aria-label="Fermer">✕</button></div>' +
    '<div class="chat-body"></div>' +
    '<form class="chat-form"><textarea maxlength="1000" placeholder="Ta question…" required></textarea><button type="submit">Envoyer</button></form>';
  document.body.append(box, fab);

  const body = box.querySelector(".chat-body");
  const form = box.querySelector(".chat-form");
  const area = form.querySelector("textarea");
  const send = form.querySelector("button");
  const dot = fab.querySelector(".chat-dot");

  function bubble(text, cls) {
    const d = document.createElement("div");
    d.className = "chat-bubble " + cls;
    d.textContent = text;
    return d;
  }

  function hint(text, label, onClick) {
    const d = document.createElement("div");
    d.className = "chat-hint";
    d.textContent = text;
    if (label) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "login-btn";
      b.textContent = label;
      b.style.marginTop = "10px";
      b.addEventListener("click", onClick);
      d.appendChild(document.createElement("br"));
      d.appendChild(b);
    }
    return d;
  }

  async function show() {
    body.innerHTML = "";
    if (!user()) {
      form.hidden = true;
      body.appendChild(hint("Connecte-toi avec Google pour poser une question à l'équipe.", "Connexion", () => { box.hidden = true; Auth.openLogin(); }));
      return;
    }
    form.hidden = false;
    body.appendChild(hint("Pose ta question ici : l'équipe te répond directement dans cette fenêtre."));
    try {
      const items = (await Account.api("/api/support", { action: "mine" })).filter(i => i.kind === "question").reverse();
      let latest = 0;
      items.forEach(i => {
        body.appendChild(bubble(i.text, "me"));
        if (i.reply) {
          body.appendChild(bubble(i.reply, "admin"));
          latest = Math.max(latest, i.repliedAt || 0);
        }
      });
      store.set(SEEN, Math.max(latest, store.get(SEEN)));
      dot.hidden = true;
      body.scrollTop = body.scrollHeight;
    } catch (e) {
      body.appendChild(hint(e.message));
    }
  }

  fab.addEventListener("click", () => {
    if (isAdmin()) { // l'admin répond aux messages depuis l'espace admin
      window.location.href = "admin.html#qList";
      return;
    }
    box.hidden = !box.hidden;
    if (!box.hidden) show();
  });
  box.querySelector(".chat-head button").addEventListener("click", () => { box.hidden = true; });
  window.addEventListener("auth-changed", () => { if (!box.hidden) show(); });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const text = area.value.trim();
    if (!text) return;
    send.disabled = true;
    try {
      await Account.api("/api/support", { action: "send", kind: "question", text, page: location.pathname.split("/").pop() || "index.html" });
      area.value = "";
      await show();
      checkReplies();
    } catch (err) {
      body.appendChild(hint(err.message));
    } finally {
      send.disabled = false;
    }
  });

  // ---------- Pastille rouge ----------
  // Joueur : l'équipe a répondu à sa question. Admin : un joueur a écrit et attend une réponse.
  const NOTIFIED = "gg_chat_notified_at";
  const ADMIN = "glorylvz985@gmail.com";
  let timer = null;
  let busy = false;
  const isAdmin = () => !!user() && String(user().email || "").toLowerCase() === ADMIN;

  function announce(text, href) {
    const old = document.querySelector(".toast-chat");
    if (old) old.remove();
    const toast = document.createElement("div");
    toast.className = "toast-chat";
    const span = document.createElement("span");
    span.textContent = "💬 " + text;
    const a = document.createElement("a");
    a.href = href || "#";
    a.textContent = href ? "Ouvrir" : "Voir";
    if (!href) {
      a.addEventListener("click", e => {
        e.preventDefault();
        toast.remove();
        box.hidden = false;
        show();
      });
    }
    toast.append(span, a);
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 8000);
    if (window.GGNotify) window.GGNotify(text);
  }

  // Revérifie toutes les 40 s (onglet visible) seulement tant que c'est utile
  function watch(active, fn) {
    clearInterval(timer);
    timer = active ? setInterval(() => { if (!document.hidden) fn(); }, 40000) : null;
  }

  async function checkReplies() {
    try {
      const items = (await Account.api("/api/support", { action: "mine" })).filter(i => i.kind === "question");
      const fresh = items.filter(i => i.reply && i.repliedAt > store.get(SEEN));
      dot.hidden = fresh.length === 0;

      const latest = fresh.reduce((m, i) => Math.max(m, i.repliedAt), 0);
      if (latest > store.get(NOTIFIED)) {
        store.set(NOTIFIED, latest);
        if (box.hidden) announce("L'équipe a répondu à ta question");
      }
      watch(items.some(i => !i.reply), checkReplies); // tant qu'une question attend sa réponse
    } catch (e) {}
  }

  async function checkInbox() {
    try {
      const waiting = (await Account.api("/api/support", { action: "list" })).filter(i => !i.reply);
      dot.hidden = waiting.length === 0;

      const latest = waiting.reduce((m, i) => Math.max(m, i.createdAt), 0);
      if (latest > store.get(NOTIFIED)) {
        store.set(NOTIFIED, latest);
        announce(waiting.length > 1 ? waiting.length + " messages de joueurs attendent une réponse" : "Un joueur t'a écrit", "admin.html#qList");
      }
      watch(true, checkInbox);
    } catch (e) {}
  }

  async function start() {
    if (busy) return;
    busy = true;
    try {
      if (!user()) { dot.hidden = true; watch(false); return; }
      if (isAdmin()) await checkInbox();
      else await checkReplies();
    } finally {
      busy = false;
    }
  }

  window.addEventListener("load", () => setTimeout(start, 500));
  window.addEventListener("auth-changed", () => setTimeout(start, 300));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) start(); });

  // ---------- Correctif d'affichage des logos : le logo entier reste visible, centré dans son cadre ----------
  const fix = document.createElement("style");
  fix.textContent =
    ".game-image.logo-mode{position:relative;display:block;overflow:hidden}" +
    ".game-image.logo-mode img{position:absolute;inset:0;margin:auto;width:auto;height:90%;max-width:90%;aspect-ratio:auto}" +
    ".detail-cover.logo-mode{position:relative;display:block;overflow:hidden}" +
    ".detail-cover.logo-mode img{position:absolute;inset:0;margin:auto;width:auto;height:88%;max-width:88%;aspect-ratio:auto}";
  document.head.appendChild(fix);
})();
