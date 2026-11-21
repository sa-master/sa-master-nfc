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
    const cnt = (k, dn) => lines.filter(l => l[k] === dn).length;
    const bindDn = inDn === 32 ? 22 : 18;
    return {
      kind, baths, inDn,
      valveIn: inDn === 32 ? "1\"" : "3/4\"",
      lines,
      totals: { cold20: cnt("cold", 20), cold16: cnt("cold", 16), hot20: cnt("hot", 20), hot16: cnt("hot", 16) },
      outputsCold: lines.length,
      outputsHot: lines.filter(l => l.hot && !l.boiler).length,
      bind: p.boiler || p.filter ? { dn: bindDn, boiler: Boolean(p.boiler), filter: Boolean(p.filter) } : null,
      notes: inDn === 32 ? ["Будинок із 3+ санвузлами: ввід Ø32 це орієнтир, не з норми. Перевірте розрахунком."] : []
    };
  }
  const api = { DEVICES, calc, inletDn };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Diameters = api;
})(typeof window !== "undefined" ? window : this);
