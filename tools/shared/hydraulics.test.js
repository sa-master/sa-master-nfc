/* Тести ядра «Попередній підбір діаметрів труб водопостачання». Запуск: node tools/shared/hydraulics.test.js
   Кожен контрольний сценарій виводить вхід, очікуване, фактичне і статус. */
const H = require("./hydraulics.js"), FIX = require("./a5.fixture.json").rows;
let ok = 0, bad = 0; const rows = [];
const t = (n, c, exp, act) => { if (!c) { bad++; console.log("FAIL", n, exp !== undefined ? "| очікувалось: " + exp + " | отримано: " + act : ""); } else ok++; if (exp !== undefined) rows.push([n, exp, act, c ? "OK" : "FAIL"]); };
const near = (a, b, e = 0.005) => Math.abs(a - b) <= e;
const f = (x, n = 3) => (typeof x === "number" ? x.toFixed(n) : String(x));
const noBad = o => !/NaN|Infinity|undefined/.test(JSON.stringify(o).replace(/null/g, "0"));
const has = (o, id) => o.lines.find(l => l.id === id);

/* 1. таблиця А.5 у коді дорівнює таблиці в тексті ДБН (усі клітинки N=1…30 і 40, 50, 60) */
let diff = 0, cells = 0;
for (const N in FIX) { const i = H.A5.N.indexOf(+N); ["total", "cold"].forEach((k, j) => FIX[N][j].forEach((v, c) => { cells++; if (i < 0 || Math.abs(H.A5[k][i][c] - v) > 1e-9) diff++; })); }
t("А.5: клітинки збігаються з текстом ДБН (" + cells + ")", diff === 0 && cells === 20 * 2 * Object.keys(FIX).length, "0 розбіжностей", diff);
t("А.5: у коді рядки N 1…30, 40, 50, 60", H.A5.N.length === 23 && H.A5.N[H.A5.N.length - 1] === 60);
t("A5 інтерполяція за q̄", near(H.a5("cold", 1, 9), 0.285, 0.006)); t("A5 інтерполяція за N", near(H.a5("total", 11, 4), 0.35));
t("A5 q̄<4 береться 4, прапорець", H.a5x("total", 3, 2).clampLo === true && near(H.a5("total", 3, 2), H.a5("total", 3, 4)));
t("A5 q̄>80 береться 80, прапорець", H.a5x("total", 3, 99).clampHi === true);
t("A5 N>60: null без екстраполяції", H.a5("total", 61, 10) === null && H.a5x("total", 61, 10).outN === true);
t("A5 N=0: 0", H.a5("total", 0, 10) === 0);
/* А.6–А.9 */
const u = (n, U) => H.byU(n, U);
t("A9 U=1", near(u(285, 1).tot, 0.39) && near(u(285, 1).cold, 0.21)); t("A9 U=4", near(u(285, 4).tot, 0.41)); t("A9 U=8", near(u(285, 8).tot, 0.48) && near(u(285, 8).hot, 0.33));
t("A6 U=1", near(u(150, 1).tot, 0.26)); t("U>40 null", u(150, 41) === null);
t("velocity", near(H.vel(0.17, 12), 1.503, 0.01));
const i0 = H.specLoss(0.2, 16, 0.007, false); t("specLoss ~0,9 кПа/м", i0 > 500 && i0 < 2000);
t("типорозміри PEX: внутр. Ø = зовн. − 2×стінка", H.MAT.pex.sizes.every(s => { const w = parseFloat(s[1].split("×")[1].replace(",", ".")); return near(s[2], s[0] - 2 * w, 0.05); }));
t("типорозміри ППР PN20 і металопластик: так само", ["ppr20", "mp"].every(k => H.MAT[k].sizes.every(s => { const w = parseFloat(s[1].split("×")[1].replace(",", ".")); return near(s[2], s[0] - 2 * w, 0.05); })));

