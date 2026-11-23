// ESPACE ADMIN — ajouter / supprimer des jeux
const ADMIN_EMAIL = "glorylvz986@gmail.com";

const gate = document.getElementById("adminGate");
const panel = document.getElementById("adminPanel");
const form = document.getElementById("gameForm");
const formMsg = document.getElementById("formMsg");
const list = document.getElementById("adminList");

function tokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp * 1000 < Date.now() + 30000;
  } catch (e) {
    return true;
  }
}

function showGate(message, buttonLabel, onClick) {
  panel.hidden = true;
  gate.hidden = false;
  gate.innerHTML = "";

  const p = document.createElement("p");
  p.textContent = message;
  gate.appendChild(p);

  if (buttonLabel) {
    const b = document.createElement("button");
    b.className = "login-btn";
    b.textContent = buttonLabel;
    b.addEventListener("click", onClick);
    gate.appendChild(b);
  }
}

function checkAccess() {
  if (!window.Auth) return showGate("Chargement de la connexion…");

  const user = Auth.getUser();

  if (!user) {
    return showGate("Connecte-toi avec le compte administrateur pour accéder à cet espace.", "Connexion", Auth.openLogin);
  }
  if ((user.email || "").toLowerCase() !== ADMIN_EMAIL) {
    return showGate("Accès réservé à l'administrateur. Tu es connecté avec " + user.email + ".", "Changer de compte", () => {
      Auth.logout();
      Auth.openLogin();
    });
  }
  if (!user.token || tokenExpired(user.token)) {
    return showGate("Ta session admin a expiré. Reconnecte-toi avec Google.", "Se reconnecter", () => {
      Auth.logout();
      Auth.openLogin();
    });
  }

  gate.hidden = true;
  panel.hidden = false;
  loadList();
}

function setMessage(text, type) {
  formMsg.textContent = text;
  formMsg.className = "auth-msg full " + type;
  formMsg.hidden = false;
}

async function api(body) {
  const response = await fetch("/api/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Erreur " + response.status);
  return data;
}

// ---------- Liste des jeux ajoutés ----------
async function loadList() {
  list.textContent = "Chargement…";
  try {
    const response = await fetch("/api/games");
    renderList(await response.json());
  } catch (e) {
    list.textContent = "Impossible de joindre le serveur (/api/games). Le site doit être en ligne sur Vercel, avec le dossier api.";
  }
}

function renderList(games) {
  list.innerHTML = "";
  if (!games.length) {
    list.textContent = "Aucun jeu ajouté pour le moment.";
    return;
  }

  games.forEach(game => {
    const row = document.createElement("div");
    row.className = "admin-row";

    const name = document.createElement("span");
    name.textContent = game.name + " · " + game.category;

    const actions = document.createElement("div");
    const view = document.createElement("a");
    view.href = "game.html?id=" + encodeURIComponent(game.id);
    view.textContent = "Voir";

    const del = document.createElement("button");
    del.textContent = "Supprimer";
    del.addEventListener("click", async () => {
      if (!confirm("Supprimer « " + game.name + " » ?")) return;
      const user = Auth.getUser();
      try {
        await api({ action: "delete", id: game.id, idToken: user && user.token });
        loadList();
      } catch (err) {
        alert(err.message);
      }
    });

    actions.append(view, del);
    row.append(name, actions);
    list.appendChild(row);
  });
}

// ---------- Ajout d'un jeu ----------
form.addEventListener("submit", async e => {
  e.preventDefault();

  const user = window.Auth && Auth.getUser();
  if (!user || !user.token || tokenExpired(user.token)) return checkAccess();

  const data = new FormData(form);
  const lines = key => String(data.get(key) || "").split("\n").map(s => s.trim()).filter(Boolean);

  const game = {
    name: data.get("name"),
    category: data.get("category"),
    developer: data.get("developer"),
    platform: data.get("platform"),
    size: data.get("size"),
    version: data.get("version"),
    description: data.get("description"),
    info: data.get("info"),
    cover: data.get("cover"),
    screenshots: lines("screenshots"),
    downloadUrls: lines("downloadUrls")
  };

  const submit = document.getElementById("gameSubmit");
  submit.disabled = true;
  formMsg.hidden = true;

  try {
    await api({ action: "add", idToken: user.token, game });
    form.reset();
    setMessage("Jeu ajouté ! Il apparaît maintenant sur le site.", "ok");
    loadList();
  } catch (err) {
    setMessage(err.message, "error");
  } finally {
    submit.disabled = false;
  }
});

window.addEventListener("auth-changed", checkAccess);
window.addEventListener("load", checkAccess);
