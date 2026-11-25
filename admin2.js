// ADMIN (ajouts) : utilisateurs et abonnements, questions des joueurs, bugs signalés
(function () {
  const PLAN_LABEL = { free: "Free Gamers", pro: "Gamer Pro 💎", elite: "Élite Gamers 👑" };
  const userList = document.getElementById("userList");
  const userSearch = document.getElementById("userSearch");
  const planForm = document.getElementById("planForm");
  const planMsg = document.getElementById("planMsg");
  const qList = document.getElementById("qList");
  const bugList = document.getElementById("bugList");
  let users = [];
  const liveOnline = document.getElementById("liveOnline");
  const liveAccounts = document.getElementById("liveAccounts");

  async function loadLive() {
    try {
      const d = await post("/api/online", { action: "count", idToken: window.Auth && Auth.getUser() && Auth.getUser().token });
      liveOnline.textContent = d.online;
      liveAccounts.textContent = d.accounts;
    } catch (e) {
      liveOnline.textContent = "–";
      liveAccounts.textContent = "–";
    }
  }
  setInterval(() => { if (!document.hidden && typeof panel !== "undefined" && !panel.hidden) loadLive(); }, 15000);

  const tok = () => { const u = window.Auth && Auth.getUser(); return u && u.token; };
  const day = ms => new Date(ms).toLocaleDateString("fr-FR");
  const when = ms => new Date(ms).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function pick(options, value) {
    const s = document.createElement("select");
    options.forEach(([v, label]) => s.add(new Option(label, v)));
    s.value = value;
    return s;
  }

  const PLANS = [["free", "Free Gamers"], ["pro", "Gamer Pro"], ["elite", "Élite Gamers"]];
  const DAYS = [["30", "30 jours"], ["90", "3 mois"], ["365", "1 an"], ["0", "À vie"]];

  function badge(plan, until) {
    const text = PLAN_LABEL[plan] + (plan === "free" ? "" : until ? " · jusqu'au " + day(until) : " · à vie");
    return el("span", "plan-badge " + plan, text);
  }

  // ---------- Utilisateurs ----------
  async function setPlan(email, plan, days) {
    await post("/api/users", { action: "setPlan", idToken: tok(), email, plan, days });
    await loadUsers();
  }

  function renderUsers() {
    const q = userSearch.value.trim().toLowerCase();
    const rows = users.filter(u => !q || u.email.toLowerCase().includes(q) || (u.name || "").toLowerCase().includes(q)).slice(0, 100);
    userList.innerHTML = "";
    if (!rows.length) {
      userList.textContent = users.length ? "Aucun résultat." : "Aucun utilisateur pour le moment : ils apparaissent ici après leur première visite connectée.";
      return;
    }
    rows.forEach(u => {
      const row = el("div", "user-row");
      const main = el("div", "user-main");
      const info = el("div");
      const nameEl = el("strong", "", u.name || u.email);
      const vb = window.Account && Account.badge && Account.badge(u.plan, u.badgeColor);
      if (vb) nameEl.appendChild(vb);
      info.append(nameEl, el("small", "", u.email + (u.lastSeen ? " · vu le " + when(u.lastSeen) : "")));
      main.append(info, badge(u.plan, u.until));

      const ctl = el("div", "user-ctl");
      const plan = pick(PLANS, u.plan);
      const days = pick(DAYS, "30");
      const btn = el("button", "", "Appliquer");
      btn.type = "button";
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try { await setPlan(u.email, plan.value, days.value); } catch (e) { alert(e.message); btn.disabled = false; }
      });
      ctl.append(plan, days, btn);
      row.append(main, ctl);
      userList.appendChild(row);
    });
  }

  async function loadUsers() {
    userList.textContent = "Chargement…";
    try {
      users = await post("/api/users", { action: "list", idToken: tok() });
      renderUsers();
    } catch (e) {
      userList.textContent = e.message;
    }
  }

  userSearch.addEventListener("input", renderUsers);

  planForm.addEventListener("submit", async e => {
    e.preventDefault();
    const d = new FormData(planForm);
    const btn = document.getElementById("planSubmit");
    btn.disabled = true;
    try {
      await setPlan(String(d.get("email")).trim(), d.get("plan"), d.get("days"));
      planForm.reset();
      setMessage(planMsg, "Abonnement enregistré.", "ok");
    } catch (err) {
      setMessage(planMsg, err.message, "error");
    }
    btn.disabled = false;
  });

  // ---------- Questions et bugs ----------
  function renderSupport(box, items, empty) {
    box.innerHTML = "";
    if (!items.length) { box.textContent = empty; return; }
    items.forEach(item => {
      const wrap = el("div", "sup-item");
      const meta = el("div", "sup-meta");
      meta.append(document.createTextNode((item.name || "") + " (" + item.email + ") · " + when(item.createdAt) + (item.page ? " · " + item.page : "") + " "), badge(item.plan || "free", 0));
      wrap.append(meta, el("div", "sup-text", item.text));
      if (item.reply) wrap.appendChild(el("div", "sup-answer", "Ta réponse : " + item.reply));

      const reply = el("div", "sup-reply");
      const area = document.createElement("textarea");
      area.maxLength = 1000;
      area.placeholder = item.kind === "bug" ? "Note ou réponse (le joueur la verra)…" : "Ta réponse…";
      const send = el("button", "", item.reply ? "Modifier" : "Répondre");
      send.type = "button";
      const del = el("button", "del", "Supprimer");
      del.type = "button";
      send.addEventListener("click", async () => {
        if (!area.value.trim()) return;
        send.disabled = true;
        try { await post("/api/support", { action: "reply", idToken: tok(), id: item.id, text: area.value }); loadSupport(); } catch (e) { alert(e.message); send.disabled = false; }
      });
      del.addEventListener("click", async () => {
        if (!confirm("Supprimer ce message ?")) return;
        try { await post("/api/support", { action: "delete", idToken: tok(), id: item.id }); loadSupport(); } catch (e) { alert(e.message); }
      });
      const actions = el("div", "sup-actions");
      actions.append(send, del);
      reply.append(area, actions);
      wrap.appendChild(reply);
      box.appendChild(wrap);
    });
  }

  async function loadSupport() {
    try {
      const items = await post("/api/support", { action: "list", idToken: tok() });
      const rank = { elite: 0, pro: 1, free: 2 };
      items.sort((a, b) => (!!a.reply - !!b.reply) || ((rank[a.plan] ?? 2) - (rank[b.plan] ?? 2)) || (b.createdAt - a.createdAt));
      renderSupport(qList, items.filter(i => i.kind !== "bug"), "Aucune question pour le moment.");
      renderSupport(bugList, items.filter(i => i.kind === "bug"), "Aucun bug signalé.");
    } catch (e) {
      qList.textContent = e.message;
      bugList.textContent = e.message;
    }
  }

  window.loadAdminExtras = function () { loadLive(); loadUsers(); loadSupport(); };
})();