/* 2. контрольний приклад: 3 мешканці, 6 приладів, бойлер, трійникова */
const base = { mat: "pex", scheme: "tee", U: 3, counts: { bath: 1, shower: 1, basin: 1, sink: 1, wc: 1, washer: 1 }, boiler: true, dist: { bath: 3, shower: 3.5, basin: 5, sink: 6, wc: 7, washer: 8 }, hotDist: 4 };
const r = H.calc(base), S = n => r.sections.find(s => s.name === n);
t("q̄ загальна 17,17; холодна 12,33; гаряча 7,25", near(r.qbar.tot, 17.1667, 0.001) && near(r.qbar.cold, 12.3333, 0.001) && near(r.qbar.hot, 7.25, 0.001));
t("ввід за А.5 (загальна, N=6): 0,715 л/с, Ø32, 1,69 м/с", near(r.sections[0].q, 0.715, 0.0005) && r.sections[0].od === 32 && near(r.sections[0].v, 1.69, 0.01), "0,715 / Ø32 / 1,69", f(r.sections[0].q) + " / Ø" + r.sections[0].od + " / " + f(r.sections[0].v, 2));
t("А.9 довідково: 0,403 л/с, не змінює ввід", near(r.ref.q, 0.4033, 0.0005) && r.ref.od === 25 && r.sections[0].od === 32, "0,403 / Ø25 (довідково)", f(r.ref.q) + " / Ø" + r.ref.od);
const cm = r.sections.filter(s => s.kind === "coldMain"), hm = r.sections.filter(s => s.kind === "hotMain");
t("ХВП-магістраль: 0,438 / 0,418 / 0,398 / 0,378 / 0,367", cm.length === 5 && [0.438, 0.418, 0.398, 0.378, 0.367].every((q, k) => near(cm[k].q, q, 0.0006)), "0,438 0,418 0,398 0,378 0,367", cm.map(s => f(s.q)).join(" "));
t("ХВП-магістраль: Ø25 25 20 20 20", cm.map(s => s.od).join() === "25,25,20,20,20", "25,25,20,20,20", cm.map(s => s.od).join());
t("ГВП-магістраль: 0,357 / 0,337 / 0,321, усі Ø20", hm.length === 3 && [0.357, 0.337, 0.321].every((q, k) => near(hm[k].q, q, 0.0006)) && hm.every(s => s.od === 20), "0,357 0,337 0,321 / Ø20", hm.map(s => f(s.q) + "/Ø" + s.od).join(" "));
const bl = has(r, "boiler"); t("підведення до бойлера (блок «гаряча», N=4): 0,357 л/с, Ø20", near(bl.cold.q, 0.3575, 0.0006) && bl.cold.od === 20 && bl.hot.od === 20, "0,357 / Ø20", f(bl.cold.q) + " / Ø" + bl.cold.od);
t("бойлер не збільшує N", r.N === 6 && r.Nhot === 4);
t("діагностика: max(ХВП; бойлер) ≤ ввід ≤ ХВП + бойлер", r.check && r.check.ok && near(r.check.cold, 0.438, 0.001), "виконується", r.check && r.check.ok);
t("магістраль не менша за найбільшу підводку нижче", r.sections.filter(s => s.kind === "coldMain").every(s => s.q >= 0.083));
t("магістраль ХВП не обмежена вводом: можливо ширша", H.calc({ ...base, counts: { bath: 1, shower: 1, basin: 1, sink: 1, wc: 1, washer: 1 }, boiler: false, mat: "ppr20" }).sections.length > 1);
t("підводки: ванна/душ 0,30 л/с Ø20; умивальник Ø16", has(r, "bath").cold.od === 20 && near(has(r, "bath").cold.q, 0.3, 1e-9) && has(r, "basin").cold.od === 16, "0,30/Ø20; Ø16", f(has(r, "bath").cold.q) + "/Ø" + has(r, "bath").cold.od + "; Ø" + has(r, "basin").cold.od);
t("змішувач: холодна і гаряча окремо по 0,30, не складаються", has(r, "bath").cold.q === 0.3 && has(r, "bath").hot.q === 0.3);
t("унітаз і пральна лише холодна", !has(r, "wc").hot && !has(r, "washer").hot);
t("типові витрати окремі для приладів", H.devFlow("basin", {}) !== H.devFlow("washer", {}) && near(H.devFlow("bath", {}), 0.3, 1e-9) && near(H.devFlow("wc", {}), 0.1, 1e-9));
t("витрата приладу налаштовується (л/хв)", near(H.devFlow("wc", { wc: 12 }), 0.2, 1e-9) && near(H.devFlow("wc", { wc: "" }), 0.1, 1e-9) && near(H.devFlow("wc", { wc: -5 }), 0.1, 1e-9));
t("налаштована ванна 24 л/хв: підводка 0,40 л/с, v зростає", near(has(H.calc({ ...base, flows: { bath: 24 } }), "bath").cold.q, 0.4, 1e-9));
t("без попереджень у контрольному прикладі", r.warnings.length === 0, "без попереджень", r.warnings.length);
t("є перелік припущень і фраза про втрати тиску", r.assumptions.some(a => /Повний гідравлічний розрахунок втрат тиску системи не виконано\. Результат попередній\./.test(a)) && r.assumptions.some(a => /нормативність/.test(a)));

