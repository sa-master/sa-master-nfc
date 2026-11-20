/* Дані майстра для документів: назва/імʼя, телефон, логотип. Зберігаються локально й підставляються в кожен PDF. */
(function (root) {
  "use strict";
  let cache = null;
  const empty = () => ({ name: "", phone: "", logo: "", logoRaw: "", round: false });
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  async function get() { if (!cache) cache = Object.assign(empty(), (await SMStore.getMeta("profile")) || {}); return cache; }
  async function set(p) { cache = Object.assign(empty(), p); await SMStore.setMeta("profile", cache); return cache; }
  function resizeLogo(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, 320 / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
        res(c.toDataURL("image/png"));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("img")); };
      img.src = url;
    });
  }
  /* Обрізає зображення по колу: кути стають прозорими */
  function circleCrop(dataUrl) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const d = Math.min(img.width, img.height), c = document.createElement("canvas"); c.width = c.height = d;
        const x = c.getContext("2d");
        x.beginPath(); x.arc(d / 2, d / 2, d / 2, 0, Math.PI * 2); x.closePath(); x.clip();
        x.drawImage(img, (img.width - d) / 2, (img.height - d) / 2, d, d, 0, 0, d, d);
        res(c.toDataURL("image/png"));
      };
      img.onerror = () => rej(new Error("img"));
      img.src = dataUrl;
    });
  }
  /* Блок для шапки документа */
  function headerHtml(p) {
    if (!p || (!p.name && !p.phone && !p.logo)) return "";
    return '<div class="docHead">' + (p.logo ? '<img src="' + p.logo + '" alt="">' : "") +
      '<div class="docHeadT">' + (p.name ? "<b>" + esc(p.name) + "</b>" : "") + (p.phone ? "<span>" + esc(p.phone) + "</span>" : "") + "</div></div>";
  }
  /* Форма редагування; onChange викликається після збереження */
  async function mount(el, onChange) {
    const p = await get();
    el.innerHTML =
      '<div class="formGroup"><label class="formLabel" for="pfName">Імʼя або назва компанії</label><input class="formInput" id="pfName" autocomplete="organization" value="' + esc(p.name) + '"></div>' +
      '<div class="formGroup"><label class="formLabel" for="pfPhone">Телефон</label><input class="formInput" id="pfPhone" type="tel" autocomplete="tel" value="' + esc(p.phone) + '"></div>' +
      '<div class="formGroup"><label class="formLabel">Логотип</label><div class="pfLogo"><div class="pfPrev" id="pfPrev">' + (p.logo ? '<img src="' + p.logo + '" alt="">' : "немає") +
      '</div><label class="btnGhost pfBtn" for="pfFile">Вибрати файл</label><input type="file" id="pfFile" accept="image/*" hidden><button type="button" class="btnGhost pfBtn" id="pfDel"' + (p.logo ? "" : " hidden") + '>Прибрати</button></div>' +
      '<label class="pfRound" id="pfRoundWrap"' + (p.logo ? "" : " hidden") + '><input type="checkbox" id="pfRound"' + (p.round ? " checked" : "") + '> Круглий логотип (прибрати фон у кутах)</label></div>' +
      '<p class="hint">Зберігається лише в цьому браузері й підставляється в шапку кожного PDF.</p>';
    const save = async patch => { const n = await set(Object.assign({}, cache, patch)); if (onChange) onChange(n); };
    el.querySelector("#pfName").addEventListener("input", e => save({ name: e.target.value }));
    el.querySelector("#pfPhone").addEventListener("input", e => save({ phone: e.target.value }));
    el.querySelector("#pfFile").addEventListener("change", async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try {
        const raw = await resizeLogo(f), rd = el.querySelector("#pfRound").checked, d = rd ? await circleCrop(raw) : raw;
        await save({ logoRaw: raw, logo: d, round: rd });
        el.querySelector("#pfPrev").innerHTML = '<img src="' + d + '" alt="">'; el.querySelector("#pfDel").hidden = false; el.querySelector("#pfRoundWrap").hidden = false;
      }
      catch (err) { root.SMUI && SMUI.toast("Не вдалося прочитати зображення"); }
      e.target.value = "";
    });
    el.querySelector("#pfRound").addEventListener("change", async e => {
      const raw = cache.logoRaw || cache.logo; if (!raw) return;
      try { const d = e.target.checked ? await circleCrop(raw) : raw; await save({ logoRaw: raw, logo: d, round: e.target.checked }); el.querySelector("#pfPrev").innerHTML = '<img src="' + d + '" alt="">'; }
      catch (err) { e.target.checked = !e.target.checked; root.SMUI && SMUI.toast("Не вдалося обробити логотип"); }
    });
    el.querySelector("#pfDel").addEventListener("click", async () => { await save({ logo: "", logoRaw: "", round: false }); el.querySelector("#pfPrev").textContent = "немає"; el.querySelector("#pfDel").hidden = true; el.querySelector("#pfRoundWrap").hidden = true; el.querySelector("#pfRound").checked = false; });
  }
  root.SMProfile = { get, set, mount, headerHtml };
})(window);
