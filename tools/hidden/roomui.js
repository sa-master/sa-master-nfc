(function () {
  "use strict";
  var R = HID, G = HID, KEY = "hidden-room-v1", NS = "http://www.w3.org/2000/svg";
  var $ = function (id) { return document.getElementById(id); };
  var S = { room: { W: 3000, D: 2000, features: [] }, fixtures: [], hub: null, routes: [], axes: {}, seq: 1 }, draw = null;
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
    view = { sc: sc, ox: (r.width - (x1 - x0) * sc) / 2 - x0 * sc, oy: top + (avail - (y1 - y0) * sc) / 2 + y1 * sc };
  }
  var X = function (x) { return view.ox + x * view.sc; }, Y = function (y) { return view.oy - y * view.sc; };
  function el(n, a, txt) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; sv.appendChild(e); return e; }
  function label(x, y, t, o) { o = o || {}; var e = el("text", { x: x, y: y, "text-anchor": o.a || "middle", "font-size": o.s || 11, fill: o.c || "#344054", "font-weight": o.w || 600, "paint-order": "stroke", stroke: "#fff", "stroke-width": 3, "pointer-events": "none" }, t); return e; }

  function render() {
    renderSheet(); fit(); sv.innerHTML = "";
    var c = C(), W = S.room.W, D = S.room.D;
    $("undo").disabled = hpos <= 0; $("redo").disabled = hpos >= hist.length - 1;
    document.querySelectorAll("#bar button").forEach(function (b) { b.classList.toggle("on", b.dataset.tool === tool); });
    var hints = { room: "Задайте розміри й додайте виступи, ніші, колони", fix: "Оберіть прилад і торкніться стіни, де він стоїть", hub: "Торкніться стіни, де вузол або ввід труб", routes: "Торкніться приладу, щоб задати його трасу", select: "Торкніться приладу чи вузла; тягніть уздовж стіни" };
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
    var st = document.createElement("div"); st.className = "note"; st.textContent = "Торкніться приладу на плані — і задайте, де йде його траса. Або «Запропонувати автоматично» як чернетку."; sheet.appendChild(st);
    var all = allRoutes(), conf = all.length && all.every(function (r) { return r.confirmed; });
    sheet.appendChild(row(btn("Запропонувати автоматично", "", build), all.length && !conf ? btn("Підтвердити як фактичні", "p", function () { S.routes.forEach(function (r) { r.confirmed = true; }); Object.keys(S.axes).forEach(function (k) { S.axes[k].confirmed = true; }); commit(); }) : document.createElement("span"), all.length ? btn("Скинути", "d", function () { S.routes = []; S.axes = {}; commit(); }) : document.createElement("span")));
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
    S.routes = res.routes.map(function (r) { return { systemId: r.systemId, fixtureId: r.fixtureId, pts: r.pts, confirmed: false }; });
    commit(); toast(S.routes.length ? "Побудовано чернетку трас" : "Траси не побудовано");
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
  sv.addEventListener("pointerdown", function (e) { var q = pt(e); drag = { q: q, moved: false, h: tool === "select" || tool === "fix" || tool === "hub" ? hit(q) : null }; sv.setPointerCapture(e.pointerId); });
  sv.addEventListener("pointermove", function (e) {
    if (!drag) return; var q = pt(e); if (Math.hypot(q[0] - drag.q[0], q[1] - drag.q[1]) > 8) drag.moved = true;
    if (drag.moved && drag.h && tool === "select") { var n = wallHit(q); if (!n) return; var np = [Math.round(n.q[0]), Math.round(n.q[1])]; if (drag.h.k === "h") S.hub = np; else S.fixtures.forEach(function (f) { if (f.id === drag.h.id) f.p = np; }); sel = drag.h; drag.did = true; render(); }
  });
  sv.addEventListener("pointerup", function (e) {
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
    if (tool === "routes") { if (h && h.k === "f" && S.hub) startDraw(h.id); return; }
    if (tool === "fix" || tool === "select" || tool === "hub") { if (h && (tool === "select" || (tool === "fix" && h.k === "f") || (tool === "hub" && h.k === "h"))) { sel = h; render(); return; } }
    var n = wallHit(q);
    if (tool === "fix" && n) { var t = R.fixType(pickType), f = { id: "f" + S.seq++, type: pickType, p: [Math.round(n.q[0]), Math.round(n.q[1])], base: "a", h: t.h }; S.fixtures.push(f); sel = { k: "f", id: f.id }; geomChanged(); commit(); }
    else if (tool === "hub" && n) { S.hub = [Math.round(n.q[0]), Math.round(n.q[1])]; sel = { k: "h" }; geomChanged(); commit(); }
    else if (tool === "select") { sel = null; render(); }
  });
  document.querySelectorAll("#bar button").forEach(function (b) { b.onclick = function () { tool = b.dataset.tool; if (tool !== "select" && tool !== "fix" && tool !== "hub") sel = null; render(); }; });
  $("undo").onclick = function () { if (hpos > 0) { hpos--; restore(hist[hpos]); } };
  $("redo").onclick = function () { if (hpos < hist.length - 1) { hpos++; restore(hist[hpos]); } };
  $("menu").onclick = function () {
    var b = $("box"); b.innerHTML = "<h3>Меню</h3>"; var ta = document.createElement("textarea"); ta.readOnly = true; ta.value = snap(); b.appendChild(ta);
    var r = row(btn("Скопіювати дані", "p", function () { ta.select(); try { navigator.clipboard.writeText(ta.value); toast("Скопійовано"); } catch (e) { document.execCommand("copy"); } }), btn("Почати знову", "d", function () { S = { room: { W: 3000, D: 2000, features: [] }, fixtures: [], hub: null, routes: [], axes: {}, seq: 1 }; draw = null; sel = null; $("ovl").classList.remove("on"); commit(); }), btn("Закрити", "", function () { $("ovl").classList.remove("on"); })); r.style.marginTop = "10px"; b.appendChild(r); $("ovl").classList.add("on");
  };
  window.addEventListener("resize", render);
  try { var s0 = localStorage.getItem(KEY); if (s0) S = JSON.parse(s0); } catch (e) {}
  window.__S = function () { return S; }; window.__V = function () { return view; };
  hist = [snap()]; hpos = 0; render();
})();
