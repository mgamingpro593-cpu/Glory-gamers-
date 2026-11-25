// PROFIL (ajouts) : abonnement, badge personnalisable, signalement de bugs
const planInfo = document.getElementById("planInfo");
const badgeBox = document.getElementById("badgeBox");
const bugForm = document.getElementById("bugForm");
const bugMsg = document.getElementById("bugMsg");
const bugSubmit = document.getElementById("bugSubmit");
const COLORS = [["blue", "Bleu"], ["green", "Vert"], ["black", "Noir"]];

function renderBadge(a) {
  badgeBox.innerHTML = "";
  if (a.plan !== "pro" && a.plan !== "elite") { badgeBox.hidden = true; return; }
  badgeBox.hidden = false;
  const label = document.createElement("span");
  label.textContent = a.plan === "elite" ? "Ton badge certifié :" : "Ton insigne Gamer Pro :";
  badgeBox.append(label, Account.badge(a.plan, a.badgeColor));
  if (a.plan !== "elite") return;
  COLORS.forEach(([c, name]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "badge-pick" + (a.badgeColor === c ? " on" : "");
    b.textContent = name;
    b.addEventListener("click", async () => {
      b.disabled = true;
      try { await Account.setColor(c); } catch (e) { alert(e.message); b.disabled = false; }
    });
    badgeBox.appendChild(b);
  });
}

async function showPlan(force) {
  if (!window.Auth || !Auth.getUser() || !window.Account) return;
  const a = await Account.status(force === true);
  let t = "Abonnement actuel : " + (Account.names[a.plan] || "Free Gamers") + " " + (Account.badges[a.plan] || "");
  if (a.premium) t += " (" + (a.until ? "jusqu'au " + new Date(a.until).toLocaleDateString("fr-FR") : "sans limite de durée") + ") : aucune publicité.";
  else t += " : les publicités sont affichées.";
  planInfo.textContent = t.trim();
  renderBadge(a);
}

bugForm.addEventListener("submit", async e => {
  e.preventDefault();
  const text = bugForm.elements.text.value.trim();
  if (!text) return;
  bugSubmit.disabled = true;
  bugMsg.hidden = true;
  try {
    await Account.api("/api/support", { action: "send", kind: "bug", text, page: "profile.html" });
    bugForm.reset();
    bugMsg.textContent = "Merci ! Ton signalement a bien été envoyé.";
    bugMsg.className = "auth-msg full ok";
  } catch (err) {
    bugMsg.textContent = err.message;
    bugMsg.className = "auth-msg full error";
  }
  bugMsg.hidden = false;
  bugSubmit.disabled = false;
});

window.addEventListener("auth-changed", () => showPlan(true));
window.addEventListener("account-changed", () => showPlan(false));
window.addEventListener("load", () => showPlan(true));
