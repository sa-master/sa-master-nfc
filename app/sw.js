/* et.app — service worker: сповіщення і відкриття без інтернету.
   Сам застосунок (/app/) — спершу з мережі (щоб оновлення приходили одразу), без зв'язку — збережена копія.
   Бібліотеки PDF/Excel і шрифти — із збереженої копії (версії зафіксовані). Решту запитів (хмара, сервер) не чіпаємо. */
const SHELL = "et-shell-v1";
const LIBS = "et-libs-v1";
const SHELL_URLS = ["/app/", "/app/manifest.webmanifest", "/app/icon-192.png", "/app/icon-512.png"];
const LIB_HOSTS = ["cdn.sheetjs.com", "cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];
const NET_WAIT = 4000;   /* слабкий зв'язок у підвалі: довше 4 с не чекаємо — відкриваємо збережене */

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL).then(c => Promise.all(SHELL_URLS.map(u => fetch(u, { cache:"no-store" }).then(r => r.ok ? c.put(u, r) : null).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => event.waitUntil((async () => {
  for(const k of await caches.keys()) if(![SHELL, LIBS].includes(k)) await caches.delete(k);
  await self.clients.claim();
})()));

function shellKey(url){
  if(url.pathname === "/app/" || url.pathname === "/app/index.html") return "/app/";
  return SHELL_URLS.includes(url.pathname) ? url.pathname : null;
}
/* Safari не приймає для сторінки відповідь «після переадресації» — віддаємо її як звичайну */
async function clean(r){
  if(!r || !r.redirected) return r;
  return new Response(await r.blob(), { status:r.status, statusText:r.statusText, headers:r.headers });
}
async function fromNetworkFirst(request, key){
  const cache = await caches.open(SHELL);
  const net = fetch(request.url, { cache:"no-store", credentials:"same-origin" }).then(clean).then(r => { if(r && r.ok) cache.put(key, r.clone()).catch(() => {}); return r; });
  const saved = await cache.match(key);
  if(!saved) return net;                                  /* ще нічого не збережено — лише мережа */
  const timer = new Promise(res => setTimeout(() => res(null), NET_WAIT));
  try{
    const r = await Promise.race([net, timer]);
    if(r && r.ok) return r;
  }catch(e){}
  net.catch(() => {});
  return saved;
}
async function fromCacheFirst(request){
  const cache = await caches.open(LIBS);
  const saved = await cache.match(request);
  if(saved) return saved;
  const r = await fetch(request);
  if(r && (r.ok || r.type === "opaque")) cache.put(request, r.clone()).catch(() => {});
  return r;
}
self.addEventListener("fetch", event => {
  const req = event.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin === self.location.origin){
    const key = req.mode === "navigate" && url.pathname.startsWith("/app/") ? "/app/" : shellKey(url);
    if(key) event.respondWith(fromNetworkFirst(req, key));
    return;
  }
  if(LIB_HOSTS.includes(url.hostname)) event.respondWith(fromCacheFirst(req));
});

self.addEventListener("push", event => {
  let data = {};
  try{ data = event.data ? event.data.json() : {}; }catch(e){ data = { notification: { title: "et.app", body: event.data ? event.data.text() : "" } }; }
  const n = data.notification || data;
  const title = n.title || "et.app";
  const url = n.navigate || "/app/";
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
  const url = new URL((event.notification.data && event.notification.data.url) || "/app/", self.location.origin).href;
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for(const c of list){
      if(c.url.startsWith(self.location.origin + "/app/")){
        try{ await c.focus(); c.postMessage({ etPush:"open", url }); }catch(e){}   /* відкрите вікно не перезавантажуємо */
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
