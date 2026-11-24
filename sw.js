// Service worker : affiche les notifications sur téléphone et ouvre la bonne page au clic
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "index.html";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ("focus" in client && "navigate" in client) {
          return client.focus().then(c => c.navigate(url));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
