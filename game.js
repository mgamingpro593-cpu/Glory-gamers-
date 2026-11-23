// PAGE DÉTAIL D'UN JEU
const root = document.getElementById("gameDetail");
const id = new URLSearchParams(window.location.search).get("id");
const game = GAMES.find(g => g.id === id);

if (!game) {
  root.innerHTML =
    '<a href="index.html" class="back-link">‹ Retour aux jeux</a>' +
    '<p class="no-results">Jeu introuvable.</p>';
} else {
  document.title = game.name + " - Glory Gamers";

  const downloadHTML = '<button class="detail-download" id="downloadBtn">Télécharger ↓</button>';

  const shotsHTML = game.screenshots.map((src, i) =>
    '<button data-src="' + src + '" aria-label="Agrandir la capture ' + (i + 1) + '">' +
    '<img src="' + src + '" alt="Capture d\'écran ' + (i + 1) + ' de ' + game.name + '" loading="lazy"></button>'
  ).join("");

  root.innerHTML =
    '<a href="index.html#games" class="back-link">‹ Retour aux jeux</a>' +
    '<section class="detail-top">' +
      '<img class="detail-cover" src="' + game.cover + '" alt="Image de ' + game.name + '">' +
      '<div class="detail-head">' +
        '<span class="tag">' + game.category + '</span>' +
        '<h1>' + game.name + '</h1>' +
        '<p class="detail-genre">' + game.genre + '</p>' +
        '<div class="detail-meta">' +
          '<div><small>Plateforme</small><strong>' + game.platform + '</strong></div>' +
          '<div><small>Taille</small><strong>' + game.size + '</strong></div>' +
          '<div><small>Version</small><strong>' + game.version + '</strong></div>' +
          '<div><small>Catégorie</small><strong>' + game.category + '</strong></div>' +
        '</div>' +
        downloadHTML +
      '</div>' +
    '</section>' +
    '<section class="detail-block"><h2>Description</h2><p>' + game.description + '</p></section>' +
    '<section class="detail-block"><h2>Captures d\'écran</h2><div class="shots">' + shotsHTML + '</div></section>';

  // Le téléchargement demande d'être connecté avec Google
  document.getElementById("downloadBtn").addEventListener("click", () => {
    Auth.requireLogin(() => {
      if (game.downloadUrl) {
        window.open(game.downloadUrl, "_blank", "noopener");
      } else {
        alert("Le lien de téléchargement de " + game.name + " sera ajouté prochainement.");
      }
    });
  });

  // Agrandir les captures
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  const closeLightbox = () => lightbox.classList.remove("show");

  document.querySelectorAll(".shots button").forEach(b => {
    b.addEventListener("click", () => {
      lightboxImg.src = b.dataset.src;
      lightbox.classList.add("show");
    });
  });
  lightbox.addEventListener("click", e => { if (e.target !== lightboxImg) closeLightbox(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeLightbox(); });
}
