/* Гідравлічний розрахунок внутрішнього водопроводу квартири за ДБН В.2.5-64:2012.
   Джерела: таблиця А.3 (середні годинні витрати приладів), таблиця А.5 (максимальні секундні витрати),
   п. 11.6 і 12.12 (швидкість), п. 11.7 формула (9) (втрати тиску, kl = 0,3).
   Тлумачення, яких у нормі прямо немає (позначено на сторінці): усереднення годинної витрати для різних приладів,
   інтерполяція в таблиці А.5, питомі втрати за Дарсі–Вейсбахом із типовою шорсткістю, порядок приладів на трійниковій магістралі. */
(function (root) {
  "use strict";
  const A5 = {"N": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30], "q": [4, 6, 8, 10, 12, 14, 16, 18, 20, 23, 26, 30, 35, 40, 45, 50, 55, 60, 70, 80], "total": [[0.22, 0.28, 0.33, 0.39, 0.45, 0.5, 0.55, 0.6, 0.65, 0.71, 0.76, 0.81, 0.86, 0.9, 0.93, 0.95, 0.96, 0.97, 0.98, 0.99], [0.23, 0.29, 0.34, 0.4, 0.46, 0.52, 0.57, 0.62, 0.66, 0.73, 0.78, 0.84, 0.89, 0.93, 0.96, 0.98, 0.99, 1.0, 1.01, 1.02], [0.25, 0.3, 0.36, 0.42, 0.48, 0.54, 0.6, 0.65, 0.7, 0.76, 0.82, 0.88, 0.93, 0.97, 1.0, 1.03, 1.04, 1.05, 1.07, 1.09], [0.26, 0.32, 0.38, 0.44, 0.51, 0.57, 0.62, 0.68, 0.73, 0.8, 0.86, 0.92, 0.98, 1.02, 1.05, 1.08, 1.1, 1.11, 1.13, 1.15], [0.27, 0.33, 0.4, 0.46, 0.53, 0.59, 0.65, 0.71, 0.76, 0.83, 0.89, 0.96, 1.02, 1.07, 1.1, 1.13, 1.15, 1.17, 1.19, 1.21], [0.29, 0.35, 0.41, 0.48, 0.55, 0.62, 0.68, 0.74, 0.79, 0.87, 0.93, 1.0, 1.07, 1.12, 1.15, 1.18, 1.2, 1.22, 1.25, 1.27], [0.3, 0.36, 0.43, 0.5, 0.57, 0.64, 0.71, 0.77, 0.82, 0.9, 0.97, 1.04, 1.11, 1.16, 1.2, 1.23, 1.25, 1.27, 1.3, 1.33], [0.31, 0.38, 0.45, 0.52, 0.59, 0.66, 0.73, 0.79, 0.85, 0.93, 1.0, 1.07, 1.15, 1.2, 1.24, 1.28, 1.3, 1.32, 1.36, 1.39], [0.33, 0.39, 0.46, 0.54, 0.61, 0.68, 0.75, 0.82, 0.88, 0.96, 1.03, 1.11, 1.19, 1.24, 1.29, 1.32, 1.35, 1.37, 1.41, 1.45], [0.34, 0.4, 0.48, 0.55, 0.63, 0.71, 0.78, 0.84, 0.91, 0.99, 1.06, 1.14, 1.22, 1.28, 1.33, 1.36, 1.39, 1.42, 1.46, 1.5], [0.36, 0.43, 0.51, 0.59, 0.67, 0.75, 0.82, 0.89, 0.96, 1.05, 1.12, 1.21, 1.29, 1.36, 1.41, 1.45, 1.48, 1.51, 1.56, 1.61], [0.38, 0.46, 0.54, 0.62, 0.7, 0.78, 0.86, 0.94, 1.01, 1.1, 1.18, 1.27, 1.36, 1.43, 1.48, 1.53, 1.57, 1.6, 1.66, 1.71], [0.4, 0.48, 0.56, 0.65, 0.74, 0.82, 0.9, 0.98, 1.05, 1.15, 1.23, 1.33, 1.42, 1.5, 1.56, 1.61, 1.65, 1.69, 1.75, 1.81], [0.42, 0.5, 0.59, 0.68, 0.77, 0.86, 0.94, 1.02, 1.1, 1.2, 1.29, 1.39, 1.49, 1.57, 1.63, 1.68, 1.73, 1.77, 1.84, 1.91], [0.45, 0.52, 0.61, 0.7, 0.8, 0.89, 0.98, 1.06, 1.14, 1.24, 1.34, 1.44, 1.55, 1.63, 1.7, 1.75, 1.8, 1.85, 1.93, 2.0], [0.47, 0.55, 0.64, 0.73, 0.83, 0.92, 1.01, 1.1, 1.18, 1.29, 1.38, 1.49, 1.6, 1.69, 1.76, 1.82, 1.88, 1.93, 2.01, 2.1], [0.48, 0.57, 0.66, 0.76, 0.86, 0.95, 1.05, 1.14, 1.22, 1.33, 1.43, 1.54, 1.66, 1.75, 1.83, 1.89, 1.95, 2.0, 2.1, 2.19], [0.5, 0.59, 0.68, 0.78, 0.88, 0.98, 1.08, 1.17, 1.26, 1.37, 1.48, 1.59, 1.71, 1.81, 1.89, 1.96, 2.02, 2.08, 2.18, 2.28], [0.52, 0.61, 0.71, 0.81, 0.91, 1.01, 1.11, 1.21, 1.3, 1.42, 1.52, 1.64, 1.77, 1.87, 1.95, 2.03, 2.09, 2.15, 2.26, 2.37], [0.54, 0.63, 0.73, 0.83, 0.94, 1.04, 1.15, 1.24, 1.33, 1.46, 1.57, 1.69, 1.82, 1.93, 2.02, 2.09, 2.16, 2.22, 2.34, 2.46]], "cold": [[0.17, 0.21, 0.26, 0.3, 0.34, 0.39, 0.43, 0.47, 0.5, 0.55, 0.59, 0.63, 0.67, 0.7, 0.72, 0.73, 0.74, 0.75, 0.76, 0.77], [0.18, 0.22, 0.26, 0.31, 0.36, 0.4, 0.44, 0.48, 0.51, 0.56, 0.6, 0.65, 0.69, 0.72, 0.74, 0.76, 0.77, 0.78, 0.79, 0.8], [0.19, 0.23, 0.28, 0.33, 0.37, 0.42, 0.46, 0.5, 0.54, 0.59, 0.63, 0.68, 0.73, 0.76, 0.78, 0.8, 0.81, 0.83, 0.84, 0.85], [0.2, 0.24, 0.29, 0.34, 0.39, 0.44, 0.48, 0.53, 0.57, 0.62, 0.67, 0.72, 0.76, 0.8, 0.82, 0.84, 0.86, 0.87, 0.89, 0.91], [0.21, 0.26, 0.31, 0.36, 0.41, 0.46, 0.51, 0.55, 0.59, 0.65, 0.7, 0.75, 0.8, 0.84, 0.87, 0.89, 0.91, 0.92, 0.94, 0.96], [0.22, 0.27, 0.32, 0.37, 0.43, 0.48, 0.53, 0.57, 0.62, 0.68, 0.73, 0.78, 0.83, 0.87, 0.91, 0.93, 0.95, 0.96, 0.99, 1.01], [0.23, 0.28, 0.33, 0.39, 0.44, 0.5, 0.55, 0.6, 0.64, 0.7, 0.75, 0.81, 0.87, 0.91, 0.94, 0.97, 0.99, 1.01, 1.04, 1.06], [0.24, 0.29, 0.35, 0.4, 0.46, 0.52, 0.57, 0.62, 0.66, 0.73, 0.78, 0.84, 0.9, 0.95, 0.98, 1.01, 1.03, 1.05, 1.08, 1.11], [0.25, 0.3, 0.36, 0.42, 0.48, 0.53, 0.59, 0.64, 0.69, 0.75, 0.81, 0.87, 0.93, 0.98, 1.02, 1.05, 1.07, 1.09, 1.13, 1.16], [0.26, 0.31, 0.37, 0.43, 0.49, 0.55, 0.61, 0.66, 0.71, 0.78, 0.83, 0.9, 0.96, 1.01, 1.05, 1.08, 1.11, 1.13, 1.17, 1.21], [0.28, 0.33, 0.39, 0.46, 0.52, 0.58, 0.64, 0.7, 0.75, 0.82, 0.88, 0.95, 1.02, 1.08, 1.12, 1.16, 1.19, 1.21, 1.26, 1.3], [0.29, 0.35, 0.42, 0.48, 0.55, 0.61, 0.68, 0.73, 0.79, 0.86, 0.93, 1.0, 1.08, 1.14, 1.18, 1.22, 1.26, 1.29, 1.34, 1.39], [0.31, 0.37, 0.44, 0.51, 0.58, 0.64, 0.71, 0.77, 0.83, 0.91, 0.97, 1.05, 1.13, 1.19, 1.25, 1.29, 1.33, 1.36, 1.42, 1.48], [0.33, 0.39, 0.46, 0.53, 0.6, 0.67, 0.74, 0.8, 0.86, 0.95, 1.02, 1.1, 1.18, 1.25, 1.31, 1.35, 1.39, 1.43, 1.5, 1.57], [0.34, 0.41, 0.48, 0.55, 0.63, 0.7, 0.77, 0.84, 0.9, 0.98, 1.06, 1.15, 1.23, 1.31, 1.36, 1.42, 1.46, 1.5, 1.58, 1.65], [0.36, 0.42, 0.5, 0.57, 0.65, 0.73, 0.8, 0.87, 0.93, 1.02, 1.1, 1.19, 1.28, 1.36, 1.42, 1.48, 1.52, 1.57, 1.65, 1.73], [0.37, 0.44, 0.52, 0.59, 0.67, 0.75, 0.83, 0.9, 0.97, 1.06, 1.14, 1.23, 1.33, 1.41, 1.48, 1.54, 1.59, 1.64, 1.73, 1.81], [0.39, 0.46, 0.53, 0.62, 0.7, 0.78, 0.85, 0.93, 1.0, 1.09, 1.18, 1.28, 1.38, 1.46, 1.53, 1.59, 1.65, 1.7, 1.8, 1.89], [0.4, 0.47, 0.55, 0.64, 0.72, 0.8, 0.88, 0.96, 1.03, 1.13, 1.21, 1.32, 1.42, 1.51, 1.58, 1.65, 1.71, 1.77, 1.87, 1.97], [0.42, 0.49, 0.57, 0.66, 0.74, 0.83, 0.91, 0.99, 1.06, 1.16, 1.25, 1.36, 1.47, 1.56, 1.64, 1.71, 1.77, 1.83, 1.94, 2.05]]};
  /* таблиці А.6–А.9: U мешканців -> [q_tot, q_hot, q_cold], л/с, за добовою нормою, л/добу на людину */
  const A69 = {"150": [[1, 0.26, 0.21, 0.16], [4, 0.28, 0.22, 0.17], [8, 0.34, 0.26, 0.21], [12, 0.39, 0.3, 0.24], [16, 0.43, 0.33, 0.27], [20, 0.47, 0.36, 0.3], [24, 0.51, 0.39, 0.33], [28, 0.55, 0.42, 0.36], [32, 0.59, 0.45, 0.39], [36, 0.63, 0.48, 0.41], [40, 0.66, 0.51, 0.44]], "210": [[1, 0.32, 0.24, 0.18], [4, 0.34, 0.25, 0.19], [8, 0.4, 0.29, 0.23], [12, 0.45, 0.33, 0.27], [16, 0.5, 0.36, 0.3], [20, 0.55, 0.39, 0.33], [24, 0.59, 0.42, 0.36], [28, 0.64, 0.46, 0.39], [32, 0.68, 0.48, 0.42], [36, 0.72, 0.51, 0.45], [40, 0.76, 0.54, 0.47]], "250": [[1, 0.35, 0.25, 0.19], [4, 0.37, 0.27, 0.2], [8, 0.44, 0.31, 0.25], [12, 0.5, 0.35, 0.28], [16, 0.55, 0.39, 0.32], [20, 0.6, 0.42, 0.35], [24, 0.65, 0.45, 0.38], [28, 0.7, 0.49, 0.41], [32, 0.74, 0.52, 0.44], [36, 0.78, 0.55, 0.47], [40, 0.82, 0.57, 0.49]], "285": [[1, 0.39, 0.27, 0.21], [4, 0.41, 0.28, 0.22], [8, 0.48, 0.33, 0.26], [12, 0.54, 0.37, 0.3], [16, 0.6, 0.41, 0.34], [20, 0.65, 0.44, 0.37], [24, 0.71, 0.48, 0.4], [28, 0.75, 0.51, 0.43], [32, 0.8, 0.54, 0.46], [36, 0.84, 0.57, 0.49], [40, 0.89, 0.6, 0.52]]};
  /* таблиця А.3, житлові будинки, л/год: [холодна, гаряча] */
  const DEV = {
    bath: { label: "Ванна (змішувач)", c: 9, h: 13, reserve: true },
    shower: { label: "Душ (змішувач)", c: 5, h: 7, reserve: true },
    hyg: { label: "Гігієнічний душ", c: 0.5, h: 0.5 },
    basin: { label: "Умивальник", c: 2, h: 3 },
    sink: { label: "Мийка на кухні", c: 4, h: 6 },
    wc: { label: "Унітаз", c: 4, h: 0 },
    washer: { label: "Пральна машина", c: 50, h: 0 },
    dish: { label: "Посудомийна машина", c: 58, h: 0 }
  };
  const ORDER = ["bath", "shower", "sink", "basin", "hyg", "wc", "washer", "dish"];
  /* матеріали: типорозміри (зовнішній Ø, стінка/опис, внутрішній Ø мм), vmax за п. 11.6 / 12.12, шорсткість k мм (типова) */
  const MAT = {
    pex: { label: "Зшитий поліетилен (PEX / PE-RT)", vc: 2.5, vh: 2.5, k: 0.007, sizes: [[16, "16×2,2", 11.6], [20, "20×2,8", 14.4], [25, "25×3,5", 18], [32, "32×4,4", 23.2]] },
    mp: { label: "Металопластик", vc: 2.5, vh: 2.5, k: 0.007, sizes: [[16, "16×2,0", 12], [20, "20×2,0", 16], [25, "25×2,5", 20], [32, "32×3,0", 26]] },
    ppr20: { label: "Поліпропілен PN20", vc: 2.5, vh: 2.5, k: 0.007, sizes: [[16, "16×2,7", 10.6], [20, "20×3,4", 13.2], [25, "25×4,2", 16.6], [32, "32×5,4", 21.2], [40, "40×6,7", 26.6]] },
    ppr16: { label: "Поліпропілен PN16", vc: 2.5, vh: 2.5, k: 0.007, sizes: [[16, "16×2,2", 11.6], [20, "20×2,8", 14.4], [25, "25×3,5", 18], [32, "32×4,4", 23.2]] },
    cu: { label: "Мідь", vc: 3.0, vh: 2.0, k: 0.0015, sizes: [[15, "15×1,0", 13], [18, "18×1,0", 16], [22, "22×1,0", 20], [28, "28×1,5", 25]] },
    inox: { label: "Нержавійка", vc: 1.5, vh: 1.5, k: 0.015, sizes: [[15, "15×1,0", 13], [18, "18×1,0", 16], [22, "22×1,2", 19.6], [28, "28×1,2", 25.6]] }
  };
  const LIST = ["pex", "mp", "ppr20"]; /* матеріали, які пропонує сторінка; мідь і нержавійка залишені лише для розрахунків */
  const KL = 0.3; /* п. 11.7: питні водопроводи житлових будинків */
  function lerp(x, xs, ys) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    return ys[i] + (ys[i + 1] - ys[i]) * (x - xs[i]) / (xs[i + 1] - xs[i]);
  }
  /* kind: "total" (загальна) або "cold" (холодна або гаряча); N цілий; qbar л/год. Повертає л/с.
     q менше 4 л/год беремо як 4 (у запас), більше 80 як 80; N між рядками таблиці інтерполюємо. */
  function a5(kind, N, qbar) {
    if (N < 1) return 0;
    const tbl = kind === "total" ? A5.total : A5.cold;
    const col = n => lerp(qbar, A5.q, tbl[A5.N.indexOf(n)]);
    if (A5.N.indexOf(N) >= 0) return col(N);
    if (N > A5.N[A5.N.length - 1]) return null;
    let i = 0; while (N > A5.N[i + 1]) i++;
    const a = A5.N[i], b = A5.N[i + 1];
    return col(a) + (col(b) - col(a)) * (N - a) / (b - a);
  }
  function lambda(Re, rel) { /* Swamee–Jain */
    if (Re < 2300) return 64 / Re;
    return 0.25 / Math.pow(Math.log10(rel / 3.7 + 5.74 / Math.pow(Re, 0.9)), 2);
  }
  /* питомі втрати тиску, Па/м, за Дарсі–Вейсбахом; q л/с, d мм, k мм, hot: вода 55 °C, інакше 10 °C */
  function specLoss(q, d, k, hot) {
    const D = d / 1000, v = (q / 1000) / (Math.PI * D * D / 4), nu = hot ? 0.52e-6 : 1.31e-6, rho = hot ? 985 : 1000;
    const Re = v * D / nu, lam = lambda(Re, k / 1000 / D);
    return lam * rho * v * v / (2 * D);
  }
  const vel = (q, d) => (q / 1000) / (Math.PI * (d / 1000) * (d / 1000) / 4);
  function section(name, q, size, mat, hot, len) {
    const m = MAT[mat], d = size[2], vmax = hot ? m.vh : m.vc;
    if (q == null) return { name, q: null, size: size[1], od: size[0], d, v: null, vmax, ok: true, rule: true };
    const v = vel(q, d);
    const s = { name, q, size: size[1], od: size[0], d, v, vmax, ok: v <= vmax };
    if (len > 0) { s.i = specLoss(q, d, m.k, hot); s.dp = s.i * len * (1 + KL); s.len = len; }
    return s;
  }
  /* запас для ванни, душу, бойлера: прохід не менший, ніж у PEX 20×2,8 (внутр. 14,4 мм); для міді й нержавійки це Ø18 */
  const REF_BORE = 14.4;
  function pick(mat, q, hot, minOd, minBore) {
    const m = MAT[mat], vmax = hot ? m.vh : m.vc;
    const list = m.sizes.filter(s => s[0] >= minOd && (!minBore || s[2] >= minBore - 0.05));
    return list.find(s => vel(q, s[2]) <= vmax) || list[list.length - 1];
  }
  function reserveSize(mat) { return MAT[mat].sizes.find(s => s[2] >= REF_BORE - 0.05); }
  /* витрати по мешканцях (таблиці А.6–А.9), інтерполяція по U; U до 40 */
  function byU(norm, U) {
    const rows = A69[String(norm)]; if (!rows || U < 1 || U > 40) return null;
    const us = rows.map(r => r[0]);
    return { tot: lerp(U, us, rows.map(r => r[1])), hot: lerp(U, us, rows.map(r => r[2])), cold: lerp(U, us, rows.map(r => r[3])) };
  }
  const LPM = 1 / 60; /* л/хв -> л/с */
  /* p: { mat, scheme: "ray"|"tee", entry: {mat, od}, U, norm, counts, boiler, flows: {id: л/хв, ...}, lenEntry, lenLine, pIn } */
  function calc(p) {
    const items = [];
    ORDER.forEach(id => { const n = Math.max(0, Math.floor(+((p.counts || {})[id]) || 0)); for (let i = 1; i <= n; i++) items.push({ id, name: n > 1 ? DEV[id].label + " " + i : DEV[id].label, c: DEV[id].c, h: DEV[id].h, reserve: !!DEV[id].reserve }); });
    const out = { items, sections: [], warnings: [], notes: [], lines: [], scheme: p.scheme === "tee" ? "tee" : "ray" };
    const U = Math.floor(+p.U) || 0, norm = +p.norm || 285;
    const q = byU(norm, U);
    if (!q) { out.warnings.push("Кількість мешканців має бути від 1 до 40."); return out; }
    out.q = q; out.U = U; out.norm = norm;
    const mat = p.mat || "pex", em = p.entry || { mat: "pex", od: 25 };
    const eSize = MAT[em.mat].sizes.find(s => s[0] === em.od) || MAT[em.mat].sizes[0];
    const qIn = p.boiler ? q.tot : q.cold;
    const e = section("Ввід", qIn, eSize, em.mat, false, p.lenEntry);
    e.matLabel = MAT[em.mat].label;
    out.sections.push(e);
    if (!e.ok) { const better = pick(em.mat, qIn, false, 0); if (better) out.warnings.push("Ввід " + eSize[1] + " не проходить за швидкістю (" + e.v.toFixed(2).replace(".", ",") + " м/с при межі " + e.vmax + " м/с), підходить " + better[1] + " (" + MAT[em.mat].label + ")."); }
    const flows = p.flows || {}, dist = p.dist || {};
    const lenOf = (id) => (+dist[id] > 0 ? +dist[id] : p.lenLine);
    const lineOf = (x) => {
      const res = { name: x.name, id: x.id, reserve: x.reserve, cold: null, hot: null };
      const fl = flows[x.id] === "" || flows[x.id] == null ? (x.reserve ? null : 5) : +flows[x.id];
      const qd = fl == null ? null : fl * LPM;
      const minOd = x.reserve ? 0 : 16, minB = x.reserve ? REF_BORE : 0;
      const sc = qd == null ? reserveSize(mat) : pick(mat, qd, false, minOd, minB);
      res.len = lenOf(x.id); res.cold = section("Холодна: " + x.name, qd, sc, mat, false, res.len);
      if (x.h > 0) { const sh = qd == null ? reserveSize(mat) : pick(mat, qd, true, minOd, minB); res.hot = section("Гаряча: " + x.name, qd, sh, mat, true, res.len); }
      return res;
    };
    items.forEach(x => out.lines.push(lineOf(x)));
    if (p.boiler) {
      const b = { name: "Бойлер", id: "boiler", boiler: true, reserve: true,
        len: +p.hotDist > 0 ? +p.hotDist : p.lenLine,
        cold: section("До бойлера", q.hot, pick(mat, q.hot, false, 0, REF_BORE), mat, false, +p.hotDist > 0 ? +p.hotDist : p.lenLine),
        hot: section("Від бойлера (ГВП)", q.hot, pick(mat, q.hot, true, 0, REF_BORE), mat, true, +p.hotDist > 0 ? +p.hotDist : p.lenLine) };
      out.lines.push(b);
    }
    if (out.scheme === "tee" && items.length > 1) {
      const all = a5("total", items.length, items.reduce((s, x) => s + x.c + x.h, 0) / items.length);
      for (let k = 1; k < items.length; k++) {
        const rest = items.slice(k), n = rest.length;
        const r = a5("total", n, rest.reduce((s, x) => s + x.c + x.h, 0) / n) / all;
        const qs = qIn * r, sz = pick(mat, qs, false, 0, REF_BORE);
        out.sections.push(section("Магістраль після " + k + "-го відгалуження", qs, sz, mat, false, 0));
      }
    }
    /* ГВП: обʼєм води в трубі від джерела до приладу. ДБН 7.4: не більше 3 л у відгалуженні поза циркуляційним контуром (для централізованого ГВП; для бойлера в квартирі беремо як орієнтир) */
    const S = +p.hotDist > 0 ? +p.hotDist : 0, rec = { limit: RECIRC_L, hotDist: S, items: [] };
    out.lines.forEach(l => {
      if (!l.hot || l.boiler) return;
      const dev = items.find(x => x.id === l.id);
      const L = S + (l.len > 0 ? l.len : 0);
      if (!(L > 0)) return;
      const vol = Math.PI * Math.pow(l.hot.d / 1000 / 2, 2) * L * 1000; /* літри */
      const qd = l.hot.q;
      rec.items.push({ name: l.name, id: l.id, len: L, d: l.hot.d, od: l.hot.od, vol, wait: qd ? vol / qd : null, over: vol > RECIRC_L });
    });
    rec.needed = rec.items.some(x => x.over);
    rec.worst = rec.items.reduce((a, x) => (!a || x.vol > a.vol ? x : a), null);
    if (rec.items.length) out.recirc = rec;
    const hasF = out.lines.some(l => l.cold && l.cold.dp != null);
    if (p.pIn > 0 && p.lenEntry > 0 && hasF) {
      const withDp = out.lines.filter(l => l.cold.dp != null);
      const worst = withDp.reduce((a, l) => (l.cold.dp > a.cold.dp ? l : a), withDp[0]);
      const loss = e.dp + worst.cold.dp;
      out.pressure = { pIn: p.pIn, loss, left: p.pIn * 1e5 - loss, line: worst.name };
    }
    if (p.chain) { const ch = entryChain(p.chain, qIn, e); out.chain = ch; ch.warnings.forEach(w => out.warnings.push(w)); }
    out.notes.push("Лінії ванни, душу й бойлера з проходом не меншим, ніж PEX Ø20 (внутр. 14,4 мм): запас під заміну приладу, рекомендація майстра, не вимога норми. Для міді й нержавійки це Ø18.");
    return out;
  }
  /* порівняння матеріалів: мінімальний ввід за швидкістю, лінія до малого приладу (5 л/хв), запас Ø20 */
  function compare(p) {
    const q = byU(+p.norm || 285, Math.floor(+p.U) || 0); if (!q) return [];
    const qIn = p.boiler ? q.tot : q.cold;
    return LIST.map(k => {
      const m = MAT[k], e = pick(k, qIn, false, 0), ln = pick(k, 5 * LPM, false, 16), rs = reserveSize(k);
      return { mat: k, label: m.label, entry: e[1], entryD: e[2], entryV: vel(qIn, e[2]), line: ln[1], reserve: rs[1], vmax: m.vc };
    });
  }
  /* ввід від забудовника: арматура й лічильник. Прохідні перерізи й Qn типові, не каталожні: звіряти з паспортом */
  const VALVE = { "1/2": { label: '1/2"', bore: 13 }, "3/4": { label: '3/4"', bore: 18 }, "1": { label: '1"', bore: 24 } };
  const METER = { DN15: { label: "DN15", bore: 15, qn: 1.5 }, DN20: { label: "DN20", bore: 20, qn: 2.5 }, DN25: { label: "DN25", bore: 25, qn: 3.5 } };
  const RECIRC_L = 3;
  const VLIM = 2.5; /* м/с, орієнтир для корпусів арматури: норма ДБН задає межі для труб, не для кранів */
  const fm = (x, n) => x.toFixed(n == null ? 2 : n).replace(".", ",");
  /* c: { riser, filter, meter, check, meterIn: "cabinet"|"flat", pipeLen, node: { valve, reducer } }, qIn л/с, e: секція вводу */
  function entryChain(c, qIn, e) {
    c = c || {};
    const warnings = [], notes = [], els = [];
    const rv = VALVE[c.riser] || VALVE["1/2"], nv = VALVE[(c.node || {}).valve] || VALVE["1/2"];
    const push = (type, label, d, extra) => {
      const v = d ? vel(qIn, d) : null;
      const el = Object.assign({ type, label, d, v, status: v == null ? "ok" : v > VLIM ? "bad" : v > 0.8 * VLIM ? "warn" : "ok" }, extra || {});
      els.push(el); return el;
    };
    push("riser", "Кран від стояка " + rv.label, rv.bore, { dev: true });
    if (c.filter) push("filter", "Фільтр", rv.bore, { dev: true });
    if (c.meter && METER[c.meter]) {
      const m = METER[c.meter], qh = qIn * 3.6, ratio = qh / m.qn;
      const el = push("meter", "Лічильник " + m.label, m.bore, { dev: true, qh, qn: m.qn, ratio });
      if (ratio > 2) { el.status = "bad"; warnings.push("Розрахункова витрата " + fm(qh) + " м³/год більша за 2·Qn лічильника " + m.label + " (Qn " + fm(m.qn, 1) + " м³/год, типове значення): лічильник стане вузьким місцем. Звірте з паспортом."); }
      else if (ratio > 1) { if (el.status === "ok") el.status = "warn"; notes.push("Витрата " + fm(qh) + " м³/год перевищує Qn лічильника " + m.label + " (типово " + fm(m.qn, 1) + " м³/год), але в межах короткочасного режиму. Звірте з паспортом."); }
    }
    if (c.check) push("check", "Зворотній клапан", rv.bore, { dev: true });
    push("pipe", "Труба вводу " + (e ? e.size : ""), e ? e.d : null, { od: e ? e.od : null, len: +c.pipeLen > 0 ? +c.pipeLen : null, mat: e ? e.matLabel : "", v: e ? e.v : null, status: e && !e.ok ? "bad" : "ok" });
    push("node", "Кран розподільчого вузла " + nv.label, nv.bore, { dev: true });
    if ((c.node || {}).reducer) push("reducer", "Редуктор і манометр", null);
    /* вузькі місця: перша арматура, що дає швидкість вище орієнтиру */
    els.filter(x => x.dev && x.status === "bad" && x.type !== "meter").forEach(x => {
      warnings.push(x.label + ": швидкість у прохідному перерізі близько " + fm(x.v, 1) + " м/с при витраті " + fm(qIn, 2) + " л/с. Орієнтир " + fm(VLIM, 1) + " м/с, тут можливі шум і втрати тиску.");
    });
    if (rv.bore < 18 && e && e.od >= 25) notes.push("Кран " + rv.label + " від забудовника вужчий за трубу вводу Ø" + e.od + ": він визначає пропускну здатність вводу, а не труба. Замінювати його в стояку майстер не може, тож це обмеження треба врахувати в розрахунку.");
    if (c.meterIn === "cabinet") notes.push("Лічильник у шафі загального користування в коридорі: це відповідає п. 10.8 ДБН (лічильники, фільтри й арматура поза квартирою). Ділянка після лічильника в підлозі квартири ваша зона відповідальності.");
    else if (c.meterIn === "flat") notes.push("Лічильник усередині квартири: доступ до нього й до кранів має бути без розбирання конструкцій (п. 7.9, 10.8).");
    notes.push("Кран на вводі в квартиру передбачено п. 9.7 л. Редуктор з манометром ставиться після запірного крана, вузол обліку без запірних пристроїв між редуктором і фільтром (п. 9.10). Зворотній клапан на вводі в квартиру рекомендовано (п. 9.12, 9.13).");
    notes.push("Труба в підлозі: у гільзі або ізоляції (п. 7.9). Муфта з насувною гільзою під стяжкою нерозʼємне зʼєднання. Перед заливанням стяжки перевірте в інструкції виробника фітингів, що це дозволено, і зробіть випробування тиском до заливання. Якщо інструкція забороняє, зробіть люк або винесіть вузол у доступне місце (п. 7.9, 10.8).");
    notes.push("Прохідні перерізи кранів (1/2\" ≈ 13, 3/4\" ≈ 18, 1\" ≈ 24 мм) і Qn лічильників (DN15 1,5; DN20 2,5; DN25 3,5 м³/год) типові, а не каталожні: це орієнтир, а не вимога ДБН.");
    return { elements: els, warnings, notes, riserDn: rv.label, nodeDn: nv.label };
  }
  const api = { LIST, VALVE, METER, entryChain, A5, A69, DEV, ORDER, MAT, a5, byU, calc, compare, specLoss, vel, pick, reserveSize, KL };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Hydraulics = api;
})(typeof window !== "undefined" ? window : this);
