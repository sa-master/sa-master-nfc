/* Локальне сховище інструментів (IndexedDB, версія схеми 1). Без реєстрації і без сервера.
   Дані привʼязані до браузера й пристрою і можуть зникнути після очищення сховища. */
(function (root) {
  "use strict";
  const DB = "samaster_tools", VER = 1, mem = { docs: new Map(), meta: new Map() };
  let dbp = null, useMem = false;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!root.indexedDB) return rej(new Error("no idb"));
      const r = indexedDB.open(DB, VER);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains("docs")) db.createObjectStore("docs", { keyPath: "id" }).createIndex("tool", "tool");
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error("blocked"));
    });
    return dbp;
  }
  function idb(store, mode, make) {
    return open().then(db => new Promise((res, rej) => {
      const t = db.transaction(store, mode), rq = make(t.objectStore(store));
      t.oncomplete = () => res(rq && rq.result);
      t.onerror = t.onabort = () => rej(t.error);
    }));
  }
  async function run(store, mode, make, fallback) {
    if (!useMem) { try { return await idb(store, mode, make); } catch (e) { useMem = true; } }
    return fallback();
  }
  const uid = () => "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const api = {
    isMemory: () => useMem,
    uid,
    persist() { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {} },
    async list(tool) {
      const a = await run("docs", "readonly", s => s.index("tool").getAll(tool), () => [...mem.docs.values()].filter(d => d.tool === tool));
      return (a || []).sort((x, y) => y.updated - x.updated);
    },
    get(id) { return run("docs", "readonly", s => s.get(id), () => mem.docs.get(id)); },
    async put(doc) {
      doc.v = 1; doc.updated = Date.now();
      await run("docs", "readwrite", s => s.put(doc), () => { mem.docs.set(doc.id, doc); });
      return doc;
    },
    del(id) { return run("docs", "readwrite", s => s.delete(id), () => { mem.docs.delete(id); }); },
    async getMeta(key) { const r = await run("meta", "readonly", s => s.get(key), () => mem.meta.get(key)); return r ? r.value : null; },
    setMeta(key, value) { return run("meta", "readwrite", s => s.put({ key, value }), () => { mem.meta.set(key, { key, value }); }); }
  };
  root.SMStore = api;
})(window);
