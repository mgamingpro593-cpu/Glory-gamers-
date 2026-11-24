// PUBLICITÉS (accueil + pages des jeux)
// Tout se règle ici :
const AD_DIRECT_LINK = "https://ardance.org/4/cfd00f67c4c7385ff2c69b400955b213"; // "" pour désactiver
const AD_EXTRA_SRC = "https://bellnewyork.org/14/3d34ad71de499262ce49bad8dbe75665"; // script chargé une fois ; "" pour désactiver

(function () {
  // ----- Emplacement visible : sous "Jeux populaires" sur l'accueil, avant le pied de page ailleurs -----
  if (AD_DIRECT_LINK) {
    const section = document.createElement("section");
    section.className = "ad-section";
    section.setAttribute("aria-label", "Publicité");

    const label = document.createElement("span");
    label.className = "ad-label";
    label.textContent = "Publicité";

    const link = document.createElement("a");
    link.className = "ad-direct";
    link.href = AD_DIRECT_LINK;
    link.target = "_blank";
    link.rel = "sponsored noopener noreferrer";
    link.textContent = "Offre sponsorisée ›";

    section.append(label, link);

    const anchor = document.getElementById("popular");
    if (anchor) anchor.after(section);
    else document.querySelector("footer").before(section);
  }

  // ----- Script supplémentaire : chargé une seule fois -----
  if (AD_EXTRA_SRC) {
    const extra = document.createElement("script");
    extra.async = true;
    extra.setAttribute("data-cfasync", "false");
    extra.src = AD_EXTRA_SRC;
    document.body.appendChild(extra);
  }
})();
