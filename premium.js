// PAGE ABONNEMENTS — modifie ici les avantages, les prix affichés et les liens de paiement
const PRO_URL = "https://huntergaming.mychariow.com/prd_iv2djqhn/checkout";
const ELITE_URL = "https://huntergaming.mychariow.com/prd_8obiw9oy/checkout";

const PLANS = [
  {
    id: "free", name: "Free Gamers", price: "Gratuit", note: "", url: "",
    perks: [
      ["Accès à tous les jeux du site", true],
      ["Messagerie pour poser tes questions", true],
      ["Sans aucune publicité", false],
      ["Insigne ou badge à côté de ton nom", false],
      ["Réponses prioritaires", false]
    ]
  },
  {
    id: "pro", name: "Gamer Pro 💎", price: "≈ 2,23 $", note: "Prix indicatif, le montant exact s'affiche sur la page de paiement.", url: PRO_URL,
    perks: [
      ["Accès à tous les jeux du site", true],
      ["Messagerie pour poser tes questions", true],
      ["Sans aucune publicité", true],
      ["Insigne 💎 à côté de ton nom", true],
      ["Réponses prioritaires", true]
    ]
  },
  {
    id: "elite", name: "Élite Gamers 👑", price: "≈ 3,56 $", note: "Prix indicatif, le montant exact s'affiche sur la page de paiement.", url: ELITE_URL, tag: "Le plus complet",
    perks: [
      ["Accès à tous les jeux du site", true],
      ["Messagerie pour poser tes questions", true],
      ["Sans aucune publicité", true],
      ["Badge certifié ✔ à côté de ton nom, couleur au choix (bleu, vert ou noir)", true],
      ["Réponses VIP : tes questions passent en tout premier", true]
    ]
  }
];

const grid = document.getElementById("planGrid");
const planNow = document.getElementById("planNow");

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function render(current) {
  grid.innerHTML = "";
  PLANS.forEach(p => {
    const card = el("article", "plan-card" + (p.id === current ? " current" : ""));
    if (p.tag) card.appendChild(el("span", "plan-tag", p.tag));
    card.appendChild(el("h3", "", p.name));
    card.appendChild(el("div", "plan-price", p.price));
    if (p.note) card.appendChild(el("small", "profile-note", p.note));

    const ul = el("ul", "plan-perks");
    p.perks.forEach(([label, ok]) => ul.appendChild(el("li", ok ? "" : "no", (ok ? "✅ " : "✖ ") + label)));
    card.appendChild(ul);

    if (p.id === current) {
      card.appendChild(el("p", "profile-note", "✔ C'est ton abonnement actuel"));
    } else if (p.url) {
      const a = el("a", "detail-download", "Choisir " + p.name.replace(/ [^\w ]+$/, ""));
      a.href = p.url;
      a.target = "_blank";
      a.rel = "noopener";
      card.appendChild(a);
    }
    grid.appendChild(card);
  });
}

async function refresh() {
  render("");
  if (!window.Auth || !window.Account || !Auth.getUser()) return;
  const a = await Account.status(true);
  render(a.plan);
  if (a.premium) {
    planNow.textContent = "Ton abonnement est actif " + (a.until ? "jusqu'au " + new Date(a.until).toLocaleDateString("fr-FR") : "sans limite de durée") + " : tu ne vois aucune publicité.";
    planNow.className = "auth-msg ok";
    planNow.hidden = false;
  } else {
    planNow.hidden = true;
  }
}

window.addEventListener("auth-changed", refresh);
window.addEventListener("load", refresh);
