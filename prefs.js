// PRÉFÉRENCES DU SITE : langue + thème (enregistrés sur l'appareil)
// Le site est écrit en français : pour une autre langue, on traduit les textes affichés.
// Pour ajouter une langue : ajoute-la dans LANGS, dans le menu du profil, et crée son dictionnaire.
(function () {
  var LANG_KEY = "gg_lang";
  var THEME_KEY = "gg_theme";
  var LANGS = ["fr", "en"];
  var THEMES = ["dark", "light", "auto"];

  function read(key, fallback, allowed) {
    try {
      var v = localStorage.getItem(key);
      return allowed.indexOf(v) > -1 ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  var lang = read(LANG_KEY, "fr", LANGS);
  var theme = read(THEME_KEY, "dark", THEMES);
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  // ---------- THÈME ----------
  function applyTheme() {
    var resolved = theme === "auto" ? (media && media.matches ? "light" : "dark") : theme;
    document.documentElement.setAttribute("data-theme", resolved);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolved === "light" ? "#f3f3fa" : "#090914");
  }
  applyTheme();
  document.addEventListener("DOMContentLoaded", applyTheme);
  if (media && media.addEventListener) media.addEventListener("change", applyTheme);

  // ---------- LANGUE ----------
  document.documentElement.lang = lang;

  var EN = {
    // Menu et en-tête
    "Accueil": "Home",
    "Jeux populaires": "Popular games",
    "Tous les jeux": "All games",
    "Catégories": "Categories",
    "À propos": "About",
    "Rechercher": "Search",
    "Ouvrir le menu": "Open menu",
    "Rechercher un jeu...": "Search for a game...",
    "Précédent": "Previous",
    "Suivant": "Next",
    "Fermer": "Close",
    "Menu du compte": "Account menu",
    // Accueil
    "À NE PAS MANQUER": "NOT TO BE MISSED",
    "POPULAIRE": "POPULAR",
    "monde ouvert": "open world",
    "Découvrir le jeu": "Discover the game",
    "Explore un immense monde ouvert et découvre l'univers GTA.": "Explore a huge open world and discover the GTA universe.",
    "TA PROCHAINE AVENTURE": "YOUR NEXT ADVENTURE",
    "Tous": "All",
    "Course": "Racing",
    "Aventure": "Adventure",
    "Aucun jeu trouvé.": "No games found.",
    "Bienvenue chez Glory Gamers": "Welcome to Glory Gamers",
    "Ton espace dédié aux jeux vidéo, aux découvertes et aux aventures gaming.": "Your space dedicated to video games, discoveries and gaming adventures.",
    "Une passion, un univers, des jeux.": "One passion, one universe, many games.",
    "Voir le jeu": "View game",
    "Glory Gamers - Jeux vidéo": "Glory Gamers - Video games",
    // Page d'un jeu
    "‹ Retour aux jeux": "‹ Back to games",
    "Chargement…": "Loading…",
    "Jeu introuvable.": "Game not found.",
    "Plateforme": "Platform",
    "Taille": "Size",
    "Catégorie": "Category",
    "Développeur": "Developer",
    "Description": "Description",
    "Informations": "Information",
    "Captures d'écran": "Screenshots",
    "Télécharger": "Download",
    "Télécharger ↓": "Download ↓",
    // Connexion
    "Connexion": "Log in",
    "Connexion / Inscription": "Log in / Sign up",
    "Connecte-toi pour télécharger les jeux. Ton compte est créé automatiquement la première fois.": "Log in to download games. Your account is created automatically the first time.",
    "Continuer avec Google": "Continue with Google",
    "ou": "or",
    "Recevoir un lien de connexion": "Get a sign-in link",
    "ton.email@gmail.com": "your.email@gmail.com",
    "Se déconnecter": "Log out",
    "👤 Mon profil": "👤 My profile",
    "⚙ Espace admin": "⚙ Admin area",
    "Impossible de charger Google. Vérifie ta connexion internet.": "Couldn't load Google. Check your internet connection.",
    // Profil
    "Mon profil": "My profile",
    "‹ Retour au site": "‹ Back to site",
    "Connecte-toi pour accéder à ton profil.": "Log in to access your profile.",
    "Photo de profil": "Profile picture",
    "Changer la photo": "Change photo",
    "Utiliser ma photo Google": "Use my Google photo",
    "Nom d'affichage": "Display name",
    "Adresse e-mail": "Email address",
    "Enregistrer": "Save",
    "Ton nom et ta photo sont enregistrés sur cet appareil.": "Your name and photo are saved on this device.",
    "Préférences": "Preferences",
    "Langue": "Language",
    "Thème": "Theme",
    "Sombre": "Dark",
    "Clair": "Light",
    "Automatique (appareil)": "Automatic (device)",
    "Espace admin": "Admin area",
    "Ouvrir l'espace admin": "Open admin area",
    "Profil enregistré.": "Profile saved.",
    "Photo mise à jour.": "Photo updated.",
    "Photo Google rétablie.": "Google photo restored.",
    "Choisis un fichier image.": "Choose an image file.",
    "Image trop lourde (8 Mo max).": "Image too large (8 MB max).",
    "Impossible de lire cette image.": "Couldn't read this image.",
    "Le nom ne peut pas être vide.": "The name can't be empty.",
    "Stockage plein : impossible d'enregistrer.": "Storage full: couldn't save.",
    "Joueur": "Player"
  };

  var PATTERNS = [
    [/^(\d+) jeux$/, function (m) { return m[1] + (m[1] === "1" ? " game" : " games"); }],
    [/^Ouvrir la page de (.+)$/, function (m) { return "Open the page of " + m[1]; }],
    [/^Afficher le jeu (\d+)$/, function (m) { return "Show game " + m[1]; }],
    [/^Agrandir la capture (\d+)$/, function (m) { return "Enlarge screenshot " + m[1]; }],
    [/^Télécharger(?: \(lien (\d+)\))? ↓$/, function (m) { return "Download" + (m[1] ? " (link " + m[1] + ")" : "") + " ↓"; }],
    [/^© (\d+) Glory Gamers\. Tous droits réservés\.$/, function (m) { return "© " + m[1] + " Glory Gamers. All rights reserved."; }],
    [/^Le lien de téléchargement de (.+) sera ajouté prochainement\.$/, function (m) { return "The download link for " + m[1] + " will be added soon."; }],
    [/^Si Google affiche l'erreur « origin_mismatch », ajoute cette adresse dans Google Cloud > Identifiants > ton ID client > Origines JavaScript autorisées : (.+)$/,
      function (m) { return "If Google shows an “origin_mismatch” error, add this address in Google Cloud > Credentials > your client ID > Authorized JavaScript origins: " + m[1]; }]
  ];

  function tx(s) {
    if (lang === "fr") return s;
    if (Object.prototype.hasOwnProperty.call(EN, s)) return EN[s];
    for (var i = 0; i < PATTERNS.length; i++) {
      var m = PATTERNS[i][0].exec(s);
      if (m) return PATTERNS[i][1](m);
    }
    return s;
  }

  var ATTRS = ["placeholder", "aria-label", "title"];
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1 };

  function translateText(node) {
    var parent = node.parentNode;
    if (parent && SKIP[parent.tagName]) return;
    var raw = node.nodeValue;
    var trimmed = raw.trim();
    if (!trimmed) return;
    var translated = tx(trimmed);
    if (translated !== trimmed) node.nodeValue = raw.replace(trimmed, translated);
  }

  function translateAttrs(el) {
    ATTRS.forEach(function (a) {
      var v = el.getAttribute && el.getAttribute(a);
      if (v) {
        var t = tx(v);
        if (t !== v) el.setAttribute(a, t);
      }
    });
  }

  function walk(node) {
    if (node.nodeType === 3) return translateText(node);
    if (node.nodeType !== 1 || SKIP[node.tagName]) return;
    translateAttrs(node);
    node.childNodes.forEach(walk);
  }

  function start() {
    if (lang === "fr") return;
    document.title = tx(document.title);
    walk(document.body);
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        if (m.type === "childList") m.addedNodes.forEach(walk);
        else if (m.type === "characterData") translateText(m.target);
        else if (m.type === "attributes") translateAttrs(m.target);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.Prefs = {
    getLang: function () { return lang; },
    setLang: function (value) { if (LANGS.indexOf(value) > -1) { lang = value; write(LANG_KEY, value); } },
    getTheme: function () { return theme; },
    setTheme: function (value) { if (THEMES.indexOf(value) > -1) { theme = value; write(THEME_KEY, value); applyTheme(); } },
    t: tx
  };
})();
