// DONNÉES DES JEUX — les jeux s'ajoutent depuis l'espace admin (liste vide ici).
// downloadUrl : mets le lien de téléchargement (laisse "" tant qu'il n'est pas prêt).
// screenshots : liste d'images (liens ou fichiers dans un dossier, ex: "img/naruto1.jpg").
const GAMES = [];

// Liste complète = jeux ci-dessus + jeux ajoutés depuis l'espace admin (/api/games)
async function loadAllGames() {
  let extra = [];
  try {
    const response = await fetch("/api/games");
    if (response.ok) extra = await response.json();
  } catch (e) {
    // pas de serveur : on garde seulement la liste de base
  }
  if (!Array.isArray(extra)) extra = [];
  return GAMES.filter(g => !extra.some(x => x.id === g.id)).concat(extra);
}
