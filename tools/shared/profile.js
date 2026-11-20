/* Дані майстра для документів: назва/імʼя, телефон, логотип. Зберігаються локально й підставляються в кожен PDF. */
(function (root) {
  "use strict";
  let cache = null;
  const empty = () => ({ name: "", phone: "", logo: "" });
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
      try { const d = await resizeLogo(f); await save({ logo: d }); el.querySelector("#pfPrev").innerHTML = '<img src="' + d + '" alt="">'; el.querySelector("#pfDel").hidden = false; }
      catch (err) { root.SMUI && SMUI.toast("Не вдалося прочитати зображення"); }
      e.target.value = "";
    });
    el.querySelector("#pfDel").addEventListener("click", async () => { await save({ logo: "" }); el.querySelector("#pfPrev").textContent = "немає"; el.querySelector("#pfDel").hidden = true; });
  }
  root.SMProfile = { get, set, mount, headerHtml };
})(window);
