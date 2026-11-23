// CONNEXION / INSCRIPTION avec Firebase Authentication
// - Google (fenêtre pop-up)
// - Lien de connexion envoyé par e-mail (sans mot de passe)
// Une première connexion crée automatiquement le compte (= inscription).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// ⚠️ Remplace ces valeurs par celles de ton projet Firebase :
// Console Firebase > Paramètres du projet > Tes applications > Application Web > "Configuration"
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "VOTRE_PROJET.firebaseapp.com",
  projectId: "VOTRE_PROJET",
  appId: "VOTRE_APP_ID"
};

const configured = !firebaseConfig.apiKey.startsWith("VOTRE");
const auth = configured ? getAuth(initializeApp(firebaseConfig)) : null;

let currentUser = null;
let authReady = !configured;
let pendingAction = null;

const ERRORS = {
  "auth/invalid-email": "Adresse e-mail invalide.",
  "auth/unauthorized-domain": "Ce domaine n'est pas autorisé. Ajoute-le dans Firebase > Authentication > Paramètres > Domaines autorisés.",
  "auth/operation-not-allowed": "Ce mode de connexion n'est pas activé dans la console Firebase.",
  "auth/popup-blocked": "Le navigateur a bloqué la fenêtre Google. Autorise les pop-ups puis réessaie.",
  "auth/network-request-failed": "Problème de connexion internet. Réessaie.",
  "auth/invalid-action-code": "Ce lien a expiré ou a déjà été utilisé. Demande un nouveau lien.",
  "auth/expired-action-code": "Ce lien a expiré. Demande un nouveau lien.",
  "auth/too-many-requests": "Trop de tentatives. Réessaie dans quelques minutes.",
  "auth/invalid-api-key": "La clé Firebase est invalide : vérifie firebaseConfig dans auth.js."
};

// ---------- Utilisateur ----------
function toUser(u) {
  if (!u) return null;
  return {
    id: u.uid,
    name: u.displayName || (u.email || "").split("@")[0] || "Joueur",
    email: u.email || "",
    picture: u.photoURL || ""
  };
}

function getUser() {
  return currentUser;
}

// ---------- Fenêtre de connexion ----------
function buildModal() {
  if (document.getElementById("authModal")) return;

  const modal = document.createElement("div");
  modal.className = "auth-modal";
  modal.id = "authModal";
  modal.hidden = true;
  modal.innerHTML =
    '<div class="auth-box" role="dialog" aria-modal="true" aria-labelledby="authTitle">' +
      '<button class="auth-close" id="authClose" aria-label="Fermer">✕</button>' +
      '<h2 id="authTitle">Connexion / Inscription</h2>' +
      '<p>Connecte-toi pour télécharger les jeux. Ton compte est créé automatiquement la première fois.</p>' +
      '<button class="google-btn" id="googleLogin" type="button">' +
        '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.100C.9 16.400 0 20.100 0 24s.9 7.600 2.600 10.800l7.900-6.100z"/><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z"/></svg>' +
        'Continuer avec Google' +
      '</button>' +
      '<div class="auth-divider"><span>ou</span></div>' +
      '<form class="auth-form" id="emailForm">' +
        '<input type="email" id="emailInput" placeholder="ton.email@gmail.com" autocomplete="email" required>' +
        '<button type="submit" id="emailSubmit">Recevoir un lien de connexion</button>' +
      '</form>' +
      '<p class="auth-msg" id="authMsg" hidden></p>' +
    '</div>';
  document.body.appendChild(modal);

  document.getElementById("authClose").addEventListener("click", closeLogin);
  modal.addEventListener("click", e => { if (e.target === modal) closeLogin(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeLogin(); });

  document.getElementById("googleLogin").addEventListener("click", loginWithGoogle);
  document.getElementById("emailForm").addEventListener("submit", e => {
    e.preventDefault();
    sendLink(document.getElementById("emailInput").value.trim());
  });
}

function showMessage(text, type) {
  const box = document.getElementById("authMsg");
  if (!box) return;
  box.textContent = text;
  box.className = "auth-msg " + (type || "error");
  box.hidden = false;
}

function handleError(error) {
  if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") return;
  showMessage(ERRORS[error.code] || "Une erreur est survenue (" + (error.code || error.message) + ").", "error");
}

function openLogin() {
  buildModal();
  document.getElementById("authMsg").hidden = true;
  document.getElementById("authModal").hidden = false;

  if (!configured) {
    showMessage("Firebase n'est pas encore configuré : remplis firebaseConfig dans auth.js.", "error");
  }
}

function closeLogin() {
  const modal = document.getElementById("authModal");
  if (modal) modal.hidden = true;
}

// ---------- Connexion Google ----------
async function loginWithGoogle() {
  if (!configured) return openLogin();

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  } catch (error) {
    handleError(error);
  }
}

