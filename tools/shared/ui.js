/* Спільні дрібниці інтерфейсу + список збережених документів з автозбереженням. */
(function (root) {
  "use strict";
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let tT = null;
  function toast(m, ms) { const el = document.getElementById("toast"); if (!el) return; el.textContent = m; el.classList.add("on"); clearTimeout(tT); tT = setTimeout(() => el.classList.remove("on"), ms || 2200); }
  const num = v => { const n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const f1 = n => (Math.round(n * 10) / 10).toString().replace(".", ",");
  const f2 = n => (Math.round(n * 100) / 100).toString().replace(".", ",");
  const dateLabel = ts => { const d = new Date(ts); const p = n => String(n).padStart(2, "0"); return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear() + " " + p(d.getHours()) + ":" + p(d.getMinutes()); };

  /* Менеджер документів інструмента.
     cfg: { tool, titlePrefix, el (контейнер списку), titleInput (input назви), serialize(), load(data), reset(), isEmpty() } */
  function docs(cfg) {
    let id = null, title = "", timer = null, listCache = [];
    const defTitle = () => cfg.titlePrefix + " " + dateLabel(Date.now());
    async function refresh() {
      listCache = await SMStore.list(cfg.tool);
      cfg.el.innerHTML = listCache.length ? listCache.map(d => '<div class="dlRow' + (d.id === id ? " cur" : "") + '" data-id="' + d.id + '"><button type="button" class="dlMain" data-act="open"><b>' + esc(d.title) + "</b><span>" + dateLabel(d.updated) + (d.sub ? " · " + esc(d.sub) : "") + '</span></button><button type="button" class="dlBtn" data-act="ren" aria-label="Перейменувати">✎</button><button type="button" class="dlBtn dlDel" data-act="del" aria-label="Видалити">🗑</button></div>').join("") : '<p class="hint" style="margin:0">Поки порожньо. Акти зберігаються самі.</p>';
      const cnt = document.getElementById(cfg.countId || ""); if (cnt) cnt.textContent = listCache.length ? "(" + listCache.length + ")" : "";
    }
    async function saveNow() {
      if (cfg.isEmpty && cfg.isEmpty() && !id) return;
      if (!id) { id = SMStore.uid(); title = cfg.titleInput.value.trim() || defTitle(); cfg.titleInput.value = title; }
      title = cfg.titleInput.value.trim() || title || defTitle();
      await SMStore.put({ id, tool: cfg.tool, title, sub: cfg.sub ? cfg.sub() : "", data: cfg.serialize() });
      refresh();
    }
    function touch() { clearTimeout(timer); timer = setTimeout(saveNow, 500); }
    async function open(did) {
      await saveNow();
      const d = await SMStore.get(did); if (!d) return;
      id = d.id; title = d.title; cfg.titleInput.value = d.title; cfg.load(d.data); refresh();
      toast("Відкрито: " + d.title);
    }
    async function fresh() { await saveNow(); id = null; title = ""; cfg.reset(); cfg.titleInput.value = ""; cfg.titleInput.placeholder = defTitle(); refresh(); }
    cfg.el.addEventListener("click", async e => {
      const row = e.target.closest(".dlRow"); if (!row) return; const act = e.target.closest("[data-act]"); if (!act) return;
      const did = row.dataset.id;
      if (act.dataset.act === "open") open(did);
      if (act.dataset.act === "ren") { const d = listCache.find(x => x.id === did); const n = prompt("Нова назва", d ? d.title : ""); if (n && n.trim()) { const full = await SMStore.get(did); full.title = n.trim(); await SMStore.put(full); if (did === id) { title = full.title; cfg.titleInput.value = title; } refresh(); } }
      if (act.dataset.act === "del") { const d = listCache.find(x => x.id === did); if (confirm("Видалити «" + (d ? d.title : "") + "»? Це не можна скасувати.")) { await SMStore.del(did); if (did === id) { id = null; cfg.reset(); cfg.titleInput.value = ""; } refresh(); } }
    });
    cfg.titleInput.addEventListener("input", touch);
    cfg.titleInput.placeholder = defTitle();
    SMStore.persist(); refresh();
    return { touch, fresh, refresh, saveNow, currentTitle: () => cfg.titleInput.value.trim() || title || defTitle() };
  }
  root.SMUI = { esc, toast, num, f1, f2, dateLabel, docs };
})(window);
