/* Геометрія: чисті функції, без DOM. Одиниці: міліметри. Система координат поверхні: початок у лівому нижньому куті, y вгору. */
(function (root, f) { var m = f(); if (typeof module === "object" && module.exports) module.exports = m; else { root.HID = root.HID || {}; for (var k in m) root.HID[k] = m[k]; } })(this, function () {
  var G = {};
  G.dist = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  G.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  G.snap = function (v, step) { return step > 1 ? Math.round(v / step) * step : Math.round(v); };
  G.polyLen = function (pts) { var s = 0; for (var i = 1; i < pts.length; i++) s += G.dist(pts[i - 1], pts[i]); return s; };
  G.bbox = function (pts) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  };
  G.distToSeg = function (p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    var t = l2 ? G.clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1) : 0;
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  G.inPoly = function (p, pts) {
    var c = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var a = pts[i], b = pts[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  };
  /* прив'язка до сусідньої лінії або до сітки */
  function alignOrGrid(v, cands, tol, step) {
    var best = null, bd = tol + 1e-9;
    (cands || []).forEach(function (c) { var d = Math.abs(c - v); if (d <= bd) { bd = d; best = c; } });
    return best === null ? G.snap(v, step) : best;
  }
  /* o: {mode:'ortho'|'45'|'free', step, w, h, xs:[], ys:[], tol} — повертає цілі мм */
  G.place = function (prev, raw, o) {
    var p, dx, dy;
    if (!prev || o.mode === "free") {
      p = [alignOrGrid(raw[0], o.xs, o.tol, o.step), alignOrGrid(raw[1], o.ys, o.tol, o.step)];
    } else if (o.mode === "ortho") {
      dx = raw[0] - prev[0]; dy = raw[1] - prev[1];
      p = Math.abs(dx) >= Math.abs(dy) ? [alignOrGrid(raw[0], o.xs, o.tol, o.step), prev[1]] : [prev[0], alignOrGrid(raw[1], o.ys, o.tol, o.step)];
    } else {
      dx = raw[0] - prev[0]; dy = raw[1] - prev[1];
      var st = Math.PI / 4, a = Math.round(Math.atan2(dy, dx) / st) * st, c = Math.cos(a), s = Math.sin(a);
      var L = G.snap(dx * c + dy * s, o.step);
      p = [prev[0] + L * c, prev[1] + L * s];
    }
    return [G.clamp(Math.round(p[0]), 0, o.w), G.clamp(Math.round(p[1]), 0, o.h)];
  };
  return G;
});
