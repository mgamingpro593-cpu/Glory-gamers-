
// GLORY GAMERS - JAVASCRIPT

// MENU
const menuToggle = document.getElementById("menuToggle");
const menuClose = document.getElementById("menuClose");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");

function closeMenu() {
  sideMenu.classList.remove("open");
  overlay.classList.remove("show");
}

menuToggle.addEventListener("click", () => {
  sideMenu.classList.add("open");
  overlay.classList.add("show");
});

menuClose.addEventListener("click", closeMenu);
overlay.addEventListener("click", closeMenu);

document.querySelectorAll(".side-menu a").forEach(link => {
  link.addEventListener("click", closeMenu);
});

// RECHERCHE
const searchToggle = document.getElementById("searchToggle");
const searchSection = document.getElementById("searchSection");
const searchInput = document.getElementById("searchInput");

searchToggle.addEventListener("click", () => {
  searchSection.classList.toggle("visible");

  if (searchSection.classList.contains("visible")) {
    searchInput.focus();
  } else {
    searchInput.value = "";
    filterGames();
  }
});

// FILTRAGE DES JEUX
let gameCards = [];
const categoryButtons = document.querySelectorAll(".category");
const noResults = document.getElementById("noResults");
const gameCount = document.getElementById("gameCount");

let selectedCategory = "Tous";

function filterGames() {
  const search = searchInput.value.toLowerCase();
  let visibleCount = 0;

  gameCards.forEach(card => {
    const name = card.dataset.name.toLowerCase();
    const category = card.dataset.category;

    const matchesSearch = name.includes(search);
    const matchesCategory =
      selectedCategory === "Tous" ||
      category === selectedCategory;

    const visible = matchesSearch && matchesCategory;

    card.style.display = visible ? "" : "none";

    if (visible) visibleCount++;
  });

  noResults.hidden = visibleCount !== 0;
  gameCount.textContent = visibleCount + " jeux";
}

searchInput.addEventListener("input", filterGames);

categoryButtons.forEach(button => {
  button.addEventListener("click", () => {
    categoryButtons.forEach(btn => btn.classList.remove("active"));

    button.classList.add("active");
    selectedCategory = button.dataset.category;

    filterGames();
  });
});

// CARROUSEL
const carousel = document.getElementById("carousel");
const slides = Array.from(carousel.querySelectorAll(".hero-card"));
const dotsContainer = document.getElementById("carouselDots");

let currentSlide = 0;

slides.forEach((slide, index) => {
  const dot = document.createElement("button");

  dot.setAttribute("aria-label", "Afficher le jeu " + (index + 1));

  dot.addEventListener("click", () => {
    currentSlide = index;
    showSlide();
  });

  dotsContainer.appendChild(dot);
});

const dots = dotsContainer.querySelectorAll("button");

function showSlide() {
  carousel.scrollTo({
    left: slides[currentSlide].offsetLeft - slides[0].offsetLeft,
    behavior: "smooth"
  });

  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === currentSlide);
  });
}

document.getElementById("nextSlide").addEventListener("click", () => {
  currentSlide = (currentSlide + 1) % slides.length;
  showSlide();
});

document.getElementById("previousSlide").addEventListener("click", () => {
  currentSlide = (currentSlide - 1 + slides.length) % slides.length;
  showSlide();
});

showSlide();

// AFFICHAGE DES JEUX (liste de base + jeux ajoutés depuis l'espace admin)
const gamesGrid = document.getElementById("gamesGrid");

function renderGames(games) {
  gamesGrid.innerHTML = "";

  games.forEach(game => {
    const card = document.createElement("article");
    card.className = "game-card";
    card.dataset.id = game.id;
    card.dataset.name = game.name;
    card.dataset.category = game.category;
    card.tabIndex = 0;
    card.setAttribute("role", "link");
    card.setAttribute("aria-label", "Ouvrir la page de " + game.name);

    const imageBox = document.createElement("div");
    imageBox.className = "game-image";
    const img = document.createElement("img");
    if (game.cover) img.src = game.cover;
    img.alt = game.name;
    img.loading = "lazy";
    const platform = document.createElement("span");
    platform.className = "game-platform";
    platform.textContent = String(game.platform || "").toUpperCase();
    imageBox.append(img, platform);

    const info = document.createElement("div");
    info.className = "game-info";
    const title = document.createElement("h3");
    title.textContent = game.name;
    const genre = document.createElement("p");
    genre.textContent = game.genre || game.category;
    const link = document.createElement("a");
    link.className = "download-btn";
    link.href = "game.html?id=" + encodeURIComponent(game.id);
    link.textContent = "Voir le jeu ";
    const arrow = document.createElement("span");
    arrow.textContent = "›";
    link.appendChild(arrow);
    info.append(title, genre, link);

    card.append(imageBox, info);

    const open = () => { window.location.href = link.href; };
    card.addEventListener("click", open);
    card.addEventListener("keydown", e => {
      if (e.key === "Enter") open();
    });

    gamesGrid.appendChild(card);
  });

  gameCards = Array.from(gamesGrid.querySelectorAll(".game-card"));
  filterGames();
}

renderGames(GAMES);
loadAllGames().then(renderGames);

// ANNÉE AUTOMATIQUE
const footerText = document.querySelector(".footer p");

if (footerText) {
  footerText.textContent =
    "© " + new Date().getFullYear() +
    " Glory Gamers. Tous droits réservés.";
}
