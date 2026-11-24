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
    } catch (err) {
      body.appendChild(hint(err.message));
    } finally {
      send.disabled = false;
    }
  });

  // Pastille rouge s'il y a une réponse non lue (vérifié une fois par visite)
  (async function unread() {
    try {
      if (!user() || sessionStorage.getItem("gg_chat_checked")) return;
      sessionStorage.setItem("gg_chat_checked", "1");
      const items = await Account.api("/api/support", { action: "mine" });
      const seen = store.get(SEEN);
      dot.hidden = !items.some(i => i.kind === "question" && i.reply && i.repliedAt > seen);
    } catch (e) {}
  })();
})();
