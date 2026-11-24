// GAME LABS : calcul de compatibilité (estimation)
// evaluate(jeu, téléphone, tr) → { level: "ok" | "limit" | "no" | "na" | "unknown", reasons: [...] }
(function () {
  const isNum = v => typeof v === "number" && isFinite(v);

  function evaluate(game, dev, tr) {
    const en = tr("fr", "en") === "en";
    const g = n => (en ? String(n) : String(n).replace(".", ","));
    const unit = en ? "GB" : "Go";

    const plat = String(game.platform || "").toLowerCase();
    const forAndroid = plat.includes("android");
    const forIos = plat.includes("ios") || plat.includes("iphone");
    const forPc = plat.includes("pc") && !forAndroid && !forIos;

    // Mauvaise plateforme
    if (forPc && dev.system !== "PC") {
      return { level: "na", reasons: [tr("Ce jeu est prévu pour PC, pas pour un téléphone.", "This game is made for PC, not for a phone.")] };
    }
    if (forAndroid && !forIos && dev.system === "iOS") {
      return { level: "na", reasons: [tr("Ce jeu est prévu pour Android, pas pour iPhone.", "This game is made for Android, not for iPhone.")] };
    }
    if (forAndroid && !forIos && dev.system === "PC") {
      return { level: "na", reasons: [tr("Ce jeu est prévu pour un téléphone Android.", "This game is made for an Android phone.")] };
    }
    if (forIos && !forAndroid && dev.system !== "iOS") {
      return { level: "na", reasons: [tr("Ce jeu est prévu pour iPhone.", "This game is made for iPhone.")] };
    }

    const reasons = [];
    const missing = [];
    let level = "ok";
    let hasRequirements = false;
    const order = { ok: 0, limit: 1, no: 2 };
    const worsen = l => { if (order[l] > order[level]) level = l; };

    // Version d'Android
    if (dev.system === "Android" && isNum(game.minAndroid)) {
      hasRequirements = true;
      if (!isNum(dev.androidVersion)) {
        missing.push(tr("Indique ta version d'Android.", "Enter your Android version."));
      } else if (dev.androidVersion < game.minAndroid) {
        worsen("no");
        reasons.push(tr(
          "Android " + game.minAndroid + " ou plus requis (ton téléphone : Android " + dev.androidVersion + ").",
          "Android " + game.minAndroid + " or newer required (your phone: Android " + dev.androidVersion + ")."
        ));
      }
    }

    // RAM
    if (isNum(game.minRam) || isNum(game.recRam)) {
      hasRequirements = true;
      if (!isNum(dev.ram)) {
        missing.push(tr("Indique la RAM de ton téléphone.", "Enter your phone's RAM."));
      } else if (isNum(game.minRam) && dev.ram < game.minRam) {
        worsen("no");
        reasons.push(tr(
          "RAM insuffisante : " + g(game.minRam) + " " + unit + " minimum (ton téléphone : " + g(dev.ram) + " " + unit + ").",
          "Not enough RAM: " + g(game.minRam) + " " + unit + " minimum (your phone: " + g(dev.ram) + " " + unit + ")."
        ));
      } else if (isNum(game.recRam) && dev.ram < game.recRam) {
        worsen("limit");
        reasons.push(tr(
          "Peu de RAM : " + g(game.recRam) + " " + unit + " recommandés, tu en as " + g(dev.ram) + ". Baisse les réglages graphiques.",
          "Low RAM: " + g(game.recRam) + " " + unit + " recommended, you have " + g(dev.ram) + ". Lower the graphics settings."
        ));
      }
    }

    // Espace de stockage
    if (isNum(game.minStorage)) {
      hasRequirements = true;
      if (!isNum(dev.storage)) {
        missing.push(tr("Indique ton espace libre pour vérifier le stockage.", "Enter your free storage to check space."));
      } else if (dev.storage < game.minStorage) {
        worsen("no");
        reasons.push(tr(
          "Pas assez d'espace : " + g(game.minStorage) + " " + unit + " requis, " + g(dev.storage) + " " + unit + " libres.",
          "Not enough space: " + g(game.minStorage) + " " + unit + " required, " + g(dev.storage) + " " + unit + " free."
        ));
      }
    }

    if (!hasRequirements) {
      return { level: "unknown", reasons: [tr("La configuration requise de ce jeu n'est pas encore renseignée.", "This game's requirements haven't been added yet.")] };
    }

    if (level === "ok") {
      if (missing.length) return { level: "unknown", reasons: missing };
      reasons.push(tr("Ton téléphone répond à la configuration demandée.", "Your phone meets the required specs."));
    }
    return { level, reasons: reasons.concat(level === "ok" ? [] : missing) };
  }

  // Texte « Requis : ... »
  function requirements(game, tr) {
    const en = tr("fr", "en") === "en";
    const g = n => (en ? String(n) : String(n).replace(".", ","));
    const unit = en ? "GB" : "Go";
    const parts = [];
    if (isNum(game.minAndroid)) parts.push("Android " + game.minAndroid + "+");
    if (isNum(game.minRam)) parts.push(g(game.minRam) + " " + unit + " RAM" + (isNum(game.recRam) ? " (" + tr("recommandé", "recommended") + " " + g(game.recRam) + ")" : ""));
    else if (isNum(game.recRam)) parts.push(g(game.recRam) + " " + unit + " RAM " + tr("recommandés", "recommended"));
    if (isNum(game.minStorage)) parts.push(g(game.minStorage) + " " + unit + " " + tr("d'espace", "of space"));
    return parts.join(" · ");
  }

  const api = { evaluate, requirements };
  if (typeof window !== "undefined") window.Compat = api;
  if (typeof module !== "undefined") module.exports = api;
})();
