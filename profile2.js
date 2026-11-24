// PROFIL (ajouts) : abonnement + signalement de bugs
const planInfo = document.getElementById("planInfo");
const bugForm = document.getElementById("bugForm");
const bugMsg = document.getElementById("bugMsg");
const bugSubmit = document.getElementById("bugSubmit");

async function showPlan() {
  if (!window.Auth || !Auth.getUser() || !window.Account) return;
  const a = await Account.status(true);
  let t = "Abonnement actuel : " + (Account.names[a.plan] || "Free Gamers") + " " + (Account.badges[a.plan] || "");
  if (a.premium) t += " (" + (a.until ? "jusqu'au " + new Date(a.until).toLocaleDateString("fr-FR") : "sans limite de durée") + ") : aucune publicité.";
  else t += " : les publicités sont affichées.";
  planInfo.textContent = t.trim();
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

window.addEventListener("auth-changed", showPlan);
window.addEventListener("load", showPlan);
