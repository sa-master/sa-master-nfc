/* Модель даних (схема v1). JSON, мм, унікальні id. Стан перегляду (масштаб тощо) у модель не входить. */
(function (root, f) { var m = f(); if (typeof module === "object" && module.exports) module.exports = m; else { root.HID = root.HID || {}; for (var k in m) root.HID[k] = m[k]; } })(this, function () {
  var M = {};
  M.SCHEMA = 1;
  M.uid = function () {
    try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    var s = ""; for (var i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16); return s;
  };
  M.newSurface = function (o) {
    o = o || {};
    return { id: M.uid(), kind: o.kind || "wall", name: o.name || "Стіна", width: o.width || 3000, height: o.height || 2600, bases: { x: "left", y: "bottom" }, finished: false };
  };
  M.newReport = function (o) {
    var s = M.newSurface(o);
    return { schema: M.SCHEMA, id: M.uid(), createdAt: new Date().toISOString(), surfaces: [s], elements: [], links: [], dimOverrides: {}, settings: { detail: "optimal", angle: "ortho", grid: 10 } };
  };
  M.newElement = function (surfaceId, type, systemId, pts) { return { id: M.uid(), surfaceId: surfaceId, type: type, systemId: systemId, pts: pts, props: {} }; };
  /* перемістити координату вузла (вісь 0=x, 1=y); сусідні вузли на тій самій лінії рухаються разом, щоб не ламати прямі кути */
  M.moveCoord = function (el, i, axis, val) {
    var old = el.pts[i][axis];
    [i - 1, i, i + 1].forEach(function (j) { if (j >= 0 && j < el.pts.length && Math.abs(el.pts[j][axis] - old) < 0.5) el.pts[j][axis] = val; });
  };
  /* історія: знімки JSON */
  M.History = function (limit) { this.u = []; this.r = []; this.l = limit || 200; };
  M.History.prototype.push = function (s) { this.u.push(s); this.r = []; if (this.u.length > this.l) this.u.shift(); };
  M.History.prototype.undo = function (cur) { if (!this.u.length) return null; this.r.push(cur); return this.u.pop(); };
  M.History.prototype.redo = function (cur) { if (!this.r.length) return null; this.u.push(cur); return this.r.pop(); };
  M.History.prototype.canUndo = function () { return this.u.length > 0; };
  M.History.prototype.canRedo = function () { return this.r.length > 0; };
  /* перевірка: критичні помилки блокують формування звіту, попередження — ні */
  M.validate = function (R) {
    var err = [], warn = [];
    if (!R.elements.length) err.push("Немає жодної задокументованої комунікації");
    R.surfaces.forEach(function (s) { if (!(s.width > 0 && s.height > 0)) err.push("Некоректні розміри поверхні «" + s.name + "»"); if (!s.finished) warn.push("Розміри на «" + s.name + "» не підтверджено як від чистових поверхонь"); });
    R.elements.forEach(function (e) {
      var s = R.surfaces.filter(function (x) { return x.id === e.surfaceId; })[0];
      if (!s) { err.push("Елемент без поверхні"); return; }
      if (e.type === "route" && e.pts.length < 2) err.push("Траса має менше двох точок");
      if (e.type === "zone" && e.pts.length < 3) err.push("Зона має менше трьох точок");
      if (e.pts.some(function (p) { return p[0] < 0 || p[1] < 0 || p[0] > s.width || p[1] > s.height; })) warn.push("Елемент виходить за межі поверхні «" + s.name + "»");
    });
    return { errors: err, warnings: warn };
  };
  return M;
});
