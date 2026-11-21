/* Підбір діаметрів внутрішнього водопроводу (променева система). Правила майстра, не норматив.
   Ø труби: 25 на ввід у колектор, 20 на бойлер, ванну й душ, 16 на решту приладів.
   Будинок із 3+ санвузлами: ввід 32 (орієнтир, не перевірений нормою). */
(function (root) {
  "use strict";
  const DEVICES = [
    { id: "bath", label: "Ванна (змішувач)", hot: true, dn: 20 },
    { id: "shower", label: "Душ (змішувач)", hot: true, dn: 20 },
    { id: "basin", label: "Умивальник", hot: true, dn: 16 },
    { id: "sink", label: "Мийка на кухні", hot: true, dn: 16 },
    { id: "wc", label: "Унітаз", hot: false, dn: 16 },
    { id: "washer", label: "Пральна машина", hot: false, dn: 16 },
    { id: "dish", label: "Посудомийна машина", hot: false, dn: 16 }
  ];
  function inletDn(kind, baths){ return kind === "house" && baths >= 3 ? 32 : 25; }
  function calc(p) {
    const kind = p.kind === "house" ? "house" : "flat";
    const baths = Math.max(1, Math.floor(Number(p.baths) || 1));
    const inDn = inletDn(kind, baths);
    const lines = [];
    DEVICES.forEach(d => {
      const n = Math.max(0, Math.floor(Number((p.counts || {})[d.id]) || 0));
      for (let i = 1; i <= n; i++) {
        const name = n > 1 ? `${d.label} ${i}` : d.label;
        lines.push({ id: d.id, name, cold: d.dn, hot: d.hot ? d.dn : null });
      }
    });
    if (p.boiler) lines.push({ id: "boiler", name: "Бойлер", cold: 20, hot: 20, boiler: true });
    const scheme = p.scheme === "tee" ? "tee" : "ray";
    const cnt = (k, dn) => lines.filter(l => l[k] === dn).length;
    const bindDn = inDn === 32 ? 22 : 18;
    return {
      kind, baths, inDn, scheme,
      main: scheme === "tee" ? { first: inDn, after: inDn === 32 ? 25 : 20 } : null,
      tees: scheme === "tee" ? { cold: Math.max(0, lines.length - 1), hot: Math.max(0, lines.filter(l => l.hot && !l.boiler).length - 1) } : null,
      valveIn: inDn === 32 ? "1\"" : "3/4\"",
      lines,
      totals: { cold20: cnt("cold", 20), cold16: cnt("cold", 16), hot20: cnt("hot", 20), hot16: cnt("hot", 16) },
      outputsCold: lines.length,
      outputsHot: lines.filter(l => l.hot && !l.boiler).length,
      bind: p.boiler || p.filter ? { dn: bindDn, boiler: Boolean(p.boiler), filter: Boolean(p.filter) } : null,
      notes: (inDn === 32 ? ["Будинок із 3+ санвузлами: ввід Ø32 це орієнтир, не з норми. Перевірте розрахунком."] : [])
        .concat(scheme === "tee" ? ["Трійникова схема: магістраль від вводу до першого трійника, далі на розмір менше. Для гарячої води магістраль від бойлера взято за тим самим правилом."] : [])
    };
  }
  /* Еквівалент пропуску за внутрішнім діаметром. src: "cat" з каталогу виробника, "typ" типове значення. */
  const EQ = [
    { g: "Зшитий поліетилен / PE-RT", n: "16×2,0", d: 12, src: "typ" }, { g: "Зшитий поліетилен / PE-RT", n: "20×2,0", d: 16, src: "typ" },
    { g: "Зшитий поліетилен / PE-RT", n: "20×2,8", d: 14.4, src: "typ" }, { g: "Зшитий поліетилен / PE-RT", n: "25×2,3", d: 20.4, src: "typ" },
    { g: "Зшитий поліетилен / PE-RT", n: "25×3,5", d: 18, src: "typ" }, { g: "Зшитий поліетилен / PE-RT", n: "32×3,0", d: 26, src: "typ" },
    { g: "Зшитий поліетилен / PE-RT", n: "32×4,4", d: 23.2, src: "typ" },
    { g: "Металопластик (типовий)", n: "16×2,0", d: 12, src: "typ" }, { g: "Металопластик (типовий)", n: "20×2,0", d: 16, src: "typ" },
    { g: "Металопластик (типовий)", n: "26×3,0", d: 20, src: "typ" }, { g: "Металопластик (типовий)", n: "32×3,0", d: 26, src: "typ" },
    { g: "Металопластик Geberit FlowFit", n: "16×2,0", d: 12, src: "cat" }, { g: "Металопластик Geberit FlowFit", n: "20×2,0", d: 16, src: "cat" },
    { g: "Металопластик Geberit FlowFit", n: "25×2,5", d: 20, src: "cat" }, { g: "Металопластик Geberit FlowFit", n: "32×2,8", d: 26.4, src: "cat" },
    { g: "Металопластик Geberit Mepla", n: "16×2,25", d: 11.5, src: "cat" }, { g: "Металопластик Geberit Mepla", n: "20×2,5", d: 15, src: "cat" },
    { g: "Металопластик Geberit Mepla", n: "26×3,0", d: 20, src: "cat" }, { g: "Металопластик Geberit Mepla", n: "32×3,0", d: 26, src: "cat" },
    { g: "Металопластик Geberit Mepla", n: "40×3,5", d: 33, src: "cat" },
    { g: "Композит TECEflex", n: "розмір 25 (26×4,0)", d: 18, src: "cat" },
    { g: "Нержавійка Geberit Mapress", n: "18×1,0", d: 16, src: "cat" },
    { g: "Нержавійка", n: "15×1,0", d: 13, src: "typ" }, { g: "Нержавійка", n: "22×1,2", d: 19.6, src: "typ" },
    { g: "Нержавійка", n: "28×1,2", d: 25.6, src: "typ" },
    { g: "Мідь", n: "15×1,0", d: 13, src: "typ" }, { g: "Мідь", n: "18×1,0", d: 16, src: "typ" },
    { g: "Мідь", n: "22×1,0", d: 20, src: "typ" }, { g: "Мідь", n: "28×1,5", d: 25, src: "typ" },
    { g: "Поліпропілен PN20", n: "20×3,4", d: 13.2, src: "typ" }, { g: "Поліпропілен PN20", n: "25×4,2", d: 16.6, src: "typ" },
    { g: "Поліпропілен PN20", n: "32×5,4", d: 21.2, src: "typ" }, { g: "Поліпропілен PN20", n: "40×6,7", d: 26.6, src: "typ" },
    { g: "Поліпропілен PN16", n: "20×2,8", d: 14.4, src: "typ" }, { g: "Поліпропілен PN16", n: "25×3,5", d: 18, src: "typ" },
    { g: "Поліпропілен PN16", n: "32×4,4", d: 23.2, src: "typ" },
    { g: "Сталь, різьба (прохід труби)", n: "1/2\"", d: 15, src: "typ" }, { g: "Сталь, різьба (прохід труби)", n: "3/4\"", d: 21, src: "typ" },
    { g: "Сталь, різьба (прохід труби)", n: "1\"", d: 27, src: "typ" }
  ];
  const area = d => Math.PI * d * d / 4;
  /* найближчий за внутрішнім діаметром розмір у кожній групі; diff — різниця площі перерізу в % */
  function equiv(i) {
    const it = EQ[i], out = [];
    const groups = [...new Set(EQ.map(e => e.g))];
    groups.forEach(g => {
      const list = EQ.map((e, k) => ({ e, k })).filter(x => x.e.g === g && x.k !== i);
      if (!list.length) return;
      list.sort((a, b) => Math.abs(a.e.d - it.d) - Math.abs(b.e.d - it.d));
      const b = list[0].e;
      out.push({ g, n: b.n, d: b.d, src: b.src, diff: Math.round((area(b.d) / area(it.d) - 1) * 100) });
    });
    return { item: it, area: Math.round(area(it.d)), list: out };
  }
  const api = { DEVICES, calc, inletDn, EQ, equiv };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Diameters = api;
})(typeof window !== "undefined" ? window : this);
