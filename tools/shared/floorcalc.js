/* Розрахункове ядро водяної теплої підлоги. Без DOM, щоб його можна було тестувати окремо.
   Формули: L = Σ(Si/hi) + 2·D. Округлення лише для відображення. */
(function (root) {
  "use strict";
  const PIPES = [{ id: "16x2", label: "Ø16×2 мм", rec: 80 }]; // нові діаметри додаються сюди окремими записами
  const STEPS = [100, 150, 200, 250, 300];
  const COILS = [200, 300, 500];
  const EPS = 1e-9;
  const n0 = v => { const x = parseFloat(String(v == null ? "" : v).replace(",", ".")); return Number.isFinite(x) && x > 0 ? x : 0; };

  function validZones(zones) {
    return (zones || []).map(z => ({ area: n0(z.area), step: n0(z.step) })).filter(z => z.area > 0 && z.step > 0);
  }
  function layLength(zones) { return validZones(zones).reduce((s, z) => s + z.area / (z.step / 1000), 0); }

  /* Автоматичний розподіл. dOver[i] це власна відстань контуру i (або null/undefined). */
  function autoContours(zones, dist, maxLen, dOver) {
    const zs = validZones(zones), A = layLength(zs);
    if (!(A > 0)) return [];
    const D = n0(dist), Lmax = n0(maxLen) || 80, ov = dOver || [];
    const dOf = i => (ov[i] != null && ov[i] !== "" && n0(ov[i]) >= 0 && String(ov[i]).trim() !== "" ? n0(ov[i]) : D);
    let n = 0;
    for (let k = 1; k <= 80; k++) {
      let cap = 0; for (let i = 0; i < k; i++) cap += Math.max(0, Lmax - 2 * dOf(i));
      if (cap + EPS >= A) { n = k; break; }
    }
    if (!n) n = Math.max(1, Math.ceil(A / Lmax)); // підведення завеликі: орієнтовно, контури перевищать ліміт
    // вирівнювання довжин ("заливка"): L_i однакова, a_i = L - 2·D_i, не менше нуля
    let active = Array.from({ length: n }, (_, i) => i), lay = new Array(n).fill(0);
    for (let guard = 0; guard < n + 2; guard++) {
      const lvl = (A + active.reduce((s, i) => s + 2 * dOf(i), 0)) / active.length;
      const neg = active.filter(i => lvl - 2 * dOf(i) < 0);
      if (!neg.length) { active.forEach(i => { lay[i] = lvl - 2 * dOf(i); }); break; }
      active = active.filter(i => !neg.includes(i));
      if (!active.length) { lay = new Array(n).fill(A / n); break; }
    }
    return lay.map((a, i) => {
      const f = a / A;
      return { dist: dOf(i), dOver: ov[i] != null && String(ov[i]).trim() !== "" ? ov[i] : "", zones: zs.map(z => ({ area: z.area * f, step: z.step })) };
    });
  }

  function contourInfo(c) {
    const area = validZones(c.zones).reduce((s, z) => s + z.area, 0);
    const lay = layLength(c.zones), feed = 2 * (parseFloat(String(c.dist).replace(",", ".")) > 0 ? parseFloat(String(c.dist).replace(",", ".")) : 0);
    return { area, lay, feed, total: lay + feed };
  }

  function summary(contours, reservePct, maxLen) {
    const Lmax = n0(maxLen) || 80;
    const rows = contours.map(c => { const i = contourInfo(c); return Object.assign(i, { over: i.total > Lmax + EPS }); });
    const calc = rows.reduce((s, r) => s + r.total, 0);
    const P = Math.min(Math.max(parseFloat(reservePct) || 0, 0), 100);
    const reserve = calc * P / 100;
    return { rows, area: rows.reduce((s, r) => s + r.area, 0), calc, reservePct: P, reserve, buy: calc + reserve, Lmax };
  }

  /* Розкрій по бухтах: контур цілий, не розривається; у довжину контуру входить монтажний запас. */
  function packCoils(rows, reservePct, size) {
    const C = n0(size), k = 1 + (parseFloat(reservePct) || 0) / 100;
    const items = rows.map((r, i) => ({ i, need: r.total * k, calc: r.total })).sort((a, b) => b.need - a.need);
    const tooLong = items.filter(x => x.need > C + EPS).map(x => x.i);
    if (!(C > 0) || tooLong.length) return { size: C, ok: false, tooLong, coils: [] };
    const coils = [];
    items.forEach(it => {
      let c = coils.find(c => c.need + it.need <= C + EPS);
      if (!c) { c = { size: C, items: [], need: 0, calc: 0 }; coils.push(c); }
      c.items.push(it.i); c.need += it.need; c.calc += it.calc;
    });
    coils.forEach(c => { c.items.sort((a, b) => a - b); c.reserve = c.need - c.calc; c.left = C - c.need; });
    return { size: C, ok: true, tooLong: [], coils, count: coils.length, left: coils.reduce((s, c) => s + c.left, 0) };
  }
  function bestCoil(rows, reservePct, sizes) {
    let best = null;
    (sizes || COILS).forEach(s => {
      const p = packCoils(rows, reservePct, s); if (!p.ok) return;
      if (!best || p.count < best.count || (p.count === best.count && p.left < best.left - EPS)) best = p;
    });
    return best;
  }

  const api = { PIPES, STEPS, COILS, validZones, layLength, autoContours, contourInfo, summary, packCoils, bestCoil };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.FloorCalc = api;
})(typeof window !== "undefined" ? window : globalThis);
