/* Автоматичні розмірні прив'язки. База відліку — стабільний орієнтир поверхні (за замовчуванням лівий край і низ),
   її можна змінити для поверхні, елемента чи окремого розміру. Ручні правки лежать у R.dimOverrides за ключем
   elementId:n<вузол>:<вісь> і застосовуються поверх автоформування, тому не зникають після його повторного запуску. */
(function (root, f) { var m = f(); if (typeof module === "object" && module.exports) module.exports = m; else { root.HID = root.HID || {}; for (var k in m) root.HID[k] = m[k]; } })(this, function () {
  var D = {};
  D.edge = function (S, axis, base) { return axis === 0 ? (base === "right" ? S.width : 0) : (base === "top" ? S.height : 0); };
  D.key = function (e, i, axis) { return e.id + ":n" + i + ":" + (axis === 0 ? "x" : "y"); };
  function wanted(e, detail) {
    var w = [], n = e.pts.length, i;
    function add(k, a) { w.push([k, a]); }
    if (detail === "none") return w;
    if (e.type === "point") { add(0, 0); add(0, 1); return w; }
    if (e.type === "zone") {
      var xi0 = 0, xi1 = 0, yi0 = 0, yi1 = 0;
      e.pts.forEach(function (p, k) { if (p[0] < e.pts[xi0][0]) xi0 = k; if (p[0] > e.pts[xi1][0]) xi1 = k; if (p[1] < e.pts[yi0][1]) yi0 = k; if (p[1] > e.pts[yi1][1]) yi1 = k; });
      if (detail === "full") { for (i = 0; i < n; i++) { add(i, 0); add(i, 1); } }
      else if (detail === "minimal") { add(xi0, 0); add(yi0, 1); }
      else { add(xi0, 0); add(xi1, 0); add(yi0, 1); add(yi1, 1); }
      return w;
    }
    if (detail === "full") { for (i = 0; i < n; i++) { add(i, 0); add(i, 1); } return w; }
    if (detail === "minimal") { add(0, 0); add(0, 1); add(n - 1, 0); add(n - 1, 1); return w; }
    for (i = 0; i < n - 1; i++) {
      var a = e.pts[i], b = e.pts[i + 1];
      if (a[1] === b[1]) add(i, 1); else if (a[0] === b[0]) add(i, 0); else { add(i, 0); add(i, 1); add(i + 1, 0); add(i + 1, 1); }
    }
    if (n >= 2) {
      var s0 = e.pts[0], s1 = e.pts[1], t0 = e.pts[n - 2], t1 = e.pts[n - 1];
      if (s0[1] === s1[1]) add(0, 0); else if (s0[0] === s1[0]) add(0, 1);
      if (t0[1] === t1[1]) add(n - 1, 0); else if (t0[0] === t1[0]) add(n - 1, 1);
    }
    return w;
  }
  /* повертає масив розмірів (включно з прихованими, hidden:true) */
  D.auto = function (R, sid, detail) {
    var S = R.surfaces.filter(function (s) { return s.id === sid; })[0], ov = R.dimOverrides || {}, out = [];
    if (!S) return out;
    R.elements.forEach(function (e) {
      if (e.surfaceId !== sid) return;
      var seen = {};
      wanted(e, detail).forEach(function (q) {
        var i = q[0], axis = q[1], p = e.pts[i], k = D.key(e, i, axis), o = ov[k] || {};
        var base = o.base || (e.props && e.props.base && e.props.base[axis === 0 ? "x" : "y"]) || S.bases[axis === 0 ? "x" : "y"];
        var edge = D.edge(S, axis, base), val = Math.abs(p[axis] - edge);
        if (val < 0.5) return;
        var dk = axis + ":" + p[axis] + ":" + base; if (seen[dk]) return; seen[dk] = 1;
        out.push({ key: k, elementId: e.id, node: i, axis: axis, base: base, value: val, hidden: !!o.hidden,
          from: axis === 0 ? [edge, p[1]] : [p[0], edge], to: [p[0], p[1]] });
      });
    });
    return out;
  };
  /* змінити значення розміру: рухає елемент (для траси — разом із сусідніми вузлами тієї ж лінії) */
  D.setValue = function (R, d, v) {
    var e = R.elements.filter(function (x) { return x.id === d.elementId; })[0], S = R.surfaces.filter(function (s) { return s.id === e.surfaceId; })[0];
    var size = d.axis === 0 ? S.width : S.height, lowBase = d.base === "left" || d.base === "bottom";
    var c = Math.round(lowBase ? v : size - v); c = Math.max(0, Math.min(size, c));
    if (e.type === "route") root_moveCoord(e, d.node, d.axis, c); else { var dlt = c - e.pts[d.node][d.axis]; e.pts.forEach(function (p) { p[d.axis] += dlt; }); }
  };
  var root_moveCoord = function (el, i, axis, val) {
    var old = el.pts[i][axis];
    [i - 1, i, i + 1].forEach(function (j) { if (j >= 0 && j < el.pts.length && Math.abs(el.pts[j][axis] - old) < 0.5) el.pts[j][axis] = val; });
  };
  function hit(a, b) { return !(a[2] + 2 < b[0] || b[2] + 2 < a[0] || a[3] + 2 < b[1] || b[3] + 2 < a[1]); }
  /* розкладка підписів у пікселях екрана: k — пікселів на мм; жадібно підбираємо зсув, щоб підписи не накладалися */
  D.layout = function (dims, S, k, o) {
    o = o || {};
    var cw = o.charW || 7.4, lh = o.lh || 16, step = o.step || 18, placed = [], out = [], seq = [-1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6];
    dims.forEach(function (d) {
      if (d.hidden) { out.push(Object.assign({}, d, { off: 0, box: null, txt: String(Math.round(d.value)) })); return; }
      var p1 = [d.from[0] * k, (S.height - d.from[1]) * k], p2 = [d.to[0] * k, (S.height - d.to[1]) * k];
      var txt = String(Math.round(d.value)), w = txt.length * cw + 10, mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], ch = null, i;
      for (i = 0; i < seq.length; i++) {
        var off = seq[i] * step, cx = d.axis === 0 ? mid[0] : mid[0] + off, cy = d.axis === 0 ? mid[1] + off : mid[1], box = [cx - w / 2, cy - lh / 2, cx + w / 2, cy + lh / 2];
        if (!placed.some(function (b) { return hit(b, box); })) { ch = { off: off, box: box, ok: true }; break; }
      }
      if (!ch) { var off0 = seq[0] * step, cx0 = d.axis === 0 ? mid[0] : mid[0] + off0, cy0 = d.axis === 0 ? mid[1] + off0 : mid[1]; ch = { off: off0, box: [cx0 - w / 2, cy0 - lh / 2, cx0 + w / 2, cy0 + lh / 2], ok: false }; }
      placed.push(ch.box); out.push(Object.assign({}, d, { off: ch.off, box: ch.box, txt: txt, ok: ch.ok }));
    });
    return out;
  };
  return D;
});
