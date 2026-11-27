/* Прототип редактора (Етап 1). Один екран: окрема поверхня, точки/траси/зони, жести, числове введення,
   автоматичні розміри, скасування/повтор, автозбереження. Стан перегляду (масштаб) не входить у дані. */
(function () {
  "use strict";
  var H = window.HID, $ = function (i) { return document.getElementById(i); };
  var KEY = "hidden-proto-v1";
  var R = null, tool = "select", sysId = "cold", draft = null, sel = null, selDim = null, hiddenSys = {};
  var view = { cx: 0, cy: 0, k: 0.1, auto: true }, hist = new H.History(200), W = 0, HH = 0, cand = null, labels = [], saveT = null, pinch = null, g = { mode: "none" }, ptr = {};
  var stage = $("stage"), sv = $("sv");
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function surf() { return R.surfaces[0]; }
  function sx(x) { return (x - view.cx) * view.k + W / 2; }
  function sy(y) { return (view.cy - y) * view.k + HH / 2; }
  function s2w(p) { return [view.cx + (p[0] - W / 2) / view.k, view.cy - (p[1] - HH / 2) / view.k]; }
  function toast(t) { var el = $("toast"); el.textContent = t; el.className = "on"; clearTimeout(toast.t); toast.t = setTimeout(function () { el.className = ""; }, 2600); }
  function fitK() { var S = surf(); return Math.min((W - 40) / S.width, (HH - 40) / S.height); }
  function fit() { var S = surf(); view.k = Math.max(0.0005, fitK()); view.cx = S.width / 2; view.cy = S.height / 2; }

  /* ---------- збереження ---------- */
  function save() { clearTimeout(saveT); saveT = setTimeout(function () { try { SMStore.setMeta(KEY, R); } catch (e) {} }, 350); }
  function snapshot() { return JSON.stringify(R); }
  function commit(fn) { hist.push(snapshot()); fn(); save(); render(); renderSheet(); buttons(); }
  function restoreFrom(s) { R = JSON.parse(s); draft = null; sel = null; selDim = null; save(); render(); renderSheet(); buttons(); }
  function buttons() {
    $("undo").disabled = !hist.canUndo(); $("redo").disabled = !hist.canRedo();
    var S = surf(); $("title").textContent = S.name + " · " + S.width + "×" + S.height + " мм";
    Array.prototype.forEach.call(document.querySelectorAll("#bar button"), function (b) { b.className = b.dataset.tool === tool ? "on" : ""; });
    renderChips();
    var db = $("draftBar");
    if (draft) { db.className = "on"; $("draftN").textContent = (draft.type === "zone" ? "Зона" : "Траса") + ": " + draft.pts.length + " точок" + (draft.type === "route" && draft.pts.length > 1 ? " · " + Math.round(H.polyLen(draft.pts)) + " мм" : ""); } else db.className = "";
  }
  function renderChips() {
    $("chips").innerHTML = H.LIB.map(function (s) { return '<button class="chip' + (s.id === sysId ? " on" : "") + '" data-s="' + s.id + '"><i style="background:' + s.color + '"></i>' + esc(s.name) + "</button>"; }).join("");
  }

  /* ---------- малювання ---------- */
  function guides() {
    var S = surf(), xs = [0, S.width], ys = [0, S.height];
    R.elements.forEach(function (e) { if (e.surfaceId === S.id) e.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
    if (draft) draft.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); });
    return { xs: xs, ys: ys };
  }
  function placeOpts(mode, skipEl, skipI) {
    var S = surf(), gd = guides();
    if (skipEl) { gd = { xs: [0, S.width], ys: [0, S.height] }; R.elements.forEach(function (e) { e.pts.forEach(function (p, i) { if (e === skipEl && i === skipI) return; gd.xs.push(p[0]); gd.ys.push(p[1]); }); }); }
    return { mode: mode, step: R.settings.grid, w: S.width, h: S.height, xs: gd.xs, ys: gd.ys, tol: 10 / view.k };
  }
  function color(id) { return H.sysOf(id).color; }
  function scene(inLoupe) {
    var S = surf(), k = view.k, o = [], detail = R.settings.detail;
    var x0 = sx(0), x1 = sx(S.width), y0 = sy(S.height), y1 = sy(0);
    o.push('<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" fill="#f8fafc" stroke="#1b2a49" stroke-width="2.5"/>');
    var gs = [50, 100, 200, 500, 1000].filter(function (v) { return v * k >= 22; })[0] || 1000, v;
    for (v = gs; v < S.width; v += gs) o.push('<line x1="' + sx(v) + '" y1="' + y0 + '" x2="' + sx(v) + '" y2="' + y1 + '" stroke="#e3e8ef"/>');
    for (v = gs; v < S.height; v += gs) o.push('<line x1="' + x0 + '" y1="' + sy(v) + '" x2="' + x1 + '" y2="' + sy(v) + '" stroke="#e3e8ef"/>');
    o.push('<text x="' + ((x0 + x1) / 2) + '" y="' + (y0 - 6) + '" font-size="12" fill="#667085" text-anchor="middle">' + S.width + " мм</text>");
    o.push('<text x="' + (x0 - 8) + '" y="' + ((y0 + y1) / 2) + '" font-size="12" fill="#667085" text-anchor="middle" transform="rotate(-90 ' + (x0 - 8) + " " + ((y0 + y1) / 2) + ')">' + S.height + " мм</text>");
    var els = R.elements.filter(function (e) { return e.surfaceId === S.id && !hiddenSys[e.systemId]; });
    els.forEach(function (e) {
      var c = color(e.systemId), pts = e.pts.map(function (p) { return sx(p[0]) + "," + sy(p[1]); }).join(" "), on = sel && sel.id === e.id;
      if (e.type === "zone") o.push('<polygon points="' + pts + '" fill="' + c + '" fill-opacity=".16" stroke="' + c + '" stroke-width="' + (on ? 3 : 2) + '" stroke-dasharray="8 5"/>');
      else if (e.type === "route") { o.push('<polyline points="' + pts + '" fill="none" stroke="#fff" stroke-width="' + (on ? 10 : 8) + '" stroke-linecap="round" stroke-linejoin="round"/>'); o.push('<polyline points="' + pts + '" fill="none" stroke="' + c + '" stroke-width="' + (on ? 6 : 4) + '" stroke-linecap="round" stroke-linejoin="round"/>'); }
      else o.push('<circle cx="' + sx(e.pts[0][0]) + '" cy="' + sy(e.pts[0][1]) + '" r="' + (on ? 10 : 8) + '" fill="' + c + '" stroke="#fff" stroke-width="2.5"/>');
    });
    labels = [];
    if (detail !== "none" || tool === "dims") {
      var dims = H.auto(R, S.id, detail === "none" ? "optimal" : detail).filter(function (d) { var e = R.elements.filter(function (x) { return x.id === d.elementId; })[0]; return e && !hiddenSys[e.systemId]; });
      if (detail === "none") dims = dims.map(function (d) { d.hidden = true; return d; });
      var L = H.layout(dims, S, k), ox = sx(0), oy = sy(S.height);
      L.forEach(function (d) {
        var p1 = [ox + d.from[0] * k, oy + (S.height - d.from[1]) * k], p2 = [ox + d.to[0] * k, oy + (S.height - d.to[1]) * k], on = selDim === d.key;
        if (d.hidden) {
          if (tool !== "dims") return;
          var mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2, bx = [mx - 20, my - 9, mx + 20, my + 9];
          o.push('<text x="' + mx + '" y="' + (my + 4) + '" font-size="12" fill="#98a2b3" text-anchor="middle" font-style="italic">' + d.txt + "</text>");
          labels.push({ key: d.key, box: bx }); return;
        }
        var hz = d.axis === 0, a = hz ? [p1[0], p1[1] + d.off] : [p1[0] + d.off, p1[1]], b = hz ? [p2[0], p2[1] + d.off] : [p2[0] + d.off, p2[1]];
        var col = on ? "#d70015" : "#344054";
        o.push('<g stroke="' + col + '" stroke-width="1" fill="none"><line x1="' + p1[0] + '" y1="' + p1[1] + '" x2="' + a[0] + '" y2="' + a[1] + '" stroke-opacity=".45"/><line x1="' + p2[0] + '" y1="' + p2[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke-opacity=".45"/><line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>' +
          (hz ? '<line x1="' + a[0] + '" y1="' + (a[1] - 4) + '" x2="' + a[0] + '" y2="' + (a[1] + 4) + '"/><line x1="' + b[0] + '" y1="' + (b[1] - 4) + '" x2="' + b[0] + '" y2="' + (b[1] + 4) + '"/>' : '<line x1="' + (a[0] - 4) + '" y1="' + a[1] + '" x2="' + (a[0] + 4) + '" y2="' + a[1] + '"/><line x1="' + (b[0] - 4) + '" y1="' + b[1] + '" x2="' + (b[0] + 4) + '" y2="' + b[1] + '"/>') + "</g>");
        var bx2 = [d.box[0] + ox, d.box[1] + oy, d.box[2] + ox, d.box[3] + oy];
        o.push('<text x="' + ((bx2[0] + bx2[2]) / 2) + '" y="' + (bx2[3] - 4) + '" font-size="13" font-weight="700" fill="' + col + '" text-anchor="middle" stroke="#fff" stroke-width="4" paint-order="stroke">' + d.txt + "</text>");
        labels.push({ key: d.key, box: bx2 });
      });
    }
    if (sel && tool === "select") {
      var e = R.elements.filter(function (x) { return x.id === sel.id; })[0];
      if (e && e.type !== "point") {
        if (e.type === "route") for (var i = 0; i < e.pts.length - 1; i++) { var mx2 = (sx(e.pts[i][0]) + sx(e.pts[i + 1][0])) / 2, my2 = (sy(e.pts[i][1]) + sy(e.pts[i + 1][1])) / 2; o.push('<circle cx="' + mx2 + '" cy="' + my2 + '" r="8" fill="#fff" stroke="#98a2b3" stroke-width="1.5"/><text x="' + mx2 + '" y="' + (my2 + 4.5) + '" font-size="14" text-anchor="middle" fill="#667085">+</text>'); }
        e.pts.forEach(function (p, i) { var on2 = sel.node === i; o.push('<circle cx="' + sx(p[0]) + '" cy="' + sy(p[1]) + '" r="' + (on2 ? 11 : 9) + '" fill="' + (on2 ? color(e.systemId) : "#fff") + '" stroke="' + color(e.systemId) + '" stroke-width="2.5"/>'); });
      }
    }
    if (draft) {
      var c2 = color(draft.systemId), all = draft.pts.slice(); if (cand) all.push(cand);
      var dp = all.map(function (p) { return sx(p[0]) + "," + sy(p[1]); }).join(" ");
      o.push(draft.type === "zone" && all.length > 2 ? '<polygon points="' + dp + '" fill="' + c2 + '" fill-opacity=".12" stroke="' + c2 + '" stroke-width="2" stroke-dasharray="6 4"/>' : '<polyline points="' + dp + '" fill="none" stroke="' + c2 + '" stroke-width="3" stroke-dasharray="6 4" stroke-linecap="round"/>');
      draft.pts.forEach(function (p) { o.push('<circle cx="' + sx(p[0]) + '" cy="' + sy(p[1]) + '" r="5" fill="' + c2 + '" stroke="#fff" stroke-width="2"/>'); });
    }
    if (cand) {
      var cc = color(draft ? draft.systemId : sysId);
      o.push('<circle cx="' + sx(cand[0]) + '" cy="' + sy(cand[1]) + '" r="6" fill="none" stroke="' + cc + '" stroke-width="2.5"/>');
      if (!inLoupe) o.push('<text x="' + (sx(cand[0]) + 10) + '" y="' + (sy(cand[1]) - 10) + '" font-size="12" font-weight="700" fill="#1b2a49" stroke="#fff" stroke-width="4" paint-order="stroke">' + cand[0] + " ; " + cand[1] + "</text>");
    }
    return o.join("");
  }
  function render() { sv.setAttribute("viewBox", "0 0 " + W + " " + HH); sv.innerHTML = scene(); }
  function showLoupe(p) {
    var lp = $("loupe"), c = cand ? [sx(cand[0]), sy(cand[1])] : p, y = p[1] - 150, x = Math.max(4, Math.min(W - 132, p[0] - 64));
    if (y < 4) y = p[1] + 40;
    lp.style.display = "block"; lp.style.left = x + "px"; lp.style.top = y + "px";
    lp.innerHTML = '<svg viewBox="' + (c[0] - 28) + " " + (c[1] - 28) + ' 56 56" xmlns="http://www.w3.org/2000/svg">' + scene(true) + '<g stroke="#d70015" stroke-width=".5"><line x1="' + (c[0] - 28) + '" y1="' + c[1] + '" x2="' + (c[0] + 28) + '" y2="' + c[1] + '"/><line x1="' + c[0] + '" y1="' + (c[1] - 28) + '" x2="' + c[0] + '" y2="' + (c[1] + 28) + '"/></g></svg>';
  }
  function hideLoupe() { $("loupe").style.display = "none"; }

  /* ---------- вибір і виділення ---------- */
  function selEl() { return sel ? R.elements.filter(function (e) { return e.id === sel.id; })[0] : null; }
  function hitHandle(p) {
    var e = selEl(); if (!e || e.type === "point") return null;
    for (var i = 0; i < e.pts.length; i++) if (Math.hypot(sx(e.pts[i][0]) - p[0], sy(e.pts[i][1]) - p[1]) < 22) return { type: "node", i: i };
    if (e.type === "route") for (var j = 0; j < e.pts.length - 1; j++) if (Math.hypot((sx(e.pts[j][0]) + sx(e.pts[j + 1][0])) / 2 - p[0], (sy(e.pts[j][1]) + sy(e.pts[j + 1][1])) / 2 - p[1]) < 18) return { type: "mid", i: j };
    return null;
  }
  function hitElement(p) {
    var S = surf(), best = null, bd = 18;
    R.elements.forEach(function (e) {
      if (e.surfaceId !== S.id || hiddenSys[e.systemId]) return;
      var sp = e.pts.map(function (q) { return [sx(q[0]), sy(q[1])]; }), d = 1e9;
      if (e.type === "point") d = Math.hypot(sp[0][0] - p[0], sp[0][1] - p[1]);
      else { for (var i = 0; i < sp.length - (e.type === "route" ? 1 : 0); i++) d = Math.min(d, H.distToSeg(p, sp[i], sp[(i + 1) % sp.length])); if (e.type === "zone" && H.inPoly(p, sp)) d = Math.min(d, 17); }
      if (d <= bd) { bd = d; best = e; }
    });
    return best;
  }

  /* ---------- шторка властивостей ---------- */
  function renderSheet() {
    var sh = $("sheet"), h = "", S = surf();
    if (tool === "select" && sel && selEl()) {
      var e = selEl(), p = sel.node != null ? e.pts[sel.node] : (e.type === "point" ? e.pts[0] : null), nm = e.type === "route" ? "Траса" : e.type === "zone" ? "Зона" : "Точка";
      h += '<div class="row"><label>' + nm + ': система<select id="shSys">' + H.LIB.map(function (s) { return '<option value="' + s.id + '"' + (s.id === e.systemId ? " selected" : "") + ">" + esc(s.name) + "</option>"; }).join("") + '</select></label><button class="btn" id="shDup">Дублювати</button><button class="btn d" id="shDel">Видалити</button></div>';
      if (p) h += '<div class="row"><label>X, мм<input id="shX" type="number" inputmode="numeric" value="' + p[0] + '"></label><label>Y, мм<input id="shY" type="number" inputmode="numeric" value="' + p[1] + '"></label>' + (e.type !== "point" && e.pts.length > (e.type === "zone" ? 3 : 2) ? '<button class="btn d" id="shDelN">Вузол ✕</button>' : "") + "</div>";
      else if (e.type !== "point") h += '<div class="row" style="color:#667085;font-size:13px">Торкнись вузла (кружка) на кресленні, щоб ввести координати. «+» посередині ділянки додає вузол.</div>';
      h += '<div class="row"><label>Зсунути елемент: Δx, мм<input id="shDx" type="number" inputmode="numeric" value="0"></label><label>Δy, мм<input id="shDy" type="number" inputmode="numeric" value="0"></label><button class="btn" id="shMove">Зсунути</button></div>';
      if (e.type === "route") h += '<div style="font-size:12px;color:#667085">Геометрична довжина на кресленні: ' + Math.round(H.polyLen(e.pts)) + " мм. Це не гарантований метраж змонтованої труби чи кабелю.</div>";
      sh.className = "on";
    } else if (tool === "dims" && selDim) {
      var d = H.auto(R, S.id, R.settings.detail === "none" ? "optimal" : R.settings.detail).filter(function (x) { return x.key === selDim; })[0], ov = R.dimOverrides[selDim] || {};
      if (!d) { selDim = null; sh.className = ""; sh.innerHTML = ""; return; }
      var opts = d.axis === 0 ? [["left", "від лівого краю"], ["right", "від правого краю"]] : [["bottom", "від низу"], ["top", "від верху"]];
      h += '<div class="row"><label>Розмір, мм (зміна рухає елемент)<input id="dmV" type="number" inputmode="numeric" value="' + Math.round(d.value) + '"></label><label>База відліку<select id="dmB">' + opts.map(function (b) { return '<option value="' + b[0] + '"' + (b[0] === d.base ? " selected" : "") + ">" + b[1] + "</option>"; }).join("") + '</select></label></div>';
      h += '<div class="row"><button class="btn" id="dmH">' + (ov.hidden ? "Показати розмір" : "Сховати розмір") + '</button><button class="btn" id="dmR">Скинути правки</button></div>';
      sh.className = "on";
    } else sh.className = "";
    sh.innerHTML = h;
    ensureVisible();
  }
  /* якщо шторка закриває вибраний вузол чи розмір, зсуваємо вигляд (дані не змінюються) */
  function ensureVisible() {
    var sh = $("sheet"); if (sh.className !== "on") return;
    var limit = HH - sh.offsetHeight - 24, ty = null, e = selEl(), S = surf();
    if (tool === "select" && e) { var pts = sel.node != null ? [e.pts[sel.node]] : e.pts; ty = Math.max.apply(null, pts.map(function (p) { return sy(p[1]); })); }
    else if (tool === "dims" && selDim) { labels.forEach(function (l) { if (l.key === selDim) ty = (l.box[1] + l.box[3]) / 2; }); }
    if (ty != null && ty > limit) { view.cy -= (ty - limit + 30) / view.k; view.auto = false; render(); }
  }
  $("sheet").addEventListener("change", function (ev) {
    var id = ev.target.id, e = selEl(), v;
    if (id === "shSys") commit(function () { e.systemId = ev.target.value; });
    else if (id === "shX" || id === "shY") {
      var S = surf(), ax = id === "shX" ? 0 : 1, i = sel.node != null ? sel.node : 0; v = Math.round(+ev.target.value);
      if (isNaN(v)) return; v = H.clamp(v, 0, ax ? S.height : S.width);
      if (e.pts[i][ax] === v) return;
      commit(function () { if (e.type === "route") H.moveCoord(e, i, ax, v); else e.pts[i][ax] = v; });
    } else if (id === "dmV") { v = +ev.target.value; if (isNaN(v) || v < 0) return; var d = curDim(); if (Math.round(d.value) === Math.round(v)) return; commit(function () { H.setValue(R, d, v); }); }
    else if (id === "dmB") commit(function () { R.dimOverrides[selDim] = Object.assign({}, R.dimOverrides[selDim], { base: ev.target.value }); });
  });
  $("sheet").addEventListener("click", function (ev) {
    var id = ev.target.id, e = selEl(), S = surf();
    if (id === "shDel") commit(function () { R.elements = R.elements.filter(function (x) { return x.id !== e.id; }); sel = null; });
    else if (id === "shDup") commit(function () { var c = H.newElement(e.surfaceId, e.type, e.systemId, e.pts.map(function (p) { return [H.clamp(p[0] + 100, 0, S.width), H.clamp(p[1] + 100, 0, S.height)]; })); R.elements.push(c); sel = { id: c.id, node: null }; });
    else if (id === "shDelN") commit(function () { e.pts.splice(sel.node, 1); sel.node = null; });
    else if (id === "shMove") { var dx = Math.round(+$("shDx").value || 0), dy = Math.round(+$("shDy").value || 0); commit(function () { e.pts.forEach(function (p) { p[0] = H.clamp(p[0] + dx, 0, S.width); p[1] = H.clamp(p[1] + dy, 0, S.height); }); }); }
    else if (id === "dmH") commit(function () { var o = R.dimOverrides[selDim] || {}; R.dimOverrides[selDim] = Object.assign({}, o, { hidden: !o.hidden }); });
    else if (id === "dmR") commit(function () { delete R.dimOverrides[selDim]; });
  });
  function curDim() { return H.auto(R, surf().id, R.settings.detail === "none" ? "optimal" : R.settings.detail).filter(function (x) { return x.key === selDim; })[0]; }

  /* ---------- жести ---------- */
  function local(e) { var r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function updateCand(p) {
    var w = s2w(p), prev = tool !== "point" && draft && draft.pts.length ? draft.pts[draft.pts.length - 1] : null;
    cand = H.place(prev, w, placeOpts(R.settings.angle));
  }
  function startPinch() {
    var ids = Object.keys(ptr), a = ptr[ids[0]], b = ptr[ids[1]];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    g = { mode: "pinch" }; cand = null; hideLoupe(); render();
  }
  function doPinch() {
    var ids = Object.keys(ptr); if (ids.length < 2) return;
    var a = ptr[ids[0]], b = ptr[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, m = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    var w = s2w([pinch.mx, pinch.my]), k2 = H.clamp(view.k * d / pinch.d, fitK() * 0.3, 12);
    view.k = k2; view.cx = w[0] - (m[0] - W / 2) / k2; view.cy = w[1] + (m[1] - HH / 2) / k2; view.auto = false;
    pinch = { d: d, mx: m[0], my: m[1] }; render();
  }
  ["draftBar", "sheet"].forEach(function (id) { ["pointerdown", "pointermove", "pointerup", "wheel"].forEach(function (t) { $(id).addEventListener(t, function (ev) { ev.stopPropagation(); }); }); });
  stage.addEventListener("pointerdown", function (ev) {
    ev.preventDefault(); try { stage.setPointerCapture(ev.pointerId); } catch (x) {}
    var p = local(ev); ptr[ev.pointerId] = { x: p[0], y: p[1] };
    var n = Object.keys(ptr).length;
    if (n === 2) { startPinch(); return; } if (n > 2) return;
    g = { mode: "tap", sx: p[0], sy: p[1], lx: p[0], ly: p[1], moved: false };
    if (tool === "route" || tool === "point" || tool === "zone") { g.mode = "place"; updateCand(p); render(); showLoupe(p); }
    else if (tool === "select") {
      var h = sel && hitHandle(p);
      if (h && h.type === "node") { g.mode = "node"; g.i = h.i; g.snap = snapshot(); sel.node = h.i; }
      else if (h && h.type === "mid") { g.mode = "mid"; g.i = h.i; }
    }
  });
  stage.addEventListener("pointermove", function (ev) {
    var q = ptr[ev.pointerId]; if (!q) return;
    var p = local(ev); q.x = p[0]; q.y = p[1];
    if (pinch) { doPinch(); return; }
    if (g.mode === "place") { updateCand(p); render(); showLoupe(p); return; }
    if (g.mode === "node") {
      if (!g.moved && Math.hypot(p[0] - g.sx, p[1] - g.sy) < 5) return;
      g.moved = true; var e = selEl(), w = s2w(p);
      e.pts[g.i] = H.place(null, w, placeOpts("free", e, g.i)); render(); renderSheetValues(); return;
    }
    if ((g.mode === "tap" || g.mode === "mid") && Math.hypot(p[0] - g.sx, p[1] - g.sy) > 8) g.mode = "pan";
    if (g.mode === "pan") { view.cx -= (p[0] - g.lx) / view.k; view.cy += (p[1] - g.ly) / view.k; view.auto = false; g.lx = p[0]; g.ly = p[1]; render(); }
  });
  function renderSheetValues() { var e = selEl(); if (!e || sel.node == null) return; var x = $("shX"), y = $("shY"); if (x) x.value = e.pts[sel.node][0]; if (y) y.value = e.pts[sel.node][1]; }
  function endPtr(ev, cancelled) {
    var q = ptr[ev.pointerId]; if (!q) return; var p = local(ev); delete ptr[ev.pointerId];
    if (pinch) { if (Object.keys(ptr).length < 2) pinch = null; g = { mode: "none" }; return; }
    var mode = g.mode, moved = g.moved, snap0 = g.snap; g = { mode: "none" }; hideLoupe();
    if (mode === "place") { var c = cand; cand = null; if (!cancelled && c) addCand(c); else render(); return; }
    if (mode === "node") {
      if (moved && snap0) { hist.push(snap0); save(); buttons(); }
      renderSheet(); render(); return;
    }
    if (!cancelled && (mode === "tap" || mode === "mid")) doTap(p, mode === "mid");
  }
  stage.addEventListener("pointerup", function (ev) { endPtr(ev, false); });
  stage.addEventListener("pointercancel", function (ev) { endPtr(ev, true); });
  stage.addEventListener("wheel", function (ev) {
    ev.preventDefault(); var p = local(ev), w = s2w(p), f = ev.deltaY < 0 ? 1.15 : 1 / 1.15, k2 = H.clamp(view.k * f, fitK() * 0.3, 12);
    view.k = k2; view.cx = w[0] - (p[0] - W / 2) / k2; view.cy = w[1] + (p[1] - HH / 2) / k2; view.auto = false; render();
  }, { passive: false });
  function addCand(c) {
    if (tool === "point") { commit(function () { var e = H.newElement(surf().id, "point", sysId, [c]); R.elements.push(e); }); return; }
    if (!draft) draft = { type: tool, systemId: sysId, pts: [] };
    var last = draft.pts[draft.pts.length - 1];
    if (!last || last[0] !== c[0] || last[1] !== c[1]) draft.pts.push(c);
    buttons(); render();
  }
  function doTap(p, isMid) {
    if (tool === "select") {
      var h = sel && hitHandle(p);
      if (h && h.type === "mid") { var e0 = selEl(), a = e0.pts[h.i], b = e0.pts[h.i + 1]; commit(function () { e0.pts.splice(h.i + 1, 0, [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)]); sel.node = h.i + 1; }); return; }
      if (h && h.type === "node") { sel.node = h.i; renderSheet(); render(); return; }
      var e = hitElement(p); sel = e ? { id: e.id, node: e.type === "point" ? 0 : null } : null; renderSheet(); render(); return;
    }
    if (tool === "dims") {
      var hit = null; labels.forEach(function (l) { if (p[0] >= l.box[0] - 6 && p[0] <= l.box[2] + 6 && p[1] >= l.box[1] - 6 && p[1] <= l.box[3] + 6) hit = l; });
      selDim = hit ? hit.key : null; renderSheet(); render();
    }
  }

  /* ---------- панель чернетки, інструменти ---------- */
  function finishDraft(silent) {
    if (!draft) return true;
    var need = draft.type === "zone" ? 3 : 2;
    if (draft.pts.length < need) { if (!silent) toast((draft.type === "zone" ? "Зона" : "Траса") + ": треба щонайменше " + need + " точки"); return false; }
    var d = draft; commit(function () { R.elements.push(H.newElement(surf().id, d.type, d.systemId, d.pts)); }); draft = null; cand = null; buttons(); render(); return true;
  }
  $("dDone").addEventListener("click", function () { finishDraft(false); });
  $("dCancel").addEventListener("click", function () { draft = null; cand = null; buttons(); render(); });
  $("dUndo").addEventListener("click", function () { if (draft) { draft.pts.pop(); if (!draft.pts.length) draft = null; buttons(); render(); } });
  $("bar").addEventListener("click", function (ev) {
    var b = ev.target.closest("button"); if (!b) return;
    if (draft && !finishDraft(true)) draft = null;
    tool = b.dataset.tool; sel = tool === "select" ? sel : null; selDim = null; cand = null; hideLoupe(); buttons(); renderSheet(); render();
  });
  $("chips").addEventListener("click", function (ev) { var b = ev.target.closest("[data-s]"); if (!b) return; sysId = b.dataset.s; if (draft && draft.pts.length === 0) draft.systemId = sysId; buttons(); });
  $("undo").addEventListener("click", function () { var s = hist.undo(snapshot()); if (s) restoreFrom(s); });
  $("redo").addEventListener("click", function () { var s = hist.redo(snapshot()); if (s) restoreFrom(s); });

  /* ---------- діалоги ---------- */
  function openBox(html) { $("box").innerHTML = html; $("ovl").className = "on"; }
  function closeBox() { $("ovl").className = ""; }
  $("ovl").addEventListener("click", function (ev) { if (ev.target.id === "ovl" || ev.target.dataset.close) closeBox(); });
  function surfaceDialog(isNew) {
    var S = surf();
    openBox('<h3>' + (isNew ? "Нова поверхня" : "Поверхня") + '</h3><div class="row"><label>Назва<input id="sName" value="' + esc(S.name) + '"></label></div>' +
      '<div class="row"><label>Тип<select id="sKind">' + [["wall", "Стіна"], ["floor", "Підлога"], ["ceiling", "Стеля"], ["free", "Інша поверхня"]].map(function (k) { return '<option value="' + k[0] + '"' + (S.kind === k[0] ? " selected" : "") + ">" + k[1] + "</option>"; }).join("") + "</select></label></div>" +
      '<div class="row"><label>Ширина, мм<input id="sW" type="number" inputmode="numeric" value="' + S.width + '"></label><label>Висота / глибина, мм<input id="sH" type="number" inputmode="numeric" value="' + S.height + '"></label></div>' +
      '<div class="row"><label>База по горизонталі<select id="sBx"><option value="left"' + (S.bases.x === "left" ? " selected" : "") + '>від лівого краю</option><option value="right"' + (S.bases.x === "right" ? " selected" : "") + '>від правого краю</option></select></label><label>База по вертикалі<select id="sBy"><option value="bottom"' + (S.bases.y === "bottom" ? " selected" : "") + '>від низу (чистової підлоги)</option><option value="top"' + (S.bases.y === "top" ? " selected" : "") + '>від верху</option></select></label></div>' +
      '<div class="row"><label style="flex-direction:row;align-items:center;gap:8px;font-size:14px;color:var(--t);font-weight:600"><input id="sFin" type="checkbox" style="width:22px;height:22px"' + (S.finished ? " checked" : "") + '>Розміри відраховано від чистових поверхонь</label></div>' +
      '<div class="row"><button class="btn" data-close="1">Скасувати</button><button class="btn p" id="sOk" style="flex:1">Готово</button></div>');
    $("sOk").onclick = function () {
      var w = Math.round(+$("sW").value), h = Math.round(+$("sH").value);
      if (!(w >= 100 && h >= 100)) { toast("Розміри мають бути не менші за 100 мм"); return; }
      var apply = function () { var s = surf(); s.name = $("sName").value.trim() || "Поверхня"; s.kind = $("sKind").value; s.width = w; s.height = h; s.bases = { x: $("sBx").value, y: $("sBy").value }; s.finished = $("sFin").checked; };
      if (isNew) { apply(); save(); } else commit(apply);
      if (view.auto) fit(); closeBox(); buttons(); render();
    };
  }
  $("title").addEventListener("click", function () { surfaceDialog(false); });
  $("menu").addEventListener("click", function () {
    var used = {}; H.LIB.forEach(function (s) { used[s.id] = 1; });
    openBox('<h3>Меню</h3><div class="row"><label>Розмірні лінії<select id="mDetail">' + [["none", "Без розмірів"], ["minimal", "Мінімум"], ["optimal", "Оптимально"], ["full", "Повна деталізація"]].map(function (o) { return '<option value="' + o[0] + '"' + (R.settings.detail === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label>" +
      '<label>Кути<select id="mAngle">' + [["ortho", "Лише 0° / 90°"], ["45", "Кратні 45°"], ["free", "Довільні"]].map(function (o) { return '<option value="' + o[0] + '"' + (R.settings.angle === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label></div>" +
      '<div class="row"><label>Крок сітки, мм<select id="mGrid">' + [1, 5, 10, 50, 100].map(function (v) { return '<option' + (R.settings.grid === v ? " selected" : "") + ">" + v + "</option>"; }).join("") + "</select></label></div>" +
      '<div style="font-weight:700;font-size:13px;margin:6px 0">Показувати системи</div><div class="row">' + H.LIB.map(function (s) { return '<label style="flex-direction:row;align-items:center;gap:6px;min-width:150px;color:var(--t);font-size:13px"><input type="checkbox" style="width:20px;height:20px" data-vis="' + s.id + '"' + (hiddenSys[s.id] ? "" : " checked") + '><span style="width:10px;height:10px;border-radius:50%;background:' + s.color + '"></span>' + esc(s.name) + "</label>"; }).join("") + "</div>" +
      '<div class="row"><button class="btn" id="mCheck">Перевірка звіту</button><button class="btn" id="mCopy">Копіювати дані</button><button class="btn" id="mFit">Показати все</button></div>' +
      '<div class="row"><button class="btn d" id="mNew">Нова поверхня (очистити все)</button><button class="btn p" data-close="1" style="margin-left:auto">Закрити</button></div><div id="mOut" style="font-size:13px;color:#344054;white-space:pre-wrap"></div>');
    $("mDetail").onchange = function () { R.settings.detail = this.value; save(); render(); };
    $("mAngle").onchange = function () { R.settings.angle = this.value; save(); };
    $("mGrid").onchange = function () { R.settings.grid = +this.value; save(); };
    Array.prototype.forEach.call(document.querySelectorAll("[data-vis]"), function (c) { c.onchange = function () { hiddenSys[c.dataset.vis] = !c.checked; render(); }; });
    $("mFit").onclick = function () { view.auto = true; fit(); render(); closeBox(); };
    $("mCheck").onclick = function () { var v = H.validate(R); $("mOut").textContent = (v.errors.length ? "Критичні помилки:\n• " + v.errors.join("\n• ") + "\n" : "Критичних помилок немає.\n") + (v.warnings.length ? "Попередження:\n• " + v.warnings.join("\n• ") : "Попереджень немає."); };
    $("mCopy").onclick = function () { var s = JSON.stringify(R, null, 1); if (navigator.clipboard) navigator.clipboard.writeText(s).then(function () { toast("Дані скопійовано"); }, function () { $("mOut").textContent = s; }); else $("mOut").textContent = s; };
    $("mNew").onclick = function () { if (confirm("Очистити все й почати нову поверхню?")) { R = H.newReport(); hist = new H.History(200); draft = null; sel = null; selDim = null; save(); closeBox(); view.auto = true; fit(); buttons(); renderSheet(); render(); surfaceDialog(true); } };
  });

  /* ---------- запуск ---------- */
  function measure() { var r = stage.getBoundingClientRect(); W = Math.max(100, Math.round(r.width)); HH = Math.max(100, Math.round(r.height)); if (view.auto && R) fit(); if (R) render(); }
  if (window.ResizeObserver) new ResizeObserver(measure).observe(stage); window.addEventListener("resize", measure); window.addEventListener("orientationchange", function () { setTimeout(measure, 150); });
  window.addEventListener("pagehide", function () { try { SMStore.setMeta(KEY, R); } catch (e) {} });
  function init(saved) {
    var fresh = !(saved && saved.schema === 1 && saved.surfaces && saved.surfaces.length);
    R = fresh ? H.newReport() : saved; R.dimOverrides = R.dimOverrides || {}; R.settings = Object.assign({ detail: "optimal", angle: "ortho", grid: 10 }, R.settings);
    measure(); fit(); buttons(); renderSheet(); render();
    if (fresh) surfaceDialog(true);
    window.__hid = { get R() { return R; }, get view() { return view; }, get tool() { return tool; } };
  }
  var done = false;
  function go(s) { if (done) return; done = true; init(s); }
  try { Promise.resolve(SMStore.getMeta(KEY)).then(go, function () { go(null); }); } catch (e) { go(null); }
  setTimeout(function () { go(null); }, 1500);
})();
