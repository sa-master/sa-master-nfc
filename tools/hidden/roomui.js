(function () {
  "use strict";
  var R = HID, G = HID, KEY = "hidden-room-v1", NS = "http://www.w3.org/2000/svg";
  var $ = function (id) { return document.getElementById(id); };
  var S = { room: { W: 3000, D: 2000, features: [] }, fixtures: [], hub: null, routes: [], axes: {}, pipes: [], seq: 1 }, draw = null, pdrag = null, psel = null, zm = { z: 1, px: 0, py: 0 }, ptrs = {}, pinch = null;
  var tool = "room", pickType = "sink", sel = null, hist = [], hpos = -1, view = { sc: 1, ox: 0, oy: 0 };
  var sv = $("sv"), sheet = $("sheet"), drag = null;

  function snap() { return JSON.stringify(S); }
  function commit() { hist = hist.slice(0, hpos + 1); hist.push(snap()); if (hist.length > 100) hist.shift(); hpos = hist.length - 1; save(); render(); }
  function restore(j) { S = JSON.parse(j); sel = null; save(); render(); }
  function save() { try { localStorage.setItem(KEY, snap()); } catch (e) {} }
  function toast(m) { var t = $("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.k); toast.k = setTimeout(function () { t.classList.remove("on"); }, 2600); }
  function geomChanged() { S.axes = S.axes || {}; draw = null; if (S.routes.length || Object.keys(S.axes).length) { S.routes = []; S.axes = {}; toast("Геометрію змінено — траси скинуто, побудуйте знову"); } }
  function fxOf(id) { return S.fixtures.filter(function (f) { return f.id === id; })[0]; }
  function allRoutes() {
    S.axes = S.axes || {}; var out = S.routes.filter(function (r) { return !S.axes[r.fixtureId]; });
    Object.keys(S.axes).forEach(function (id) { var fx = fxOf(id); if (!fx) return; R.pairFor(S.axes[id].pts, fx).forEach(function (r) { r.confirmed = !!S.axes[id].confirmed; out.push(r); }); });
    return out;
  }
  /* ---------- інструмент «Труба»: тягнеш палець, лінія під 90° і прилипає ---------- */
  function pipeDraw(pts, pp, on, pv) {
    if (!pts || pts.length < 2) return;
    var dc = pp.dc || R.DIAM, dh = pp.dh || R.DIAM, polys = [];
    if (pp.cold !== false && pp.hot !== false) { polys.push(["cold", R.offsetLine(pts, dc / 2), dc]); polys.push(["hot", R.offsetLine(pts, -dh / 2), dh]); }
    else if (pp.hot === false) polys.push(["cold", pts, dc]); else polys.push(["hot", pts, dh]);
    polys.forEach(function (q) { el("polyline", { points: q[1].map(function (p) { return X(p[0]) + "," + Y(p[1]); }).join(" "), fill: "none", stroke: q[0] === "cold" ? "#0a64d6" : "#d92d20", "stroke-width": Math.max(2.5, q[2] * view.sc), "stroke-linejoin": "miter", "stroke-dasharray": pp.confirmed ? "" : "7 5", opacity: pv ? .6 : 1, "pointer-events": "none" }); });
    if (on) el("polyline", { points: pts.map(function (p) { return X(p[0]) + "," + Y(p[1]); }).join(" "), fill: "none", stroke: "#111", "stroke-width": 1, "stroke-dasharray": "2 3", "pointer-events": "none" });
    for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i], l = Math.round(Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])); if (l < 1) continue; label(X((a[0] + b[0]) / 2), Y((a[1] + b[1]) / 2) - 9, l + "", { s: 11, c: "#111" }); }
    if (on) pts.forEach(function (p) { el("circle", { cx: X(p[0]), cy: Y(p[1]), r: 4, fill: "#111", "pointer-events": "none" }); });
  }
  function snapCands() {
    var out = []; if (S.hub) out.push(S.hub);
    (S.pipes || []).forEach(function (pp) { pp.pts.forEach(function (p) { out.push(p); }); });
    S.fixtures.forEach(function (f) { out.push(f.p); });
    return out;
  }
  function onSeg(q) { /* найближча точка на вже накресленій трубі (px-відстань) */
    var best = null, bd = 18;
    (S.pipes || []).forEach(function (pp) { for (var i = 1; i < pp.pts.length; i++) { var a = pp.pts[i - 1], b = pp.pts[i], ax = X(a[0]), ay = Y(a[1]), bx = X(b[0]), by = Y(b[1]), L2 = Math.pow(bx - ax, 2) + Math.pow(by - ay, 2) || 1, t = Math.max(0, Math.min(1, ((q[0] - ax) * (bx - ax) + (q[1] - ay) * (by - ay)) / L2)), d = Math.hypot(ax + t * (bx - ax) - q[0], ay + t * (by - ay) - q[1]); if (d < bd) { bd = d; best = [Math.round((a[0] + t * (b[0] - a[0])) / 10) * 10, Math.round((a[1] + t * (b[1] - a[1])) / 10) * 10]; } } });
    return best;
  }
  function snapStart(q) {
    var w = world(q), cs = snapCands(), best = null, bd = 22;
    cs.forEach(function (p) { var d = Math.hypot(X(p[0]) - q[0], Y(p[1]) - q[1]); if (d < bd) { bd = d; best = p.slice(); } });
    if (best) return { p: best, kind: "pt" };
    var sp = onSeg(q); if (sp) return { p: sp, kind: "seg" };
    var wn = wallHit(q); if (wn && wn.d * view.sc <= 22) return { p: [Math.round(wn.q[0]), Math.round(wn.q[1])], kind: "wall", n: wn.seg.n };
    return { p: [Math.round(w[0] / 10) * 10, Math.round(w[1] / 10) * 10], kind: "free" };
  }
  function alignSnap(v, axis) { var best = v, bd = 12 / view.sc; snapCands().concat(R.pillars(S.room).map(function (f) { return [f.x, f.y]; })).forEach(function (p) { var d = Math.abs(p[axis] - v); if (d < bd) { bd = d; best = p[axis]; } }); return best === v ? Math.round(v / 10) * 10 : best; }
  function orthoEnd(st, w, forceN) {
    var dx = w[0] - st[0], dy = w[1] - st[1], horiz = forceN ? !(Math.abs(forceN[1]) > .5) : Math.abs(dx) >= Math.abs(dy);
    return horiz ? [alignSnap(w[0], 0), st[1]] : [st[0], alignSnap(w[1], 1)];
  }
  function lastPipeEnd(p) { var r = null; (S.pipes || []).forEach(function (pp, i) { var e = pp.pts[pp.pts.length - 1]; if (!pp.confirmed && e[0] === p[0] && e[1] === p[1]) r = i; }); return r; }
  function pipeDown(q) { var st = snapStart(q), ci = lastPipeEnd(st.p); pdrag = { q: q, st: st, base: [st.p], attr: ci != null ? S.pipes[ci] : { dc: R.DIAM, dh: R.DIAM }, cont: ci, end: null, moved: false }; }
  function pipeMove(q) {
    if (!pdrag) return; if (Math.hypot(q[0] - pdrag.q[0], q[1] - pdrag.q[1]) <= 8 && !pdrag.moved) return; pdrag.moved = true;
    var w = world(q), st = pdrag.st.p, fn = pdrag.st.kind === "wall" ? pdrag.st.n : (pdrag.st.p === S.hub ? null : null);
    var hn = S.hub && pdrag.st.p[0] === S.hub[0] && pdrag.st.p[1] === S.hub[1] ? R.nearest(C().pts, S.hub).seg.n : null;
    pdrag.end = orthoEnd(st, w, fn || hn); if (pdrag.end[0] === st[0] && pdrag.end[1] === st[1]) pdrag.end = null;
    if (pdrag.cont != null) pdrag.base = S.pipes[pdrag.cont].pts.slice();
    render();
  }
  function pipeUp(q) {
    var d = pdrag; pdrag = null; if (!d) return;
    if (!d.moved) { /* тап: вибір труби */ var hit2 = null; (S.pipes || []).forEach(function (pp, i) { if (onSegIdx(q, pp)) hit2 = i; }); psel = hit2; render(); return; }
    if (!d.end) { render(); return; }
    if (d.cont != null) { var pp = S.pipes[d.cont]; pp.pts = R.clean(pp.pts.concat([d.end])); psel = d.cont; }
    else { S.pipes.push({ id: "p" + S.seq++, pts: [d.st.p, d.end], dc: R.DIAM, dh: R.DIAM, cold: true, hot: true, confirmed: false }); psel = S.pipes.length - 1; }
    commit();
  }
  function onSegIdx(q, pp) { for (var i = 1; i < pp.pts.length; i++) { var a = pp.pts[i - 1], b = pp.pts[i], ax = X(a[0]), ay = Y(a[1]), bx = X(b[0]), by = Y(b[1]), L2 = Math.pow(bx - ax, 2) + Math.pow(by - ay, 2) || 1, t = Math.max(0, Math.min(1, ((q[0] - ax) * (bx - ax) + (q[1] - ay) * (by - ay)) / L2)); if (Math.hypot(ax + t * (bx - ax) - q[0], ay + t * (by - ay) - q[1]) < 18) return true; } return false; }
  function pipeSheet() {
    var h = document.createElement("h4"); h.textContent = "Труба"; sheet.appendChild(h);
    var pp = S.pipes[psel];
    if (!pp) { var n = document.createElement("div"); n.className = "note"; n.textContent = "Тягніть палець від вузла (або від кінця вже накресленої труби). Лінія стає під 90° і прилипає до сітки 10 мм та до осей інших точок. Торкніться труби, щоб змінити її."; sheet.appendChild(n); sheet.appendChild(row(btn("Підтвердити всі", "p", function () { (S.pipes || []).forEach(function (x) { x.confirmed = true; }); commit(); }))); return; }
    var last = pp.pts.length - 1, a = pp.pts[last - 1], b = pp.pts[last], l = Math.round(Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]));
    sheet.appendChild(row(fld("Остання ділянка, мм", l, function (v) { var nv = Math.max(10, num(v)), dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]); pp.pts[last] = [a[0] + dx * nv, a[1] + dy * nv]; pp.confirmed = false; commit(); }), fld("Ø ХВП, мм", pp.dc || R.DIAM, function (v) { pp.dc = num(v) || R.DIAM; commit(); }), fld("Ø ГВП, мм", pp.dh || R.DIAM, function (v) { pp.dh = num(v) || R.DIAM; commit(); })));
    sheet.appendChild(row(sel2("Що йде", pp.cold === false ? "hot" : pp.hot === false ? "cold" : "both", [["both", "ХВП + ГВП"], ["cold", "лише ХВП"], ["hot", "лише ГВП"]], function (v) { pp.cold = v !== "hot"; pp.hot = v !== "cold"; commit(); })));
    sheet.appendChild(row(btn("↶ Остання ділянка", "", function () { if (pp.pts.length > 2) pp.pts.pop(); else { S.pipes.splice(psel, 1); psel = null; } commit(); }), btn(pp.confirmed ? "Підтверджено ✓" : "Підтвердити як фактичну", pp.confirmed ? "" : "p", function () { pp.confirmed = !pp.confirmed; commit(); }), btn("Видалити", "d", function () { S.pipes.splice(psel, 1); psel = null; commit(); })));
    var len2 = 0; for (var i = 1; i < pp.pts.length; i++) len2 += Math.abs(pp.pts[i][0] - pp.pts[i - 1][0]) + Math.abs(pp.pts[i][1] - pp.pts[i - 1][1]);
    var d2 = document.createElement("div"); d2.className = "note"; d2.textContent = "Довжина по плану: " + (len2 / 1000).toFixed(2) + " м. Пунктир — не підтверджено. Пара ХВП справа, ГВП зліва за напрямком від вузла."; sheet.appendChild(d2);
  }
  function C() { return R.contour(S.room); }
  function segs() { var c = C(); return c.errors.length ? [] : R.segs(c.pts); }

  /* ---------- розкладка ---------- */
  function fit() {
    var r = sv.getBoundingClientRect(), W = S.room.W, D = S.room.D, pad = 56;
    var xs = [0, W], ys = [0, D]; C().pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); });
    var x0 = Math.min.apply(0, xs), x1 = Math.max.apply(0, xs), y0 = Math.min.apply(0, ys), y1 = Math.max.apply(0, ys);
    S.room.features.forEach(function (f) { if (f.kind === "pillar") { x0 = Math.min(x0, f.x); x1 = Math.max(x1, f.x + f.w); y0 = Math.min(y0, f.y); y1 = Math.max(y1, f.y + f.h); } });
    var top = 50, avail = r.height - top - (sheet.classList.contains("on") ? sheet.offsetHeight : 0), pd = 40;
    var sc = Math.min((r.width - 2 * pad) / (x1 - x0), (avail - 2 * pd) / (y1 - y0));
    var b0 = { sc: sc, ox: (r.width - (x1 - x0) * sc) / 2 - x0 * sc, oy: top + (avail - (y1 - y0) * sc) / 2 + y1 * sc }, cx = r.width / 2, cy = r.height / 2;
    view = { sc: b0.sc * zm.z, ox: cx + (b0.ox - cx) * zm.z + zm.px, oy: cy + (b0.oy - cy) * zm.z + zm.py, b0: b0, cx: cx, cy: cy };
  }
  var X = function (x) { return view.ox + x * view.sc; }, Y = function (y) { return view.oy - y * view.sc; };
  function el(n, a, txt) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; sv.appendChild(e); return e; }
  function label(x, y, t, o) { o = o || {}; var e = el("text", { x: x, y: y, "text-anchor": o.a || "middle", "font-size": o.s || 11, fill: o.c || "#344054", "font-weight": o.w || 600, "paint-order": "stroke", stroke: "#fff", "stroke-width": 3, "pointer-events": "none" }, t); return e; }

  function render() {
    renderSheet(); fit(); sv.innerHTML = "";
    var c = C(), W = S.room.W, D = S.room.D;
    $("undo").disabled = hpos <= 0; $("redo").disabled = hpos >= hist.length - 1;
    document.querySelectorAll("#bar button").forEach(function (b) { b.classList.toggle("on", b.dataset.tool === tool); });
    var hints = { room: "Задайте розміри й додайте виступи, ніші, колони", fix: "Оберіть прилад і торкніться стіни, де він стоїть", hub: "Торкніться стіни, де вузол або ввід труб", routes: "Торкніться приладу, щоб задати його трасу", pipe: "Тягніть палець від вузла чи кінця труби — лінія стане під 90° і прилипне", select: "Торкніться приладу чи вузла; тягніть уздовж стіни" };
    $("hint").textContent = hints[tool];
    if (c.errors.length) { label(20, 90, c.errors[0], { a: "start", c: "#d70015", s: 13 }); return; }
    var pts = c.pts;
    el("polygon", { points: pts.map(function (p) { return X(p[0]) + "," + Y(p[1]); }).join(" "), fill: "#f4f6fa", stroke: "#1b2a49", "stroke-width": 4, "stroke-linejoin": "miter" });
    R.pillars(S.room).forEach(function (f) { el("rect", { x: X(f.x), y: Y(f.y + f.h), width: f.w * view.sc, height: f.h * view.sc, fill: "#c9ced8", stroke: "#1b2a49", "stroke-width": 3 }); });
    var sg = R.segs(pts);
    sg.forEach(function (s, i) { /* довжина стіни ззовні */
      var mx = (s.a[0] + s.b[0]) / 2, my = (s.a[1] + s.b[1]) / 2, o = 20;
      label(X(mx) - s.n[0] * o, Y(my) + s.n[1] * o + 4, Math.round(s.len) + "", { c: "#667085" });
    });
    pts.forEach(function (p, i) { el("circle", { cx: X(p[0]) + 0, cy: Y(p[1]), r: 9, fill: "#1b2a49" }); label(X(p[0]), Y(p[1]) + 4, i + 1, { c: "#fff", s: 10, w: 700 }).setAttribute("stroke-width", 0); });
    /* траси */
    var dia = { cold: "#0a64d6", hot: "#d92d20" };
    var shown = allRoutes(); if (draw) { var pv = drawAxis(true); if (pv) { var fxd = fxOf(draw.fid); R.pairFor(pv, fxd).forEach(function (r) { r.pv = 1; shown.push(r); }); } }
    shown.forEach(function (r) {
      var fx = S.fixtures.filter(function (f) { return f.id === r.fixtureId; })[0], d = (r.systemId === "cold" ? fx && (fx.dc || fx.d) : fx && (fx.dh || fx.d)) || R.DIAM;
      el("polyline", { points: r.pts.map(function (p) { return X(p[0]) + "," + Y(p[1]); }).join(" "), fill: "none", stroke: dia[r.systemId], "stroke-width": Math.max(2.5, d * view.sc), "stroke-linejoin": "miter", "stroke-linecap": "butt", "stroke-dasharray": r.confirmed ? "" : "7 5", opacity: r.pv ? .55 : (r.confirmed ? 1 : .8), "pointer-events": "none" });
    });
    (S.pipes || []).forEach(function (pp, pi) { pipeDraw(pp.pts, pp, pi === psel, false); });
    if (pdrag && pdrag.end) { var pv2 = pdrag.base.concat([pdrag.end]); pipeDraw(pv2.length > 1 ? pv2 : [], pdrag.attr, true, true); }
    /* прилади */
    S.fixtures.forEach(function (f, i) {
      var t = R.fixType(f.type), near = R.nearest(pts, f.p), n = near.seg.n, x = X(f.p[0]), y = Y(f.p[1]);
      var cx = x + n[0] * 14, cy = y - n[1] * 14, on = sel && sel.k === "f" && sel.id === f.id;
      el("circle", { cx: cx, cy: cy, r: 13, fill: on ? "#0a64d6" : "#fff", stroke: "#1b2a49", "stroke-width": 2.5 });
      label(cx, cy + 4, t.code, { c: on ? "#fff" : "#111", s: 12, w: 800 }).setAttribute("stroke-width", 0);
      var si = near.seg.i, base = f.base === "b" ? "b" : "a", corner = base === "a" ? si + 1 : (si + 1) % pts.length + 1;
      var tx = x + n[0] * 44, ty = Y(f.p[1]) - n[1] * 44 + 4;
      label(tx, ty, "№" + corner + ": " + R.distFrom(near.seg, f.p, base) + " · h" + (f.h || t.h), { s: 10, c: "#475467" });
    });
    if (S.hub) {
      var hn = R.nearest(pts, S.hub), hx = X(S.hub[0]) + hn.seg.n[0] * 16, hy = Y(S.hub[1]) - hn.seg.n[1] * 16, on2 = sel && sel.k === "h";
      el("rect", { x: hx - 13, y: hy - 13, width: 26, height: 26, rx: 4, fill: on2 ? "#0a64d6" : "#fff", stroke: "#b42318", "stroke-width": 3 });
      label(hx, hy + 5, "◉", { c: on2 ? "#fff" : "#b42318", s: 15 }).setAttribute("stroke-width", 0);
    }
    renderChips();
  }

  /* ---------- нижні панелі ---------- */
  function renderChips() {
    var ch = $("chips"); ch.classList.toggle("on", tool === "fix"); if (tool !== "fix") return; ch.innerHTML = "";
    R.FIX.forEach(function (t) { var b = document.createElement("button"); b.className = "chip" + (t.id === pickType ? " on" : ""); b.textContent = t.code + " " + t.name; b.onclick = function () { pickType = t.id; renderChips(); }; ch.appendChild(b); });
  }
  function num(v) { var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : 0; }
  function fld(label, val, on, type) { var l = document.createElement("label"); l.textContent = label; var i = document.createElement("input"); i.value = val; i.inputMode = type === "t" ? "text" : "decimal"; i.onchange = function () { on(i.value); }; l.appendChild(i); return l; }
  function sel2(label, val, opts, on) { var l = document.createElement("label"); l.textContent = label; var s = document.createElement("select"); opts.forEach(function (o) { var e = document.createElement("option"); e.value = o[0]; e.textContent = o[1]; if (String(o[0]) === String(val)) e.selected = true; s.appendChild(e); }); s.onchange = function () { on(s.value); }; l.appendChild(s); return l; }
  function btn(t, cls, on) { var b = document.createElement("button"); b.className = "btn " + (cls || ""); b.textContent = t; b.onclick = on; return b; }
  function row() { var r = document.createElement("div"); r.className = "row"; for (var i = 0; i < arguments.length; i++) r.appendChild(arguments[i]); return r; }

  function renderSheet() {
    sheet.innerHTML = ""; var show = false;
    if (tool === "room") { show = true; roomSheet(); }
    else if (tool === "routes") { show = true; routesSheet(); }
    else if (tool === "pipe") { show = true; pipeSheet(); }
    else if (sel && sel.k === "f") { show = true; fixSheet(); }
    else if (sel && sel.k === "h") { show = true; hubSheet(); }
    sheet.classList.toggle("on", show);
  }
  function roomSheet() {
    var h = document.createElement("h4"); h.textContent = "Приміщення"; sheet.appendChild(h);
    sheet.appendChild(row(fld("Ширина, мм", S.room.W, function (v) { S.room.W = num(v); geomChanged(); commit(); }), fld("Глибина, мм", S.room.D, function (v) { S.room.D = num(v); geomChanged(); commit(); })));
    var errs = C().errors; errs.forEach(function (e) { var d = document.createElement("div"); d.className = "err"; d.textContent = e; sheet.appendChild(d); });
    var c = C(); if (!errs.length) { var a = document.createElement("div"); a.className = "note"; a.textContent = "Площа: " + (c.area / 1e6).toFixed(2) + " м² · кутів: " + c.pts.length; sheet.appendChild(a); }
    var wallOpts = Object.keys(R.SIDES).map(function (k) { return [k, R.SIDES[k].n + " стіна"]; });
    S.room.features.forEach(function (f, i) {
      var box = document.createElement("div"); box.className = "feat";
      var kinds = [["bump", "Виступ / колона біля стіни"], ["niche", "Ніша"], ["pillar", "Окрема колона"]];
      var set = function (k, num_) { return function (v) { f[k] = num_ ? num(v) : v; geomChanged(); commit(); }; };
      box.appendChild(row(sel2("Тип", f.kind, kinds, function (v) { var o = f; S.room.features[i] = v === "pillar" ? { kind: "pillar", x: 1000, y: 800, w: 400, h: 400 } : { kind: v, wall: o.wall || "N", from: o.from || "start", off: o.off || 300, w: o.w || 400, d: o.d || 200 }; geomChanged(); commit(); }), btn("✕", "d", function () { S.room.features.splice(i, 1); geomChanged(); commit(); })));
      if (f.kind === "pillar") box.appendChild(row(fld("X від лівого, мм", f.x, set("x", 1)), fld("Y від нижнього, мм", f.y, set("y", 1)), fld("Ширина", f.w, set("w", 1)), fld("Глибина", f.h, set("h", 1))));
      else box.appendChild(row(sel2("Стіна", f.wall, wallOpts, set("wall")), sel2("Відлік від", f.from, [["start", "початку стіни"], ["end", "кінця стіни"]], set("from")), fld("Відступ, мм", f.off, set("off", 1)), fld("Ширина", f.w, set("w", 1)), fld("Глибина", f.d, set("d", 1))));
      sheet.appendChild(box);
    });
    sheet.appendChild(btn("+ Виступ, ніша або колона", "p", function () { S.room.features.push({ kind: "bump", wall: "N", from: "start", off: 300, w: 400, d: 200 }); geomChanged(); commit(); }));
    var n = document.createElement("div"); n.className = "note"; n.textContent = "Номери кутів на плані йдуть проти годинникової стрілки від лівого нижнього. Розміри стін — у мм."; sheet.appendChild(n);
  }
  function fixSheet() {
    var f = S.fixtures.filter(function (x) { return x.id === sel.id; })[0]; if (!f) { sel = null; return; }
    var t = R.fixType(f.type), sg = segs(), near = R.nearest(C().pts, f.p), s = near.seg, base = f.base === "b" ? "b" : "a", np = C().pts.length;
    var h = document.createElement("h4"); h.textContent = t.name; sheet.appendChild(h);
    var wallOpts = sg.map(function (x, i) { return [i, "стіна " + (i + 1) + "–" + ((i + 1) % np + 1) + " (" + Math.round(x.len) + ")"]; });
    sheet.appendChild(row(sel2("Тип", f.type, R.FIX.map(function (x) { return [x.id, x.name]; }), function (v) { f.type = v; f.h = R.fixType(v).h; geomChanged(); commit(); })));
    var mv = function (si, b, d) { var ss = sg[si]; d = Math.max(0, Math.min(ss.len, d)); f.p = R.pointAt(ss, b, d); f.base = b; geomChanged(); commit(); };
    sheet.appendChild(row(sel2("Стіна", s.i, wallOpts, function (v) { mv(+v, base, R.distFrom(s, f.p, base)); }),
      sel2("Відлік від кута", base, [["a", "№" + (s.i + 1)], ["b", "№" + ((s.i + 1) % np + 1)]], function (v) { f.base = v; commit(); }),
      fld("Відстань, мм", R.distFrom(s, f.p, base), function (v) { mv(s.i, base, num(v)); })));
    sheet.appendChild(row(fld("Висота від підлоги, мм", f.h || t.h, function (v) { f.h = num(v); commit(); }), fld("Діаметр труби, мм", f.d || R.DIAM, function (v) { f.d = num(v) || R.DIAM; geomChanged(); commit(); })));
    sheet.appendChild(row(btn("Дублювати", "", function () { var c = JSON.parse(JSON.stringify(f)); c.id = "f" + S.seq++; var ss = s, d = Math.min(ss.len, R.distFrom(ss, f.p, base) + 400); c.p = R.pointAt(ss, base, d); S.fixtures.push(c); sel = { k: "f", id: c.id }; geomChanged(); commit(); }), btn("Видалити", "d", function () { S.fixtures = S.fixtures.filter(function (x) { return x !== f; }); sel = null; geomChanged(); commit(); })));
  }
  function hubSheet() {
    var h = document.createElement("h4"); h.textContent = "Вузол / ввід труб"; sheet.appendChild(h);
    var sg = segs(), s = R.nearest(C().pts, S.hub).seg, np = C().pts.length;
    sheet.appendChild(row(fld("Відстань від кута №" + (s.i + 1) + ", мм", R.distFrom(s, S.hub, "a"), function (v) { S.hub = R.pointAt(s, "a", Math.max(0, Math.min(s.len, num(v)))); geomChanged(); commit(); }), btn("Видалити", "d", function () { S.hub = null; sel = null; geomChanged(); commit(); })));
  }
  function len(p) { var s = 0; for (var i = 1; i < p.length; i++) s += Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]); return s; }
  function routesSheet() {
    var h = document.createElement("h4"); h.textContent = "Траси ХВП / ГВП"; sheet.appendChild(h);
    if (draw) {
      var fx = fxOf(draw.fid), t = document.createElement("div"); t.className = "note"; t.textContent = "Малюємо трасу до: " + R.fixType(fx.type).name + ". Торкайтеся точок, де труба повертає (кути прямі). Пару ХВП/ГВП програма дорисує сама. Щоб відгалузитись від наявної траси — першим дотиком торкніться її."; sheet.appendChild(t);
      sheet.appendChild(row(btn("↶ Точка", "", function () { if (draw.pts.length > 1) draw.pts.pop(); render(); }), btn("✕ Скасувати", "d", function () { draw = null; render(); }), btn("Готово ✓", "p", finishDraw))); return;
    }
    if (!S.hub) { var n = document.createElement("div"); n.className = "err"; n.textContent = "Спершу вкажіть вузол або ввід труб."; sheet.appendChild(n); return; }
    if (!S.fixtures.length) { var n2 = document.createElement("div"); n2.className = "err"; n2.textContent = "Додайте хоча б один прилад."; sheet.appendChild(n2); return; }
    var st = document.createElement("div"); st.className = "note"; st.textContent = manual ? "Режим «вручну»: торкніться приладу й задайте точки повороту." : "Торкніться приладу на плані — траса від вузла побудується сама, з найменшою кількістю кутів. Або побудуйте всі одразу."; sheet.appendChild(st);
    var all = allRoutes(), conf = all.length && all.every(function (r) { return r.confirmed; });
    sheet.appendChild(row(btn("Побудувати всі", "", build), btn(manual ? "Режим: вручну" : "Режим: авто", "", function () { manual = !manual; render(); }), all.length && !conf ? btn("Підтвердити як фактичні", "p", function () { S.routes.forEach(function (r) { r.confirmed = true; }); Object.keys(S.axes).forEach(function (k) { S.axes[k].confirmed = true; }); commit(); }) : document.createElement("span"), all.length ? btn("Скинути", "d", function () { S.routes = []; S.axes = {}; commit(); }) : document.createElement("span")));
    if (all.length) {
      var tot = { cold: 0, hot: 0 }; all.forEach(function (r) { tot[r.systemId] += len(r.pts); });
      var d = document.createElement("div"); d.className = "note"; d.textContent = (conf ? "Підтверджені (фактичні) траси. " : "Пунктир — не підтверджено, у звіт не йде. ") + "Довжина по плану: ХВП " + (tot.cold / 1000).toFixed(2) + " м, ГВП " + (tot.hot / 1000).toFixed(2) + " м (горизонтальні ділянки, без підйомів).";
      sheet.appendChild(d);
    }
    if (build.failed && build.failed.length) { var e = document.createElement("div"); e.className = "err"; e.textContent = "Автоматично не дотягнуто до: " + build.failed.map(function (id) { var f = fxOf(id); return f ? R.fixType(f.type).name : id; }).join(", ") + "."; sheet.appendChild(e); }
  }
  /* ручне задання осі: ортогональні точки від вузла (або від наявної траси) до приладу */
  function snapOrtho(last, q, forceN) {
    var dx = q[0] - last[0], dy = q[1] - last[1], horiz = forceN ? Math.abs(forceN[1]) > .5 === false : Math.abs(dx) >= Math.abs(dy);
    var r = function (v) { return Math.round(v / 10) * 10; };
    return horiz ? [r(q[0]), last[1]] : [last[0], r(q[1])];
  }
  function drawAxis(preview) {
    var pts = draw.pts.slice(); if (pts.length < 2 && !preview) return null; if (pts.length < 1) return null;
    var fx = fxOf(draw.fid), near = R.nearest(C().pts, fx.p), n = near.seg.n, p = near.q.map(Math.round), last = pts[pts.length - 1];
    var c = Math.abs(n[1]) > .5 ? [p[0], last[1]] : [last[0], p[1]];
    if (c[0] !== last[0] || c[1] !== last[1]) pts.push(c); pts.push(p);
    return R.clean(pts);
  }
  var manual = false;
  function autoOne(fid) {
    var fx = fxOf(fid), res = R.buildRoutes(S.room, S.hub, [fx]);
    if (!res.axes[fid]) { toast("Не вдалося дотягнути трасу до цього приладу"); return; }
    S.axes[fid] = { pts: res.axes[fid], confirmed: false }; S.routes = S.routes.filter(function (r) { return r.fixtureId !== fid; }); commit();
  }
  function startDraw(fid) {
    var hn = R.nearest(C().pts, S.hub);
    draw = { fid: fid, pts: [S.hub.map(Math.round)], hubN: hn.seg.n, fromHub: true }; render();
  }
  function finishDraw() {
    var ax = drawAxis(false); if (!ax || ax.length < 2) { toast("Додайте хоча б одну точку траси"); return; }
    var fid = draw.fid; draw = null; S.axes[fid] = { pts: ax, confirmed: false }; S.routes = S.routes.filter(function (r) { return r.fixtureId !== fid; }); commit(); toast("Траса задана (не підтверджена)");
  }
  function nearAxis(q) {
    var best = null, bd = 24; Object.keys(S.axes).forEach(function (id) { var pts = S.axes[id].pts; for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i], ax = X(a[0]), ay = Y(a[1]), bx = X(b[0]), by = Y(b[1]); var t = Math.max(0, Math.min(1, ((q[0] - ax) * (bx - ax) + (q[1] - ay) * (by - ay)) / (Math.pow(bx - ax, 2) + Math.pow(by - ay, 2) || 1))); var d = Math.hypot(ax + t * (bx - ax) - q[0], ay + t * (by - ay) - q[1]); if (d < bd) { bd = d; best = [Math.round((a[0] + t * (b[0] - a[0])) / 10) * 10, Math.round((a[1] + t * (b[1] - a[1])) / 10) * 10]; } } });
    return best;
  }
  function build() {
    var c = C(); if (c.errors.length) { toast(c.errors[0]); return; }
    var res = R.buildRoutes(S.room, S.hub, S.fixtures); build.failed = res.failed.map(function (f) { return f.id || f; });
    S.routes = []; S.axes = {}; Object.keys(res.axes).forEach(function (id) { S.axes[id] = { pts: res.axes[id], confirmed: false }; });
    commit(); toast(Object.keys(S.axes).length ? "Траси побудовано (чернетка)" : "Траси не побудовано");
  }

  /* ---------- жести ---------- */
  function pt(e) { var r = sv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function world(q) { return [(q[0] - view.ox) / view.sc, (view.oy - q[1]) / view.sc]; }
  function wallHit(q) { var c = C(); if (c.errors.length) return null; var w = world(q), n = R.nearest(c.pts, w); return n.d * view.sc <= 48 ? n : null; }
  function hit(q) {
    var c = C(); var best = null, bd = 28; if (c.errors.length) return null;
    S.fixtures.forEach(function (f) { var n = R.nearest(c.pts, f.p).seg.n, x = X(f.p[0]) + n[0] * 14, y = Y(f.p[1]) - n[1] * 14, d = Math.hypot(x - q[0], y - q[1]); if (d < bd) { bd = d; best = { k: "f", id: f.id }; } });
    if (S.hub) { var n2 = R.nearest(c.pts, S.hub).seg.n, d2 = Math.hypot(X(S.hub[0]) + n2[0] * 16 - q[0], Y(S.hub[1]) - n2[1] * 16 - q[1]); if (d2 < bd) best = { k: "h" }; }
    return best;
  }
  sv.addEventListener("pointerdown", function (e) { if (tool === "pipe") { if (!C().errors.length) { pipeDown(pt(e)); sv.setPointerCapture(e.pointerId); } return; } var q = pt(e); drag = { q: q, moved: false, h: tool === "select" || tool === "fix" || tool === "hub" ? hit(q) : null }; sv.setPointerCapture(e.pointerId); });
  sv.addEventListener("pointermove", function (e) {
    if (tool === "pipe") { pipeMove(pt(e)); return; }
    if (!drag) return; var q = pt(e); if (Math.hypot(q[0] - drag.q[0], q[1] - drag.q[1]) > 8) drag.moved = true;
    if (drag.moved && drag.h && tool === "select") { var n = wallHit(q); if (!n) return; var np = [Math.round(n.q[0]), Math.round(n.q[1])]; if (drag.h.k === "h") S.hub = np; else S.fixtures.forEach(function (f) { if (f.id === drag.h.id) f.p = np; }); sel = drag.h; drag.did = true; render(); }
  });
  sv.addEventListener("pointerup", function (e) {
    if (tool === "pipe") { pipeUp(pt(e)); return; }
    if (!drag) return; var q = pt(e), d = drag; drag = null;
    if (d.did) { geomChanged(); commit(); return; }
    if (d.moved) return;
    if (tool === "routes" && draw) {
      var w = world(q);
      if (draw.pts.length === 1) { var br = nearAxis(q); if (br) { draw.pts = [br]; draw.fromHub = false; render(); return; } }
      var last = draw.pts[draw.pts.length - 1], np2 = snapOrtho(last, w, draw.fromHub && draw.pts.length === 1 ? draw.hubN : null);
      if (np2[0] !== last[0] || np2[1] !== last[1]) { draw.pts.push(np2); render(); }
      return;
    }
    var h = hit(q);
    if (tool === "routes") { if (h && h.k === "f" && S.hub) { if (manual) startDraw(h.id); else autoOne(h.id); } return; }
    if (tool === "fix" || tool === "select" || tool === "hub") { if (h && (tool === "select" || (tool === "fix" && h.k === "f") || (tool === "hub" && h.k === "h"))) { sel = h; render(); return; } }
    var n = wallHit(q);
    if (tool === "fix" && n) { var t = R.fixType(pickType), f = { id: "f" + S.seq++, type: pickType, p: [Math.round(n.q[0]), Math.round(n.q[1])], base: "a", h: t.h }; S.fixtures.push(f); sel = { k: "f", id: f.id }; geomChanged(); commit(); }
    else if (tool === "hub" && n) { S.hub = [Math.round(n.q[0]), Math.round(n.q[1])]; sel = { k: "h" }; geomChanged(); commit(); }
    else if (tool === "select") { sel = null; render(); }
  });
  document.querySelectorAll("#bar button").forEach(function (b) { b.onclick = function () { tool = b.dataset.tool; pdrag = null; if (tool !== "pipe") psel = null; if (tool !== "select" && tool !== "fix" && tool !== "hub") sel = null; render(); }; });
  $("undo").onclick = function () { if (hpos > 0) { hpos--; restore(hist[hpos]); } };
  $("redo").onclick = function () { if (hpos < hist.length - 1) { hpos++; restore(hist[hpos]); } };
  $("menu").onclick = function () {
    var b = $("box"); b.innerHTML = "<h3>Меню</h3>"; var ta = document.createElement("textarea"); ta.readOnly = true; ta.value = snap(); b.appendChild(ta);
    var r = row(btn("Скопіювати дані", "p", function () { ta.select(); try { navigator.clipboard.writeText(ta.value); toast("Скопійовано"); } catch (e) { document.execCommand("copy"); } }), btn("Почати знову", "d", function () { S = { room: { W: 3000, D: 2000, features: [] }, fixtures: [], hub: null, routes: [], axes: {}, pipes: [], seq: 1 }; draw = null; sel = null; psel = null; $("ovl").classList.remove("on"); commit(); }), btn("Закрити", "", function () { $("ovl").classList.remove("on"); })); r.style.marginTop = "10px"; b.appendChild(r); $("ovl").classList.add("on");
  };
  /* два пальці: масштаб і переміщення креслення */
  function two() { var k = Object.keys(ptrs); if (k.length < 2) return null; var a = ptrs[k[0]], b = ptrs[k[1]]; return { m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1 }; }
  sv.addEventListener("pointerdown", function (e) { ptrs[e.pointerId] = pt(e); if (Object.keys(ptrs).length === 2) { drag = null; pdrag = null; draw = draw; pinch = two(); pinch.z = zm.z; pinch.px = zm.px; pinch.py = zm.py; e.stopImmediatePropagation(); } }, true);
  sv.addEventListener("pointermove", function (e) {
    if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = pt(e);
    if (pinch) { var t = two(); if (!t) return; var z2 = Math.max(1, Math.min(10, pinch.z * t.d / pinch.d)), v = view;
      var o2x = t.m[0] - (pinch.m[0] - (v.cx + (v.b0.ox - v.cx) * pinch.z + pinch.px)) * (z2 / pinch.z), o2y = t.m[1] - (pinch.m[1] - (v.cy + (v.b0.oy - v.cy) * pinch.z + pinch.py)) * (z2 / pinch.z);
      zm.z = z2; zm.px = o2x - v.cx - (v.b0.ox - v.cx) * z2; zm.py = o2y - v.cy - (v.b0.oy - v.cy) * z2; render(); e.stopImmediatePropagation(); }
  }, true);
  function endP(e) { delete ptrs[e.pointerId]; if (pinch) { if (Object.keys(ptrs).length < 2) { pinch = null; drag = null; pdrag = null; e.stopImmediatePropagation(); } } }
  sv.addEventListener("pointerup", endP, true); sv.addEventListener("pointercancel", endP, true);
  $("fitb").onclick = function () { zm = { z: 1, px: 0, py: 0 }; render(); };
  /* ---------- специфікація ---------- */
  function plen(p) { var s = 0; for (var i = 1; i < p.length; i++) s += Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]); return s; }
  function spec() {
    var lines = [], unconf = 0;
    allRoutes().forEach(function (r) { var fx = fxOf(r.fixtureId); lines.push({ sys: r.systemId, d: r.systemId === "cold" ? (fx && (fx.dc || fx.d)) || R.DIAM : (fx && (fx.dh || fx.d)) || R.DIAM, pts: r.pts, conf: r.confirmed, tee: false }); });
    (S.pipes || []).forEach(function (pp) {
      var dc = pp.dc || R.DIAM, dh = pp.dh || R.DIAM, tee = false, st = pp.pts[0];
      (S.pipes || []).forEach(function (o) { if (o === pp) return; for (var i = 1; i < o.pts.length; i++) { var a = o.pts[i - 1], b = o.pts[i]; var inx = a[1] === b[1] && st[1] === a[1] && st[0] > Math.min(a[0], b[0]) && st[0] < Math.max(a[0], b[0]), iny = a[0] === b[0] && st[0] === a[0] && st[1] > Math.min(a[1], b[1]) && st[1] < Math.max(a[1], b[1]); if (inx || iny) tee = true; } });
      if (pp.cold !== false) lines.push({ sys: "cold", d: dc, pts: pp.hot === false ? pp.pts : R.offsetLine(pp.pts, dc / 2), conf: pp.confirmed, tee: tee });
      if (pp.hot !== false) lines.push({ sys: "hot", d: dh, pts: pp.cold === false ? pp.pts : R.offsetLine(pp.pts, -dh / 2), conf: pp.confirmed, tee: tee });
    });
    var pipes = {}, fit = {}, rise = {}, mk = function (o, k, v) { o[k] = (o[k] || 0) + v; };
    lines.forEach(function (l) { if (!l.conf) unconf++; var nm = (l.sys === "cold" ? "ХВП" : "ГВП") + " Ø" + l.d; mk(pipes, nm, plen(l.pts)); mk(fit, "Коліно 90° Ø" + l.d, Math.max(0, l.pts.length - 2)); if (l.tee) mk(fit, "Трійник Ø" + l.d, 1); });
    var fxl = {}; S.fixtures.forEach(function (f) {
      var t = R.fixType(f.type); mk(fxl, t.name, 1); var c = f.cold === undefined ? t.cold : f.cold, hh = f.hot === undefined ? t.hot : f.hot, h = f.h || t.h;
      [["cold", c, f.dc || f.d || R.DIAM], ["hot", hh, f.dh || f.d || R.DIAM]].forEach(function (x) { if (x[1]) { mk(rise, (x[0] === "cold" ? "ХВП" : "ГВП") + " Ø" + x[2] + " (підйом до приладу)", h); mk(fit, "Коліно 90° Ø" + x[2] + " (перехід на підйом)", 1); } });
    });
    return { pipes: pipes, fit: fit, rise: rise, fx: fxl, unconf: unconf, hub: !!S.hub, total: lines.length };
  }
  $("spec").onclick = function () {
    var sp = spec(), b = $("box"), txt = [], m = function (v) { return (v / 1000).toFixed(2); };
    b.innerHTML = "<h3>Специфікація матеріалів</h3>";
    var tb = document.createElement("table"); tb.style.cssText = "width:100%;border-collapse:collapse;font-size:14px"; var add = function (a, c, d, hdr) { var tr = tb.insertRow(); [a, c, d].forEach(function (v, i) { var td = tr.insertCell(); td.textContent = v; td.style.cssText = "padding:6px 4px;border-bottom:1px solid #e4e7ec;" + (i ? "text-align:right;" : "") + (hdr ? "font-weight:700;background:#f2f4f7;" : ""); }); txt.push([a, c, d].join("\t")); };
    add("Позиція", "К-сть", "Запас +10 %", true);
    Object.keys(sp.pipes).sort().forEach(function (k) { add("Труба " + k, m(sp.pipes[k]) + " м", m(sp.pipes[k] * 1.1) + " м"); });
    Object.keys(sp.rise).sort().forEach(function (k) { add("Труба " + k, m(sp.rise[k]) + " м", m(sp.rise[k] * 1.1) + " м"); });
    Object.keys(sp.fit).sort().forEach(function (k) { add(k, sp.fit[k] + " шт", ""); });
    Object.keys(sp.fx).forEach(function (k) { add(k, sp.fx[k] + " шт", ""); });
    if (sp.hub) add("Вузол / колектор", "1 шт", "");
    if (!sp.total) { b.innerHTML += "<div class='note'>Трас ще немає. Накресліть трубу або побудуйте траси.</div>"; } else { b.appendChild(tb); }
    var n = document.createElement("div"); n.className = "note"; n.style.marginTop = "8px";
    n.textContent = (sp.unconf ? "Увага: " + sp.unconf + " ліній ще не підтверджено, але враховано. " : "") + "Довжини труб — горизонтальні ділянки по плану плюс підйоми до приладів за вказаною висотою. Трійники рахуються там, де труба починається з середини іншої. Фітинги на підйомах у стінах та інше треба додати вручну.";
    b.appendChild(n);
    var r = row(btn("Скопіювати", "p", function () { var t = txt.join("\n"); try { navigator.clipboard.writeText(t); toast("Скопійовано"); } catch (e) { toast("Не вдалося скопіювати"); } }), btn("Закрити", "", function () { $("ovl").classList.remove("on"); })); r.style.marginTop = "10px"; b.appendChild(r); $("ovl").classList.add("on");
  };
  window.addEventListener("resize", render);
  try { var s0 = localStorage.getItem(KEY); if (s0) S = JSON.parse(s0); } catch (e) {} S.pipes = S.pipes || []; S.axes = S.axes || {};
  window.__S = function () { return S; }; window.__V = function () { return view; };
  hist = [snap()]; hpos = 0; render();
})();
