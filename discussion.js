// DISCUSSION PUBLIQUE : tout le monde lit, les connectés écrivent (texte + photo), les badges sont visibles
(function () {
  const list = document.getElementById("dcList");
  const form = document.getElementById("dcForm");
  const input = document.getElementById("dcText");
  const photoBtn = document.getElementById("dcPhotoBtn");
  const photoInput = document.getElementById("dcPhotoInput");
  const preview = document.getElementById("dcPreview");
  const sendBtn = document.getElementById("dcSend");
  const note = document.getElementById("dcNote");
  const notifBtn = document.getElementById("dcNotif");
  const login = document.getElementById("dcLogin");
  const READ = "gg_chat_read", NOTIFIED = "gg_chat_notified";
  const ADMIN = "glorylvz985@gmail.com"; // confort d'affichage : la suppression est vérifiée côté serveur
  const IMG_RE = /^\/api\/image\?id=[a-f0-9]{32}$/;

  let lastN = 0, busy = false, started = false, stick = true, image = "", uploading = false;

  const user = () => (window.Auth && Auth.getUser()) || null;
  const isAdmin = () => { const u = user(); return !!u && String(u.email || "").toLowerCase() === ADMIN; };
  const save = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };

  function showNote(text) { note.textContent = text; note.hidden = !text; }

  function when(ms) {
    const d = new Date(ms);
    const hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return d.toDateString() === new Date().toDateString() ? hm : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " " + hm;
  }

  function addMessage(m) {
    const row = document.createElement("div");
    row.className = "dc-msg" + (m.mine ? " me" : "");
    const head = document.createElement("div");
    head.className = "dc-head";
    const name = document.createElement("strong");
    name.textContent = m.name || "Joueur";
    const badge = window.Account && Account.badge(m.plan, m.badgeColor);
    if (badge) name.appendChild(badge);
    const t = document.createElement("small");
    t.textContent = when(m.createdAt);
    head.append(name, t);

    if (isAdmin()) {
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "Supprimer";
      del.addEventListener("click", async () => {
        if (!confirm("Supprimer ce message ?")) return;
        try { await Account.api("/api/chat", { action: "delete", id: m.id }); row.remove(); } catch (e) { showNote(e.message); }
      });
      head.appendChild(del);
    }
    row.appendChild(head);

    if (m.text) {
      const p = document.createElement("div");
      p.className = "dc-text";
      p.textContent = m.text;
      row.appendChild(p);
    }
    if (IMG_RE.test(m.image || "")) {
      const a = document.createElement("a");
      a.href = m.image;
      a.target = "_blank";
      a.rel = "noopener";
      const img = document.createElement("img");
      img.src = m.image;
      img.alt = "Photo";
      img.loading = "lazy";
      a.appendChild(img);
      row.appendChild(a);
    }
    list.appendChild(row);
  }

  function emptyHint() {
    if (list.children.length) return;
    const p = document.createElement("p");
    p.className = "dc-empty";
    p.textContent = "Aucun message pour le moment. Écris le premier !";
    list.appendChild(p);
  }

  async function poll() {
    if (busy) return;
    busy = true;
    try {
      if (window.Account) await Account.status();
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", after: lastN, session: window.Account ? Account.identity().session : "" })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erreur du serveur.");

      const wasNear = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
      const fresh = [];
      if (d.messages.length) {
        const empty = list.querySelector(".dc-empty");
        if (empty) empty.remove();
      }
      d.messages.forEach(m => {
        if (m.n > lastN) {
          addMessage(m);
          if (!m.mine) fresh.push(m);
        }
      });
      lastN = Math.max(lastN, d.seq || 0);
      save(READ, lastN);
      save(NOTIFIED, lastN);

      if (!started) emptyHint();
      if (started && fresh.length && document.hidden && window.GGNotify) {
        const m = fresh[fresh.length - 1];
        GGNotify((m.name || "Joueur") + " : " + (m.text || "📷 Photo"));
      }
      if (!started || wasNear || stick) list.scrollTop = list.scrollHeight;
      started = true;
      stick = false;
      if (note.textContent && !uploading) showNote("");
    } catch (e) {
      /* on réessaie au prochain tour */
    }
    busy = false;
  }

  // ---------- Photo ----------
  function compress(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const scale = Math.min(1, 900 / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          let q = 0.82;
          let data = c.toDataURL("image/jpeg", q);
          while (data.length > 380000 && q > 0.4) { q -= 0.1; data = c.toDataURL("image/jpeg", q); }
          data.length > 400000 ? reject(new Error("Photo trop lourde.")) : resolve(data);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function clearPhoto() {
    image = "";
    preview.innerHTML = "";
    preview.hidden = true;
  }

  function showPreview(dataUrl) {
    preview.innerHTML = "";
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "";
    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "✕";
    x.setAttribute("aria-label", "Retirer la photo");
    x.addEventListener("click", clearPhoto);
    preview.append(img, x);
    preview.hidden = false;
  }

  photoBtn.addEventListener("click", () => { if (!user()) return Auth.openLogin(); photoInput.click(); });
  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    photoInput.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    uploading = true;
    sendBtn.disabled = true;
    showNote("Envoi de la photo…");
    try {
      const dataUrl = await compress(file);
      image = (await Account.api("/api/chatimg", { dataUrl })).url;
      showPreview(dataUrl);
      showNote("");
    } catch (e) {
      clearPhoto();
      showNote(e.message || "Impossible d'envoyer cette photo.");
    }
    uploading = false;
    sendBtn.disabled = false;
  });

  // ---------- Envoi ----------
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!user()) return Auth.openLogin();
    const text = input.value.trim();
    if ((!text && !image) || uploading) return;
    sendBtn.disabled = true;
    showNote("");
    try {
      await Account.api("/api/chat", { action: "send", text, image });
      input.value = "";
      clearPhoto();
      stick = true;
      await poll();
    } catch (err) {
      showNote(err.message);
    }
    sendBtn.disabled = false;
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 700) { e.preventDefault(); form.requestSubmit(); }
  });

  // ---------- Connexion, notifications, démarrage ----------
  function refreshAuth() {
    const on = !!user();
    form.hidden = !on;
    login.hidden = on;
  }

  function refreshNotif() {
    notifBtn.hidden = !("Notification" in window) || Notification.permission !== "default";
  }

  document.getElementById("dcLoginBtn").addEventListener("click", () => Auth.openLogin());
  notifBtn.addEventListener("click", async () => {
    try { await Notification.requestPermission(); } catch (e) {}
    refreshNotif();
  });

  window.addEventListener("auth-changed", () => {
    refreshAuth();
    list.innerHTML = "";
    lastN = 0;
    started = false;
    poll();
  });

  window.addEventListener("load", () => {
    refreshAuth();
    refreshNotif();
    poll();
    setInterval(poll, 4000);
  });
})();