// ---------- Connexion par lien e-mail ----------
async function sendLink(email) {
  if (!configured) return openLogin();

  const submit = document.getElementById("emailSubmit");
  submit.disabled = true;

  const settings = {
    // Page sur laquelle le lien du mail ramène l'utilisateur
    url: new URL("index.html", window.location.href).href,
    handleCodeInApp: true
  };

  try {
    await sendSignInLinkToEmail(auth, email, settings);
    // On garde l'adresse pour terminer la connexion sur le même appareil
    window.localStorage.setItem("emailForSignIn", email);
    showMessage("Lien envoyé à " + email + ". Ouvre ta boîte mail (regarde aussi les spams) et clique sur le lien.", "ok");
  } catch (error) {
    handleError(error);
  } finally {
    submit.disabled = false;
  }
}

async function completeEmailLink() {
  if (!configured || !isSignInWithEmailLink(auth, window.location.href)) return;

  let email = window.localStorage.getItem("emailForSignIn");
  if (!email) {
    // Lien ouvert sur un autre appareil : on redemande l'adresse
    email = window.prompt("Confirme ton adresse e-mail pour terminer la connexion :");
  }
  if (!email) return;

  try {
    await signInWithEmailLink(auth, email, window.location.href);
    window.localStorage.removeItem("emailForSignIn");
    window.history.replaceState(null, "", window.location.pathname);
  } catch (error) {
    openLogin();
    handleError(error);
  }
}

// ---------- Déconnexion et protection d'une action ----------
function logout() {
  pendingAction = null;
  if (auth) signOut(auth);
}

// Exécute l'action si connecté, sinon ouvre la connexion puis l'exécute après
function requireLogin(action) {
  if (currentUser) {
    action();
  } else {
    pendingAction = action;
    openLogin();
  }
}

// ---------- Affichage dans l'en-tête ----------
function renderAuth() {
  const area = document.getElementById("authArea");
  if (!area) return;

  area.innerHTML = "";
  if (!authReady) return;

  if (!currentUser) {
    const btn = document.createElement("button");
    btn.className = "login-btn";
    btn.textContent = "Connexion";
    btn.addEventListener("click", openLogin);
    area.appendChild(btn);
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "user-menu";

  const avatar = document.createElement("button");
  avatar.className = "avatar-btn";
  avatar.setAttribute("aria-label", "Menu du compte");

  if (currentUser.picture) {
    const img = document.createElement("img");
    img.src = currentUser.picture;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    avatar.appendChild(img);
  } else {
    avatar.textContent = currentUser.name.charAt(0).toUpperCase();
  }

  const panel = document.createElement("div");
  panel.className = "user-panel";
  panel.hidden = true;

  const name = document.createElement("strong");
  name.textContent = currentUser.name;
  const email = document.createElement("span");
  email.textContent = currentUser.email;
  const out = document.createElement("button");
  out.className = "logout-btn";
  out.textContent = "Se déconnecter";
  out.addEventListener("click", logout);

  panel.append(name, email, out);
  wrap.append(avatar, panel);
  area.appendChild(wrap);

  avatar.addEventListener("click", e => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
  });
  document.addEventListener("click", e => {
    if (!wrap.contains(e.target)) panel.hidden = true;
  });
}

window.Auth = { getUser, requireLogin, openLogin, logout };

// ---------- Démarrage ----------
renderAuth();

if (configured) {
  onAuthStateChanged(auth, user => {
    currentUser = toUser(user);
    authReady = true;
    renderAuth();

    if (currentUser) {
      closeLogin();
      if (pendingAction) {
        const action = pendingAction;
        pendingAction = null;
        action();
      }
    }
  });

  completeEmailLink();
}
