/* Запуск: node tools/hidden/roomtests.js */
var assert = require("assert"), G = require("./geometry.js"), R = require("./room.js");
var n = 0; function t(name, f) { f(); n++; console.log("ok  " + name); }
t("контур прямокутної кімнати 3000×2000: 4 кути, площа 6 м²", function () { var c = R.contour({ W: 3000, D: 2000, features: [] }); assert.strictEqual(c.pts.length, 4); assert.strictEqual(c.area, 6000000); assert.deepStrictEqual(c.errors, []); });
t("виступ (колона біля стіни) додає 4 кути й зменшує площу", function () {
  var c = R.contour({ W: 3000, D: 2000, features: [{ kind: "bump", wall: "N", from: "start", off: 500, w: 400, d: 300 }] });
  assert.strictEqual(c.pts.length, 8); assert.strictEqual(c.area, 6000000 - 400 * 300);
});
t("ніша збільшує площу", function () {
  var c = R.contour({ W: 3000, D: 2000, features: [{ kind: "niche", wall: "S", from: "end", off: 200, w: 500, d: 150 }] });
  assert.strictEqual(c.area, 6000000 + 500 * 150);
});
t("відлік виступу від правого кута дає ту саму ширину", function () {
  var a = R.contour({ W: 3000, D: 2000, features: [{ kind: "bump", wall: "S", from: "start", off: 2500, w: 500, d: 200 }] }), b = R.contour({ W: 3000, D: 2000, features: [{ kind: "bump", wall: "S", from: "end", off: 0, w: 500, d: 200 }] });
  assert.deepStrictEqual(a.pts, b.pts);
});
t("виступ поза стіною або перекриття дають помилку", function () {
  assert.ok(R.contour({ W: 3000, D: 2000, features: [{ kind: "bump", wall: "S", from: "start", off: 2900, w: 400, d: 200 }] }).errors.length);
  assert.ok(R.contour({ W: 3000, D: 2000, features: [{ kind: "bump", wall: "S", from: "start", off: 100, w: 400, d: 200 }, { kind: "niche", wall: "S", from: "start", off: 300, w: 400, d: 100 }] }).errors.length);
});
t("відстань від кута й назад", function () {
  var c = R.contour({ W: 3000, D: 2000, features: [] }), s = R.segs(c.pts)[0];
  var q = R.pointAt(s, "a", 450); assert.deepStrictEqual(q, [450, 0]); assert.strictEqual(R.distFrom(s, q, "a"), 450); assert.strictEqual(R.distFrom(s, q, "b"), 2550);
  assert.deepStrictEqual(R.pointAt(s, "b", 450), [2550, 0]);
});
t("внутрішня нормаль нижньої стіни дивиться вгору; праворуч (обличчям до стіни) — ліворуч на плані", function () {
  var s = R.segs(R.contour({ W: 3000, D: 2000, features: [] }).pts); assert.deepStrictEqual(s[0].n, [0, 1]);
  var r = R.rightOf(s[0].n); assert.deepStrictEqual([Math.round(r[0]), Math.round(r[1])], [-1, 0]);
});
t("зсув ламаної зберігає прямі кути", function () {
  var o = R.offsetLine([[0, 0], [0, 1000], [1000, 1000]], 75); assert.deepStrictEqual(o, [[75, 0], [75, 925], [1000, 925]]);
});
var room = { W: 3000, D: 2000, features: [{ kind: "pillar", x: 1200, y: 700, w: 400, h: 400 }] };
function sink(id, x, side) { var s = R.segs(R.contour(room).pts)[side]; return { id: id, type: "sink", p: R.pointAt(s, "a", x), base: "a", h: 850 }; }
t("траси: пара йде в обхід колони, лише прямі кути, ХВП праворуч, ГВП ліворуч на кінці біля стіни", function () {
  var hub = [200, 0], fx = [sink("a", 2200, 0), { id: "b", type: "shower", p: [3000, 1300], h: 1100 }];
  var res = R.buildRoutes(room, hub, fx); assert.strictEqual(res.failed.length, 0); assert.strictEqual(res.routes.length, 4);
  res.routes.forEach(function (r) {
    for (var i = 1; i < r.pts.length; i++) assert.ok(r.pts[i][0] === r.pts[i - 1][0] || r.pts[i][1] === r.pts[i - 1][1], "діагональ");
    for (var j = 1; j < r.pts.length; j++) { var a = r.pts[j - 1], b = r.pts[j]; for (var k = 0; k <= 20; k++) { var px = a[0] + (b[0] - a[0]) * k / 20, py = a[1] + (b[1] - a[1]) * k / 20; assert.ok(!(px > 1200 && px < 1600 && py > 700 && py < 1100), "перетин колони " + px + ";" + py); } }
  });
  var a = res.routes.filter(function (r) { return r.fixtureId === "a"; }), cold = a.filter(function (r) { return r.systemId === "cold"; })[0], hot = a.filter(function (r) { return r.systemId === "hot"; })[0];
  var ce = cold.pts[cold.pts.length - 1], he = hot.pts[hot.pts.length - 1];
  assert.strictEqual(ce[1], 0); assert.strictEqual(he[1], 0); assert.strictEqual(he[0] - ce[0], 30); // нижня стіна: праворуч обличчям до стіни = менше x
  var b = res.routes.filter(function (r) { return r.fixtureId === "b"; }), cb = b.filter(function (r) { return r.systemId === "cold"; })[0], hb = b.filter(function (r) { return r.systemId === "hot"; })[0];
  assert.strictEqual(cb.pts[cb.pts.length - 1][0], 3000); assert.ok(cb.pts[cb.pts.length - 1][1] < hb.pts[hb.pts.length - 1][1]); // права стіна: обличчям на схід праворуч = південь (менше y)
});
t("пара йде поруч: відстань між осями ХВП і ГВП на прямих ділянках 30 мм (впритул)", function () {
  var res = R.buildRoutes(room, [200, 0], [sink("a", 2200, 0)]), c = res.routes[0].pts, h = res.routes[1].pts; assert.strictEqual(c.length, h.length);
  for (var i = 1; i < c.length; i++) { if (c[i][0] === c[i - 1][0]) assert.strictEqual(Math.abs(c[i][0] - h[i][0]), 30); else assert.strictEqual(Math.abs(c[i][1] - h[i][1]), 30); }
});
t("вузол біля стіни: траса виходить перпендикулярно стіні", function () {
  var res = R.buildRoutes(room, [200, 0], [sink("a", 2200, 0)]), p = res.routes[0].pts; assert.strictEqual(p[0][1], 0); assert.strictEqual(p[1][0], p[0][0]);
});
t("недосяжний прилад потрапляє в failed", function () {
  var res = R.buildRoutes({ W: 3000, D: 2000, features: [{ kind: "pillar", x: 0, y: 900, w: 3000, h: 200 }] }, [200, 0], [{ id: "z", type: "sink", p: [1500, 2000] }]); assert.strictEqual(res.failed.length, 1);
});
console.log("\nУсього пройшло: " + n);