/* 3. променева розводка */
const rr = H.calc({ ...base, scheme: "ray" });
t("променева: ввід, колектор ХВП 0,438", rr.sections.length === 2 && near(rr.sections[1].q, 0.438, 0.001) && rr.sections[1].name === "Колектор ХВП");
t("променева: без ГВП-магістралі", !rr.sections.some(s => s.kind === "hotMain"));
/* 4. мешканці 1, 3, 5, 8: А.9 довідково, ввід за А.5 не залежить від U */
[1, 3, 5, 8].forEach(U => { const x = H.calc({ ...base, U }); t("U=" + U + ": ввід за А.5 той самий, довідка А.9 є", near(x.sections[0].q, 0.715, 0.0006) && x.ref && near(x.ref.q, H.byU(285, U).tot, 1e-9), "A.5 0,715; A.9 " + f(H.byU(285, U).tot), f(x.sections[0].q) + "; " + (x.ref && f(x.ref.q))); });
t("U=0 і U=41: розрахунок є, довідки А.9 немає", H.calc({ ...base, U: 0 }).ref === null && H.calc({ ...base, U: 41 }).sections.length > 0 && noBad(H.calc({ ...base, U: 41 })));
/* 5. один прилад, однакові прилади */
const one = H.calc({ ...base, counts: { sink: 1 }, boiler: false, dist: {} });
t("один прилад: ввід = max(А.5 N=1, витрата приладу), без магістралі", one.lines.length === 1 && one.sections.length === 1 && one.sections[0].q >= one.lines[0].qd && noBad(one), "1 лінія, ввід ≥ витрати приладу", f(one.sections[0].q));
const same = H.calc({ ...base, counts: { sink: 3, basin: 3 }, dist: {} });
t("кілька однакових приладів: імена нумеруються, N=6", same.lines.filter(l => l.id === "sink").length === 3 && /Мийка на кухні 2/.test(same.lines[1].name) && same.N === 6);
/* 6. без бойлера */
const nb = H.calc({ ...base, boiler: false });
t("без бойлера: ввід за блоком «холодна» (0,438), немає лінії бойлера й перевірки", near(nb.sections[0].q, 0.438, 0.001) && !has(nb, "boiler") && !nb.check, "0,438", f(nb.sections[0].q));
/* 7. довжини: нульові, відсутні, від'ємні */
[{}, { bath: 0 }, { bath: -5, sink: "abc" }, { bath: null }].forEach((d, k) => { const x = H.calc({ ...base, dist: d, hotDist: k === 2 ? -3 : "" }); t("довжини " + JSON.stringify(d) + ": без NaN/Infinity", noBad(x) && x.lines.length === 7, "ок", noBad(x)); });
const neg = H.calc({ ...base, counts: { bath: -2, sink: "x", basin: 1 }, dist: {} });
t("від'ємні й нечислові кількості ігноруються", neg.lines.filter(l => l.id !== "boiler").length === 1 && noBad(neg));
t("нуль приладів: порожній результат без помилок", H.calc({ ...base, counts: {} }).lines.length === 0 && noBad(H.calc({ ...base, counts: {} })));
/* 8. великі витрати, недостатній діаметр, немає типорозміру */
const huge = H.calc({ ...base, flows: { bath: 600 }, mat: "pex" });
t("дуже велика витрата: попередження «немає типорозміру», без «рекомендовано»", huge.warnings.some(w => /жоден типорозмір/.test(w)) && has(huge, "bath").cold.noFit === true && noBad(huge), "є попередження, noFit", huge.warnings.length);
const thin = H.calc({ ...base, flows: { bath: 40 }, mat: "ppr20" });
t("ППР: 40 л/хв ванна Ø25–32 за швидкістю, зростає діаметр", has(thin, "bath").cold.od >= 25 && has(thin, "bath").cold.ok, "Ø≥25", has(thin, "bath").cold.od);
const many = H.calc({ ...base, scheme: "tee", counts: { bath: 6, shower: 6, sink: 6, basin: 6, hyg: 6, wc: 6, washer: 6, dish: 6 }, dist: {} });
t("48 приладів: без NaN, магістраль монотонна за N", noBad(many) && many.sections.filter(s => s.kind === "coldMain").every((s, i, a) => i === 0 || s.q <= a[i - 1].q + 1e-9), "NaN немає", noBad(many));
const over = H.calc({ ...base, counts: { sink: 61 } });
t("61 прилад: попередження про межу реалізації, без екстраполяції", over.warnings.some(w => /60/.test(w)) && over.sections.length === 0 && noBad(over));
t("нульова витрата приладу: береться типова", has(H.calc({ ...base, flows: { sink: 0 } }), "sink").cold.q === H.devFlow("sink", {}));
/* 9. гаряча вода */
const hw = H.calc({ ...base, hotDist: 4 });
const hb = hw.recirc.items.find(x => x.id === "bath");
t("ГВП: довжини окремо, обʼєм = π(d/2)²(L_бойлер + L_прилад)", near(hb.vol, Math.PI * Math.pow(7.2 / 1000, 2) * (4 + 3) * 1000, 1e-6) && hb.lenB === 4 && hb.lenD === 3, "1,14 л", f(hb.vol, 2));
t("ГВП: час очікування = обʼєм / витрата лінії", near(hb.wait, hb.vol / 0.3, 1e-9));
const longRun = H.calc({ ...base, hotDist: 30, dist: { basin: 8 } });
t("ГВП: обʼєм > 3 л позначено", longRun.recirc.exceeded === true && longRun.recirc.items.some(x => x.over));
t("ГВП: поле «needed» прибрано", longRun.recirc.needed === undefined);
const direct = H.calc({ ...base, hotMode: "direct", hotDist: 30, dist: { basin: 8 } });
t("ГВП «від бойлера до приладу»: довжини не додаються", direct.recirc.items.find(x => x.id === "basin").len === 8 && direct.recirc.mode === "direct");
const partial = H.calc({ ...base, hotDist: "", dist: { basin: 5 } });
t("ГВП: якщо одна з довжин не задана, позначка «частково»", partial.recirc.items.find(x => x.id === "basin").partial === true);
/* 10. вузол */
const na = H.nodeAdvice("", 0.715), nb2 = H.nodeAdvice(5, 0.715), nc = H.nodeAdvice(1.5, 0.715);
t("вузол: Kv = Q/√Δp (Q 2,574 м³/год): 5,15 і 3,64", near(na.kv[0].kv, 2.574 / 0.5, 0.01) && near(na.kv[1].kv, 2.574 / Math.sqrt(0.5), 0.01), "5,15 / 3,64", f(na.kv[0].kv, 2) + " / " + f(na.kv[1].kv, 2));
t("вузол: без тиску є лише Kv і пояснення про паспортні Kvs", na.lines.length === 2 && /Kvs/.test(na.lines[1]) && !/достатн|обов/i.test(na.lines.join(" ")));
t("вузол: 5 бар — застереження без автовибору", /перевірте допустимий робочий тиск/.test(nb2.lines.join(" ")) && nb2.reducer === undefined && nb2.node === undefined);
t("вузол: 1,5 бар — перевірте мінімальний тиск приладів", /мінімальний робочий тиск/.test(nc.lines.join(" ")));
t("вузол: нульова витрата — null", H.nodeAdvice(5, 0) === null);
/* 11. ланцюг вводу (без змін) */
const ch = { riser: "1/2", filter: true, meter: "DN15", check: true, meterIn: "cabinet", pipeLen: 6, node: { valve: "3/4", reducer: true } };
const rc = H.calc({ ...base, chain: ch });
t("ланцюг вводу: порядок", rc.chain.elements.map(e => e.type).join() === "riser,filter,meter,check,pipe,node,reducer");
const c = H.compare({ ...base, norm: 285 }); t("compare: 3 матеріали", c.length === 3);
/* 12. матеріали і запас */
t("запас = PEX20-еквівалент: pex 20, cu/inox 18", H.reserveSize("pex")[0] === 20 && H.reserveSize("cu")[0] === 18);
t("всі матеріали сторінки дають результат без NaN", H.LIST.every(m => noBad(H.calc({ ...base, mat: m }))));

console.log("\nКонтрольні сценарії (вхід → очікуване → фактичне → статус):");
rows.forEach(x => console.log(" - " + x[0] + " | очікувалось: " + x[1] + " | отримано: " + x[2] + " | " + x[3]));
console.log("\n" + ok + " passed, " + bad + " failed"); process.exit(bad ? 1 : 0);
