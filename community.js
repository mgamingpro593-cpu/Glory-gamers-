// COMMUNAUTÉ : icône Discussion dans l'en-tête, pastille de nouveaux messages, notification
(function () {
  const READ = "gg_chat_read";         // dernier message lu
  const NOTIFIED = "gg_chat_notified"; // dernier message déjà signalé
  const has = k => { try { return localStorage.getItem(k) !== null; } catch (e) { return false; } };
  const num = k => { try { return Number(localStorage.getItem(k)) || 0; } catch (e) { return 0; } };
  const save = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };
  const onChatPage = /discussion\.html$/.test(location.pathname);

  const link = document.createElement("a");
  link.className = "icon-btn chat-top";
  link.href = "discussion.html";
  link.setAttribute("aria-label", "Discussion");
  link.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg><span class="chat-count" hidden></span>';
  const count = link.querySelector(".chat-count");

  function mount() {
    const area = document.getElementById("authArea");
    if (area && !link.isConnected) area.before(link);
  }
  window.addEventListener("load", mount);
  if (document.readyState === "complete") mount();

  // Notification du système (téléphone / ordinateur) si l'utilisateur l'a autorisée
  window.GGNotify = async function (body) {
    try {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const opts = { body, icon: "icon-192.png", badge: "icon-192.png", tag: "glory-chat", data: { url: "discussion.html" } };
      const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) reg.showNotification("💬 Glory Gamers", opts);
      else new Notification("💬 Glory Gamers", opts);
    } catch (e) {}
  };

  function toast() {
    const old = document.querySelector(".toast-chat");
    if (old) old.remove();
    const t = document.createElement("div");
    t.className = "toast-chat";
    const span = document.createElement("span");
    span.textContent = "💬 Nouveau message dans la discussion";
    const a = document.createElement("a");
    a.href = "discussion.html";
    a.textContent = "Ouvrir";
    t.append(span, a);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 7000);
  }

  window.addEventListener("chat-seq", e => {
    const seq = Number(e.detail) || 0;
    if (onChatPage) return; // la page Discussion gère elle-même ses messages
    if (!has(READ)) { save(READ, seq); save(NOTIFIED, seq); return; } // première visite : rien d'« ancien » à signaler
    const unread = seq - num(READ);
    count.hidden = unread <= 0;
    count.textContent = unread > 9 ? "9+" : String(unread);
    if (unread > 0 && seq > num(NOTIFIED)) {
      save(NOTIFIED, seq);
      toast();
      window.GGNotify(unread > 1 ? unread + " nouveaux messages dans la discussion" : "Nouveau message dans la discussion");
    }
  });
})();
