/* Нормативні правила випробувань внутрішніх систем. Окремо від інтерфейсу.
   Лише ДБН. Допуск падіння = null означає, що в нормі числового допуску немає (його не вигадуємо).
   Правила перевірені за текстом ДБН на e-construction.gov.ua; перед запуском звірити актуальні редакції (у реєстрі обидва ДБН позначені «Архівний»). */
(function (root) {
  "use strict";
  const SRC_64 = "https://e-construction.gov.ua/laws_detail/3200385397578270089?doc_type=2";
  const SRC_67 = "https://e-construction.gov.ua/laws_detail/3074971619479783152";
  const RULES = [
    {
      id: "w-hydro", system: "water", method: "hydro",
      norm: "ДБН В.2.5-64:2012", clause: "п. 27.2.2", src: SRC_64, version: "2012, зміна № 1 (2019)", checked: "2026-11-20 за текстом e-construction",
      title: "Гідравлічне випробування водопостачання",
      factor: 1.5, range: [1, 6.5], minutes: 30, maxDrop: 0.2,
      conds: [
        { id: "noFixtures", text: "Випробування проведено до встановлення водорозбірної арматури" },
        { id: "temp", text: "Температура навколишнього середовища додатна, води не нижче 5 °C" }
      ],
      glued: { id: "wait24", text: "Минуло не менше 24 год після останнього клеєного або зварного з’єднання" }
    },
    {
      id: "w-air", system: "water", method: "air",
      norm: "ДБН В.2.5-64:2012", clause: "п. 27.2.3", src: SRC_64, version: "2012, зміна № 1 (2019)", checked: "2026-11-20 за текстом e-construction",
      title: "Манометричне (повітрям) випробування водопостачання",
      stage1: 1.5, control: 1.0, range: [0.11, 3.0], minutes: 5, maxDrop: 0.1,
      conds: [
        { id: "noFixtures", text: "Випробування проведено до встановлення водорозбірної арматури" },
        { id: "temp", text: "Температура навколишнього середовища додатна" }
      ]
    },
    {
      id: "h-hydro", system: "heat", method: "hydro",
      norm: "ДБН В.2.5-67:2013", clause: "п. 4.5, дод. Г", src: SRC_67, version: "2013", checked: "2026-11-20 за текстом e-construction (Г.1.1–Г.1.4 не бачив)",
      title: "Гідравлічне випробування опалення",
      factor: 1.3, range: null, minutes: 120, maxDrop: null,
      conds: [
        { id: "temp", text: "Температура повітря в будівлі додатна" }
      ]
    }
  ];
  const ST = {
    OK: "Відповідає критеріям", BAD: "Не відповідає критеріям", CONFIRM: "Потребує підтвердження",
    NODATA: "Недостатньо даних", RANGE: "Параметри поза нормативними межами"
  };
  const r2 = v => Math.round(v * 100) / 100;
  const num = v => (typeof v === "number" && isFinite(v)) ? v : null;
  function ruleFor(system, method) { return RULES.find(r => r.system === system && r.method === (method || "hydro")) || null; }
  function required(rule, work) { const w = num(work); return !rule || rule.factor == null || w === null || w <= 0 ? null : r2(w * rule.factor); }
  /* d: { work, testP, start, end, minutes, leak:"no"|"yes"|null, cond:{id:true}, glued:bool, confirm:bool, air1:bool, compMax }
     Повертає { status, reasons[], notes[], drop, required } */
  function evaluate(rule, d) {
    const out = { status: ST.NODATA, reasons: [], notes: [], soft: [], drop: null, required: null };
    if (!rule) { out.reasons.push("Немає нормативного правила для цієї системи"); return out; }
    d = d || {};
    const start = num(d.start), end = num(d.end), minutes = num(d.minutes), testP = num(d.testP != null ? d.testP : d.start);
    const drop = start !== null && end !== null ? r2(start - end) : null; out.drop = drop;
    const req = required(rule, d.work); out.required = req;
    const range = [];
    /* 1. Некоректні значення і межа компонентів — блокують висновок */
    [start, end].forEach(v => { if (v !== null && v < 0) range.push("Тиск не може бути від’ємним"); });
    const cm = num(d.compMax);
    if (cm !== null && testP !== null && testP > cm + 1e-9) range.push(`Пробний тиск ${testP} бар перевищує допустимий для найслабшого компонента (${cm} бар)`);
    if (range.length) { out.status = ST.RANGE; out.reasons = range; return out; }
    /* Межа тиску з норми — лише м’яка примітка, висновок не блокує */
    if (rule.method === "hydro" && rule.range && testP !== null && (testP < rule.range[0] || testP > rule.range[1] + 1e-9))
      out.soft.push(`Пробний тиск ${testP} бар поза межами ${rule.range[0]}–${rule.range[1]} бар, які вказує ${rule.norm}, ${rule.clause}. Уточніть у проєкті`);
    if (rule.method === "air" && rule.range) {
      [start, end].forEach(v => { if (v !== null && (v < rule.range[0] || v > rule.range[1] + 1e-9)) out.soft.push(`Тиск ${v} бар поза межами ${rule.range[0]}–${rule.range[1]} бар, які вказує ${rule.norm}, ${rule.clause}. Уточніть у проєкті`); });
    }
    /* 2. Достатність даних */
    const miss = [];
    if (start === null) miss.push("початковий тиск"); if (end === null) miss.push("кінцевий тиск");
    if (minutes === null) miss.push("тривалість"); if (d.leak !== "no" && d.leak !== "yes") miss.push("огляд на протікання");
    if (miss.length) { out.status = ST.NODATA; out.reasons = ["Не вказано: " + miss.join(", ")]; return out; }
    /* 3. Невідповідність */
    const bad = [];
    if (d.leak === "yes") bad.push("Виявлено протікання");
    if (minutes < rule.minutes) bad.push(`Тривалість ${minutes} хв менша за ${rule.minutes} хв`);
    if (rule.maxDrop != null && drop > rule.maxDrop + 1e-9) bad.push(`Падіння тиску ${drop} бар більше за ${rule.maxDrop} бар`);
    if (rule.method === "hydro" && req !== null && testP < req - 0.05) bad.push(`Пробний тиск ${testP} бар менший за розрахунковий ${req} бар`);
    if (bad.length) { out.status = ST.BAD; out.reasons = bad; return out; }
    /* 4. Підтвердження */
    const conf = [];
    if (rule.method === "air") {
      if (!d.air1) conf.push(`Не відмічено етап 1: тиск ${rule.stage1} бар і огляд на дефекти`);
      if (Math.abs(start - rule.control) > 0.05) conf.push(`Контрольний тиск має бути ${rule.control} бар`);
    }
    if (rule.method === "hydro" && req !== null && testP > req + 0.05) conf.push(`Пробний тиск ${testP} бар вищий за розрахунковий ${req} бар`);
    (rule.conds || []).forEach(c => { if (!(d.cond && d.cond[c.id])) conf.push(c.text); });
    if (rule.glued && d.glued && !(d.cond && d.cond[rule.glued.id])) conf.push(rule.glued.text);
    if (rule.maxDrop == null) {
      out.notes.push(`Допустиме падіння в ${rule.norm} не задано: висновок спирається на відсутність протікань, тривалість і підтвердження виконавця`);
      if (!d.confirm) conf.push("Виконавець не підтвердив результат");
    }
    if (conf.length) { out.status = ST.CONFIRM; out.reasons = conf; return out; }
    out.status = ST.OK; return out;
  }
  const api = { RULES, ST, ruleFor, required, evaluate };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HydroRules = api;
})(typeof window !== "undefined" ? window : this);
