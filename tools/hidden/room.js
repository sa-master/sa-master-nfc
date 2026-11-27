/* Кімната у вигляді зверху: контур із виступами/нішами/колонами, прилади на стінах, пошук трас парою ХВП/ГВП.
   Одиниці — мм. Система координат: x вправо, y вгору. Контур обходиться проти годинникової стрілки, внутрішня нормаль — ліворуч від напрямку. */
(function (root, f) { var m = f(); if (typeof module === "object" && module.exports) module.exports = m; else { root.HID = root.HID || {}; for (var k in m) root.HID[k] = m[k]; } })(this, function () {
  var G = (typeof require === "function" && typeof module === "object") ? require("./geometry.js") : window.HID;
  var R = {};
  R.PAIR = 15;       // половина відстані між осями ХВП і ГВП, мм (труби впритул; можна змінити)
  R.STEP = 50;       // крок сітки пошуку, мм
  R.CLEAR = 110;     // мінімальна відстань осі пари до стіни, мм

  R.SIDES = {
    S: { n: "Нижня", P0: function () { return [0, 0]; }, u: [1, 0], nn: [0, 1], L: function (W) { return W; }, ends: ["лівого кута", "правого кута"] },
    E: { n: "Права", P0: function (W) { return [W, 0]; }, u: [0, 1], nn: [-1, 0], L: function (W, D) { return D; }, ends: ["нижнього кута", "верхнього кута"] },
    N: { n: "Верхня", P0: function (W, D) { return [W, D]; }, u: [-1, 0], nn: [0, -1], L: function (W) { return W; }, ends: ["правого кута", "лівого кута"] },
    W: { n: "Ліва", P0: function (W, D) { return [0, D]; }, u: [0, -1], nn: [1, 0], L: function (W, D) { return D; }, ends: ["верхнього кута", "нижнього кута"] }
  };
  R.FIX = [
    { id: "wc", name: "Інсталяція унітаза", code: "У", cold: true, hot: false, h: 1000 },
    { id: "sink", name: "Умивальник", code: "В", cold: true, hot: true, h: 850 },
    { id: "shower", name: "Душ", code: "Д", cold: true, hot: true, h: 1100 },
    { id: "bath", name: "Ванна", code: "Н", cold: true, hot: true, h: 600 },
    { id: "washer", name: "Пральна машина", code: "П", cold: true, hot: false, h: 600 },
    { id: "boiler", name: "Бойлер", code: "Б", cold: true, hot: false, h: 1500 },
    { id: "bidet", name: "Біде / гігієнічний душ", code: "Г", cold: true, hot: true, h: 400 },
    { id: "other", name: "Інший прилад", code: "?", cold: true, hot: true, h: 800 }
  ];
  R.fixType = function (id) { return R.FIX.filter(function (t) { return t.id === id; })[0] || R.FIX[R.FIX.length - 1]; };

  function cross(a, b, c) { return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); }
  /* контур кімнати з прямокутника та елементів: виступ/колона біля стіни (bump), ніша (niche); окремі колони (pillar) — перешкоди */
  R.contour = function (room) {
    var W = room.W, D = room.D, pts = [], errors = [];
    if (!(W >= 300 && D >= 300)) errors.push("Розміри кімнати мають бути не менші за 300 мм");
    ["S", "E", "N", "W"].forEach(function (k) {
      var S = R.SIDES[k], P0 = S.P0(W, D), u = S.u, n = S.nn, L = S.L(W, D);
      pts.push(P0.slice());
      var fs = (room.features || []).filter(function (f) { return f.kind !== "pillar" && f.wall === k; }).map(function (f) { return { f: f, s: f.from === "end" ? L - f.off - f.w : f.off }; }).sort(function (a, b) { return a.s - b.s; });
      var last = 0;
      fs.forEach(function (o) {
        var f = o.f, s = o.s, nm = (f.kind === "niche" ? "Ніша" : "Виступ") + " на стіні «" + S.n + "»";
        if (!(f.w > 0 && f.d > 0)) { errors.push(nm + ": ширина й глибина мають бути більшими за 0"); return; }
        if (s < 0 || s + f.w > L) { errors.push(nm + " виходить за межі стіни"); return; }
        if (s < last) { errors.push(nm + " перекривається з іншим"); return; }
        var sg = f.kind === "niche" ? -1 : 1;
        var A = [P0[0] + u[0] * s, P0[1] + u[1] * s], B = [A[0] + n[0] * f.d * sg, A[1] + n[1] * f.d * sg];
        var E = [P0[0] + u[0] * (s + f.w), P0[1] + u[1] * (s + f.w)], C = [E[0] + n[0] * f.d * sg, E[1] + n[1] * f.d * sg];
        pts.push(A, B, C, E); last = s + f.w;
      });
    });
    var out = [], i;
    pts.forEach(function (p) { var q = out[out.length - 1]; if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p); });
    if (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
    var changed = true;
    while (changed && out.length > 3) {
      changed = false;
      for (i = 0; i < out.length; i++) {
        var a = out[(i + out.length - 1) % out.length], b = out[i], c = out[(i + 1) % out.length];
        if (cross(a, b, c) === 0) { out.splice(i, 1); changed = true; break; }
      }
    }
    var ar = 0; for (i = 0; i < out.length; i++) { var p1 = out[i], p2 = out[(i + 1) % out.length]; ar += p1[0] * p2[1] - p2[0] * p1[1]; }
    ar /= 2; if (ar <= 0) errors.push("Контур кімнати некоректний");
    return { pts: out, area: ar, errors: errors };
  };
  R.pillars = function (room) { return (room.features || []).filter(function (f) { return f.kind === "pillar"; }); };
  R.segs = function (pts) {
    return pts.map(function (a, i) {
      var b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return { i: i, a: a, b: b, len: l, u: [dx / l, dy / l], n: [(-dy / l) + 0, (dx / l) + 0] };
    });
  };
  R.nearest = function (pts, p) {
    var segs = R.segs(pts), best = null;
    segs.forEach(function (s) {
      var t = G.clamp(((p[0] - s.a[0]) * s.u[0] + (p[1] - s.a[1]) * s.u[1]), 0, s.len), q = [s.a[0] + s.u[0] * t, s.a[1] + s.u[1] * t], d = G.dist(p, q);
      if (!best || d < best.d) best = { seg: s, q: q, d: d, t: t };
    });
    return best;
  };
  /* відстань від кута сегмента: base 'a' — від початку, 'b' — від кінця */
  R.distFrom = function (seg, q, base) { return Math.round(G.dist(q, base === "a" ? seg.a : seg.b)); };
  R.pointAt = function (seg, base, dist) {
    var t = base === "a" ? dist : seg.len - dist; t = G.clamp(t, 0, seg.len);
    return [Math.round(seg.a[0] + seg.u[0] * t), Math.round(seg.a[1] + seg.u[1] * t)];
  };
  /* праворуч, якщо дивитися на стіну з кімнати (обличчям до стіни) */
  R.rightOf = function (n) { var f = [-n[0], -n[1]]; return [f[1], -f[0]]; };

  /* зсув ламаної вбік на d (додатне — праворуч за напрямком руху), кути — гострими (прямі кути) */
  R.offsetLine = function (pts, d) {
    var n = pts.length, nr = [], i;
    for (i = 0; i < n - 1; i++) { var dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dy) || 1; nr.push([(dy / l) + 0, (-dx / l) + 0]); }
    var out = [];
    for (i = 0; i < n; i++) {
      if (i === 0) out.push([pts[0][0] + nr[0][0] * d, pts[0][1] + nr[0][1] * d]);
      else if (i === n - 1) out.push([pts[i][0] + nr[i - 1][0] * d, pts[i][1] + nr[i - 1][1] * d]);
      else out.push([pts[i][0] + (nr[i - 1][0] + nr[i][0]) * d, pts[i][1] + (nr[i - 1][1] + nr[i][1]) * d]);
    }
    return out.map(function (p) { return [Math.round(p[0]), Math.round(p[1])]; });
  };
  R.clean = function (pts) {
    var o = [];
    pts.forEach(function (p) { var q = o[o.length - 1]; if (!q || q[0] !== p[0] || q[1] !== p[1]) o.push([p[0], p[1]]); });
    var ch = true;
    while (ch && o.length > 2) { ch = false; for (var i = 1; i < o.length - 1; i++) if (cross(o[i - 1], o[i], o[i + 1]) === 0) { o.splice(i, 1); ch = true; break; } }
    return o;
  };

  /* пошук осі пари від вузла до приладу (A*, лише прямі кути, штраф за повороти, дешевше йти по вже прокладеному) */
  function Heap() { this.a = []; }
  Heap.prototype.push = function (f, s) { var a = this.a; a.push([f, s]); var i = a.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; var t = a[p]; a[p] = a[i]; a[i] = t; i = p; } };
  Heap.prototype.pop = function () { var a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; var t = a[m]; a[m] = a[i]; a[i] = t; i = m; } } return top; };
  R.router = function (room) {
    var C = R.contour(room), poly = C.pts, step = R.STEP, pill = R.pillars(room), clear = R.CLEAR;
    var bb = G.bbox(poly), ix0 = Math.floor(bb.x0 / step), iy0 = Math.floor(bb.y0 / step), nx = Math.ceil(bb.x1 / step) - ix0 + 1, ny = Math.ceil(bb.y1 / step) - iy0 + 1;
    var valid = new Uint8Array(nx * ny);
    var segs = R.segs(poly);
    function ok(x, y) {
      if (!G.inPoly([x, y], poly)) return false;
      for (var i = 0; i < segs.length; i++) if (G.distToSeg([x, y], segs[i].a, segs[i].b) < clear) return false;
      for (var j = 0; j < pill.length; j++) { var q = pill[j]; if (x > q.x - clear && x < q.x + q.w + clear && y > q.y - clear && y < q.y + q.h + clear) return false; }
      return true;
    }
    var gy, gx; for (gy = 0; gy < ny; gy++) for (gx = 0; gx < nx; gx++) valid[gy * nx + gx] = ok((ix0 + gx) * step, (iy0 + gy) * step) ? 1 : 0;
    var used = new Float32Array(nx * ny);
    function nearestNode(p, maxR) {
      var cx = Math.round(p[0] / step) - ix0, cy = Math.round(p[1] / step) - iy0, best = null;
      for (var r = 0; r <= (maxR || 12); r++) {
        for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          var x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= nx || y >= ny || !valid[y * nx + x]) continue;
          var d = Math.hypot((x + ix0) * step - p[0], (y + iy0) * step - p[1]); if (!best || d < best.d) best = { x: x, y: y, d: d };
        }
        if (best && r >= 1 && best.d <= r * step) break;
      }
      return best;
    }
    var DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
    function astar(s, t) {
      var N = nx * ny, g = new Float32Array(N * 5).fill(1e9), from = new Int32Array(N * 5).fill(-1), h = new Heap();
      var s0 = (s.y * nx + s.x) * 5 + 4; g[s0] = 0; h.push(0, s0);
      var hh = function (x, y) { return (Math.abs(x - t.x) + Math.abs(y - t.y)) * 0.35; };
      var goal = -1;
      while (h.a.length) {
        var cur = h.pop(), st = cur[1], node = (st / 5) | 0, dir = st % 5, cx = node % nx, cy = (node / nx) | 0;
        if (cur[0] - hh(cx, cy) > g[st] + 1e-6) continue;
        if (cx === t.x && cy === t.y) { goal = st; break; }
        for (var d = 0; d < 4; d++) {
          var x = cx + DX[d], y = cy + DY[d]; if (x < 0 || y < 0 || x >= nx || y >= ny || !valid[y * nx + x]) continue;
          var nn = y * nx + x, c = used[nn] > 0 ? 0.35 : 1; if (dir !== 4 && dir !== d) c += 3;
          var ns = nn * 5 + d, ng = g[st] + c;
          if (ng < g[ns]) { g[ns] = ng; from[ns] = st; h.push(ng + hh(x, y), ns); }
        }
      }
      if (goal < 0) return null;
      var path = [], st2 = goal; while (st2 >= 0) { var nd = (st2 / 5) | 0; path.push([(nd % nx + ix0) * step, ((nd / nx | 0) + iy0) * step]); st2 = from[st2]; }
      return path.reverse();
    }
    return {
      valid: valid, contour: C,
      /* вісь пари: від точки hub до точки p на стіні (з внутрішньою нормаллю n) */
      axis: function (hub, hubN, p, n) {
        var hn = nearestNode(hubN ? [hub[0] + hubN[0] * (clear + 40), hub[1] + hubN[1] * (clear + 40)] : hub, 14), tn = nearestNode([p[0] + n[0] * (clear + 40), p[1] + n[1] * (clear + 40)], 14);
        if (!hn || !tn) return null;
        var path = astar(hn, tn); if (!path) return null;
        path.forEach(function (q) { used[((q[1] / step) - iy0) * nx + ((q[0] / step) - ix0)] = 1; });
        var t = path[path.length - 1], pts = [hub.slice()];
        var h0 = path[0];
        if (hubN) pts.push(Math.abs(hubN[1]) > 0.5 ? [hub[0], h0[1]] : [h0[0], hub[1]]);
        else if (hub[0] !== h0[0] && hub[1] !== h0[1]) pts.push([h0[0], hub[1]]);
        path.forEach(function (q) { pts.push(q); });
        var c = Math.abs(n[1]) > 0.5 ? [p[0], t[1]] : [t[0], p[1]]; pts.push(c); pts.push(p.slice());
        return R.clean(pts);
      }
    };
  };
  /* побудова всіх трас: для кожного приладу ХВП праворуч, ГВП ліворуч (дивлячись на стіну), пара поруч */
  R.buildRoutes = function (room, hub, fixtures) {
    var rt = R.router(room), routes = [], failed = [], poly = rt.contour.pts;
    var hn0 = R.nearest(poly, hub), hubN = null, hubP = hub.slice();
    if (hn0.d <= 5) { hubN = hn0.seg.n; hubP = hn0.q.map(Math.round); }
    var list = fixtures.slice().sort(function (a, b) { return G.dist(a.p, hubP) - G.dist(b.p, hubP); });
    list.forEach(function (fx) {
      var t = R.fixType(fx.type), near = R.nearest(poly, fx.p), n = near.seg.n, p = near.q.map(Math.round);
      if (near.d > 5) { failed.push(fx); return; }
      var axis = rt.axis(hubP, hubN, p, n); if (!axis || axis.length < 2) { failed.push(fx); return; }
      var cold = fx.cold !== false && t.cold !== false ? fx.cold !== false : false, hot = fx.hot !== false && t.hot !== false ? fx.hot !== false : false;
      if (fx.cold === undefined) cold = t.cold; if (fx.hot === undefined) hot = t.hot;
      if (cold && hot) { routes.push({ systemId: "cold", fixtureId: fx.id, pts: R.offsetLine(axis, R.PAIR) }); routes.push({ systemId: "hot", fixtureId: fx.id, pts: R.offsetLine(axis, -R.PAIR) }); }
      else if (cold) routes.push({ systemId: "cold", fixtureId: fx.id, pts: R.offsetLine(axis, R.PAIR) });
      else if (hot) routes.push({ systemId: "hot", fixtureId: fx.id, pts: R.offsetLine(axis, -R.PAIR) });
    });
    return { routes: routes, failed: failed };
  };
  return R;
});
