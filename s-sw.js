/* et.app, сторінка постачальника (s.html) — service worker лише для сповіщень.
   Нічого не кешує і не перехоплює запити: сторінка працює так само, як без нього. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  let data = {};
  try{ data = event.data ? event.data.json() : {}; }catch(e){ data = { notification: { title: "et.app", body: event.data ? event.data.text() : "" } }; }
  const n = data.notification || data;
  const title = n.title || "et.app";
  const url = n.navigate || "/s.html";
  const badge = Number(data.app_badge !== undefined ? data.app_badge : n.app_badge);   /* app_badge — на верхньому рівні */
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body: n.body || "",
      tag: n.tag || undefined,
      lang: "uk",
      icon: "/app/icon-192.png",
      data: { url }
    }),
    Number.isFinite(badge) && self.navigator && self.navigator.setAppBadge
      ? (badge > 0 ? self.navigator.setAppBadge(badge) : self.navigator.clearAppBadge()).catch(() => {})
      : Promise.resolve()
  ]));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/s.html", self.location.origin).href;
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for(const c of list){
      if(c.url.startsWith(self.location.origin + "/s.html")){
        try{ await c.focus(); c.postMessage({ etPush:"open", url }); }catch(e){}   /* відкрите вікно не перезавантажуємо */
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
