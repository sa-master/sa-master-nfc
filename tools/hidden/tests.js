/* Запуск: node tools/hidden/tests.js — перевірка математики геометрії, координат і розмірних прив'язок */
var assert = require("assert");
var G = require("./geometry.js"), M = require("./model.js"), D = require("./dims.js");
var n = 0; function t(name, f) { f(); n++; console.log("ok  " + name); }
var O = { mode: "ortho", step: 10, w: 3000, h: 2600, xs: [], ys: [], tol: 12 };

t("polyLen: Г-подібна траса 1200+800=2000", function () { assert.strictEqual(G.polyLen([[450, 0], [450, 1200], [1250, 1200]]), 2000); });
t("place ortho: другу точку прив'язує до осі, крок 10", function () {
  assert.deepStrictEqual(G.place([450, 1000], [1234, 1013], O), [1230, 1000]);
  assert.deepStrictEqual(G.place([450, 1000], [457, 1700], O), [450, 1700]);
});
t("place 45°: довжина по діагоналі кратна кроку, кут рівно 45", function () {
  var p = G.place([1000, 1000], [1500, 1520], Object.assign({}, O, { mode: "45" }));
  assert.strictEqual(p[0] - 1000, p[1] - 1000);
});
t("place: межі поверхні", function () { assert.deepStrictEqual(G.place(null, [-50, 99999], O), [0, 2600]); });
t("place: прив'язка до сусідньої лінії в межах допуску", function () {
  assert.deepStrictEqual(G.place([100, 100], [1003, 100], Object.assign({}, O, { xs: [1000], tol: 12 })), [1000, 100]);
});
t("distToSeg і inPoly", function () {
  assert.strictEqual(G.distToSeg([5, 5], [0, 0], [10, 0]), 5);
  assert.ok(G.inPoly([5, 5], [[0, 0], [10, 0], [10, 10], [0, 10]])); assert.ok(!G.inPoly([15, 5], [[0, 0], [10, 0], [10, 10], [0, 10]]));
});

function sample() {
  var R = M.newReport({ width: 3000, height: 2600 }), sid = R.surfaces[0].id;
  R.elements.push(M.newElement(sid, "route", "cold", [[450, 0], [450, 1400], [1700, 1400]]));
  R.elements.push(M.newElement(sid, "route", "hot", [[700, 0], [700, 1000], [2300, 1000]]));
  R.elements.push(M.newElement(sid, "point", "sewer", [[2500, 400]]));
  return R;
}
t("розміри: значення від лівого краю й низу", function () {
  var R = sample(), d = D.auto(R, R.surfaces[0].id, "optimal");
  var by = function (k) { return d.filter(function (x) { return x.key.indexOf(k) > -1; }); };
  var e0 = R.elements[0].id;
  assert.strictEqual(by(e0 + ":n0:x")[0].value, 450);      // вертикальна ділянка: x від лівого краю
  assert.strictEqual(by(e0 + ":n1:y")[0].value, 1400);     // горизонтальна ділянка: y від низу
  var pt = R.elements[2].id;
  assert.strictEqual(by(pt + ":n0:x")[0].value, 2500); assert.strictEqual(by(pt + ":n0:y")[0].value, 400);
});
t("розміри: база «правий край» дає width − x", function () {
  var R = sample(); R.surfaces[0].bases.x = "right";
  var d = D.auto(R, R.surfaces[0].id, "optimal").filter(function (x) { return x.elementId === R.elements[2].id && x.axis === 0; })[0];
  assert.strictEqual(d.value, 500); assert.deepStrictEqual(d.from, [3000, 400]);
});
t("ручні правки переживають повторне автоформування", function () {
  var R = sample(), sid = R.surfaces[0].id, d1 = D.auto(R, sid, "optimal"), k = d1[0].key;
  R.dimOverrides[k] = { hidden: true };
  var d2 = D.auto(R, sid, "full"), d3 = D.auto(R, sid, "optimal");
  assert.ok(d2.filter(function (x) { return x.key === k; })[0].hidden); assert.ok(d3.filter(function (x) { return x.key === k; })[0].hidden);
  R.dimOverrides[k] = { base: "right" };
  var d4 = D.auto(R, sid, "optimal").filter(function (x) { return x.key === k; })[0];
  assert.strictEqual(d4.base, "right"); assert.strictEqual(d4.value, 3000 - R.elements.filter(function (e) { return e.id === d4.elementId; })[0].pts[d4.node][d4.axis]);
});
t("зміна значення розміру рухає ділянку й зберігає прямі кути", function () {
  var R = sample(), sid = R.surfaces[0].id, e = R.elements[0];
  var d = D.auto(R, sid, "optimal").filter(function (x) { return x.key === e.id + ":n0:x"; })[0];
  D.setValue(R, d, 600);
  assert.deepStrictEqual(e.pts, [[600, 0], [600, 1400], [1700, 1400]]);
});
t("зміна значення при базі «правий край»", function () {
  var R = sample(), sid = R.surfaces[0].id, e = R.elements[2]; R.dimOverrides[e.id + ":n0:x"] = { base: "right" };
  var d = D.auto(R, sid, "optimal").filter(function (x) { return x.key === e.id + ":n0:x"; })[0];
  D.setValue(R, d, 700); assert.strictEqual(e.pts[0][0], 2300);
});
t("масштаб відображення не змінює дані й значення розмірів", function () {
  var R = sample(), sid = R.surfaces[0].id, before = JSON.stringify(R), d = D.auto(R, sid, "optimal");
  [0.05, 0.12, 0.5, 3, 8].forEach(function (k) {
    var L = D.layout(d, R.surfaces[0], k);
    assert.deepStrictEqual(L.map(function (x) { return x.value; }), d.map(function (x) { return x.value; }));
  });
  assert.strictEqual(JSON.stringify(R), before);
});
t("підписи розмірів не накладаються на робочому масштабі", function () {
  var R = sample(), d = D.auto(R, R.surfaces[0].id, "full"), L = D.layout(d, R.surfaces[0], 0.3).filter(function (x) { return !x.hidden; });
  for (var i = 0; i < L.length; i++) for (var j = i + 1; j < L.length; j++) {
    var a = L[i].box, b = L[j].box; assert.ok(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1], "накладання " + i + "/" + j);
  }
});
t("JSON туди й назад: координати ідентичні, схема й id збережені", function () {
  var R = sample(), R2 = JSON.parse(JSON.stringify(R));
  assert.deepStrictEqual(R2, R); assert.strictEqual(R2.schema, 1); R2.elements.forEach(function (e) { assert.ok(e.id); });
});
t("історія: скасувати/повторити повертає точні координати", function () {
  var R = sample(), h = new M.History(10), s0 = JSON.stringify(R);
  h.push(s0); R.elements[0].pts[1][1] = 1500;
  var prev = h.undo(JSON.stringify(R)); assert.strictEqual(prev, s0);
  var redo = h.redo(prev); assert.strictEqual(JSON.parse(redo).elements[0].pts[1][1], 1500);
});
t("перевірка звіту: порожній — помилка; непідтверджені чистові розміри — попередження", function () {
  var R = M.newReport(); assert.ok(M.validate(R).errors.length);
  var S = sample(); var v = M.validate(S); assert.strictEqual(v.errors.length, 0); assert.ok(v.warnings.length);
  S.surfaces[0].finished = true; assert.strictEqual(M.validate(S).warnings.length, 0);
});
console.log("\nУсього пройшло: " + n);
