/* Дані майстра для документів: назва/імʼя, телефон, логотип. Зберігаються локально й підставляються в кожен PDF. */
(function (root) {
  "use strict";
  let cache = null;
  const empty = () => ({ name: "", phone: "", logo: "", auto: false });
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  async function get() {
    if (!cache) {
      cache = Object.assign(empty(), (await SMStore.getMeta("profile")) || {});
      /* один раз перевіряємо вже збережений логотип */
      if (cache.logo && !cache.auto) {
        try { cache.logo = await autoLogo(cache.logo); cache.auto = true; await SMStore.setMeta("profile", cache); } catch (e) {}
      }
    }
    return cache;
  }
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
  /* Якщо це круглий логотип на однотонному фоні (кути однакові й відрізняються від країв кола) — обрізає по колу */
  function autoLogo(dataUrl) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.width, h = img.height, c = document.createElement("canvas"); c.width = w; c.height = h;
          const x = c.getContext("2d"); x.drawImage(img, 0, 0);
          const px = (X, Y) => x.getImageData(Math.max(0, Math.min(w - 1, Math.round(X))), Math.max(0, Math.min(h - 1, Math.round(Y))), 1, 1).data;
          const dist = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
          const cs = [px(1, 1), px(w - 2, 1), px(1, h - 2), px(w - 2, h - 2)];
          if (cs.some(p => p[3] < 250)) return res(dataUrl);
          if (cs.some(p => dist(p, cs[0]) > 40)) return res(dataUrl);
          const d = Math.min(w, h), cx = w / 2, cy = h / 2, k = Math.SQRT1_2, dirs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
          const at = (t, dr) => px(cx + dr[0] * t * d * k, cy + dr[1] * t * d * k);
          /* поза колом по діагоналях — лише фон (круг нічого не відріже) */
          if (dirs.some(dr => [0.53, 0.58, 0.64, 0.70].some(t => dist(at(t, dr), cs[0]) > 40))) return res(dataUrl);
          /* а всередині малюнок доходить до краю кола (це справді круглий логотип) */
          if (dirs.filter(dr => [0.34, 0.38, 0.42, 0.46].some(t => dist(at(t, dr), cs[0]) > 60)).length < 3) return res(dataUrl);
          circleCrop(dataUrl).then(res, () => res(dataUrl));
        } catch (e) { res(dataUrl); }
      };
      img.onerror = () => res(dataUrl);
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
      '</div><label class="btnGhost pfBtn" for="pfFile">Вибрати файл</label><input type="file" id="pfFile" accept="image/*" hidden><button type="button" class="btnGhost pfBtn" id="pfDel"' + (p.logo ? "" : " hidden") + '>Прибрати</button></div></div>' +
      '<p class="hint">Зберігається лише в цьому браузері й підставляється в шапку кожного PDF.</p>';
    const save = async patch => { const n = await set(Object.assign({}, cache, patch)); if (onChange) onChange(n); };
    el.querySelector("#pfName").addEventListener("input", e => save({ name: e.target.value }));
    el.querySelector("#pfPhone").addEventListener("input", e => save({ phone: e.target.value }));
    el.querySelector("#pfFile").addEventListener("change", async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try {
        const d = await autoLogo(await resizeLogo(f));
        await save({ logo: d });
        el.querySelector("#pfPrev").innerHTML = '<img src="' + d + '" alt="">'; el.querySelector("#pfDel").hidden = false;
      }
      catch (err) { root.SMUI && SMUI.toast("Не вдалося прочитати зображення"); }
      e.target.value = "";
    });
    el.querySelector("#pfDel").addEventListener("click", async () => { await save({ logo: "" }); el.querySelector("#pfPrev").textContent = "немає"; el.querySelector("#pfDel").hidden = true; });
  }
  root.SMProfile = { get, set, mount, headerHtml };
})(window);
