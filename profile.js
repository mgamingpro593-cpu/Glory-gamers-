// ESPACE PROFIL : nom, photo, langue, thème
const ADMIN_EMAIL = "glorylvz985@gmail.com";

const gate = document.getElementById("profileGate");
const panel = document.getElementById("profilePanel");
const bigAvatar = document.getElementById("bigAvatar");
const nameForm = document.getElementById("nameForm");
const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const msg = document.getElementById("profileMsg");
const langSelect = document.getElementById("langSelect");
const themeSelect = document.getElementById("themeSelect");
const adminCard = document.getElementById("adminCard");
const photoInput = document.getElementById("photoInput");
const photoReset = document.getElementById("photoReset");

let nameDirty = false;

// ---------- Profil enregistré sur l'appareil ----------
const keyFor = user => "gg_profile_" + user.id;

function loadProfile(user) {
  try {
    return JSON.parse(localStorage.getItem(keyFor(user))) || {};
  } catch (e) {
    return {};
  }
}

function saveProfile(user, profile) {
  try {
    if (profile.name || profile.photo) localStorage.setItem(keyFor(user), JSON.stringify(profile));
    else localStorage.removeItem(keyFor(user));
  } catch (e) {
    setMessage("Stockage plein : impossible d'enregistrer.", "error");
    return false;
  }
  window.dispatchEvent(new Event("profile-changed"));
  return true;
}

function setMessage(text, type) {
  msg.textContent = text;
  msg.className = "auth-msg " + type;
  msg.hidden = false;
}

// ---------- Affichage ----------
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

function renderAvatar(user, profile) {
  bigAvatar.innerHTML = "";
  const src = profile.photo || user.picture;

  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    bigAvatar.appendChild(img);
  } else {
    bigAvatar.textContent = (profile.name || user.name || "?").charAt(0).toUpperCase();
  }
}

function checkAccess() {
  if (!window.Auth) return showGate("Chargement…");

  const user = Auth.getUser();
  if (!user) return showGate("Connecte-toi pour accéder à ton profil.", "Connexion", Auth.openLogin);

  gate.hidden = true;
  panel.hidden = false;

  const profile = loadProfile(user);
  if (!nameDirty) nameInput.value = profile.name || user.name || "";
  emailInput.value = user.email || "";
  renderAvatar(user, profile);
  langSelect.value = Prefs.getLang();
  themeSelect.value = Prefs.getTheme();
  adminCard.hidden = (user.email || "").toLowerCase() !== ADMIN_EMAIL;
}

// ---------- Nom ----------
nameInput.addEventListener("input", () => { nameDirty = true; });

nameForm.addEventListener("submit", e => {
  e.preventDefault();
  const user = Auth.getUser();
  if (!user) return;

  const name = nameInput.value.trim();
  if (!name) return setMessage("Le nom ne peut pas être vide.", "error");

  const profile = loadProfile(user);
  if (name === user.name) delete profile.name;
  else profile.name = name;

  nameDirty = false;
  if (saveProfile(user, profile)) setMessage("Profil enregistré.", "ok");
});

// ---------- Photo (recadrée en carré 256 px pour rester légère) ----------
photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  photoInput.value = "";
  const user = Auth.getUser();
  if (!file || !user) return;

  if (!file.type.startsWith("image/")) return setMessage("Choisis un fichier image.", "error");
  if (file.size > 8 * 1024 * 1024) return setMessage("Image trop lourde (8 Mo max).", "error");

  const reader = new FileReader();
  reader.onerror = () => setMessage("Impossible de lire cette image.", "error");
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => setMessage("Impossible de lire cette image.", "error");
    img.onload = () => {
      const size = 256;
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d").drawImage(
        img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size
      );

      const profile = loadProfile(user);
      profile.photo = canvas.toDataURL("image/jpeg", 0.85);
      if (saveProfile(user, profile)) setMessage("Photo mise à jour.", "ok");
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

photoReset.addEventListener("click", () => {
  const user = Auth.getUser();
  if (!user) return;

  const profile = loadProfile(user);
  delete profile.photo;
  if (saveProfile(user, profile)) setMessage("Photo Google rétablie.", "ok");
});

// ---------- Langue et thème ----------
langSelect.addEventListener("change", () => {
  Prefs.setLang(langSelect.value);
  window.location.reload();
});

themeSelect.addEventListener("change", () => {
  Prefs.setTheme(themeSelect.value);
});

window.addEventListener("auth-changed", checkAccess);
window.addEventListener("load", checkAccess);
