
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
const gameCards = document.querySelectorAll(".game-card");
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

// OUVRIR LA PAGE D'UN JEU
gameCards.forEach(card => {
  const open = () => { window.location.href = "game.html?id=" + card.dataset.id; };
  card.addEventListener("click", open);
  card.addEventListener("keydown", e => {
    if (e.key === "Enter") open();
  });
});

// ANNÉE AUTOMATIQUE
const footerText = document.querySelector(".footer p");

if (footerText) {
  footerText.textContent =
    "© " + new Date().getFullYear() +
    " Glory Gamers. Tous droits réservés.";
}
