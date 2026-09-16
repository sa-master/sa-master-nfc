/* =========================
   SUPPLIER XLS/XLSX IMPORT v9.0
   - Кнопка "⇩ Імпорт" створюється в HTML, модуль лише навішує обробник
   - "Ціна зі знижкою" = ціна майстра (оптова)
   - Курс EUR зберігається per-supplier у снапшотах цін
   - Прибрано кнопку "₴ Ціни" та діагностичну шторку
========================= */

(function initSupplierImport(){

  const IMPORT_RULES_KEY = "plumber_importRules";
  const EUR_RATE_KEY = "plumber_eurRate";
  const USD_RATE_KEY = "plumber_usdRate";
  const SUPPLIER_NAMES_KEY = "plumber_supplierNames";

  let pendingSupplierImport = [];
  let importShowAll = false;
  let importCurrency = "";
  let importSupplierName = "";
  let importSupplierFullName = "";
  let importPriceMode = "";
  let importHasDualPrices = false;
  let importHasRetailPriceOnly = false;
  let importHasMasterPriceOnly = false;
  let parsedImportSheets = [];
  let selectedImportSheet = "";

  let importEurRate = Number(localStorage.getItem(EUR_RATE_KEY) || 0);
  if(!Number.isFinite(importEurRate) || importEurRate < 0) importEurRate = 0;

  let importUsdRate = Number(localStorage.getItem(USD_RATE_KEY) || 0);
  if(!Number.isFinite(importUsdRate) || importUsdRate < 0) importUsdRate = 0;

  /* ==== CSS для шторки імпорту (без стилів для кнопки — вона в HTML) ==== */

  const style = document.createElement("style");
  style.textContent = `
    .importSheet{position:fixed;inset:0;z-index:60;display:none;align-items:flex-end;background:rgba(0,0,0,.32);backdrop-filter:blur(6px)}
    .importSheet.open{display:flex}
    .importPanel{width:100%;max-width:560px;height:min(88dvh,760px);margin:auto;background:#f6f7fa;border-radius:22px;display:flex;flex-direction:column;overflow:hidden;padding-bottom:env(safe-area-inset-bottom)}
    .importHead{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:11px 14px 8px}
    .importHead strong{font-size:18px}
    .importBody{min-height:0;flex:1;overflow-y:auto;padding:0 12px 14px;-webkit-overflow-scrolling:touch}
    .importSummary{background:#fff;border-radius:14px;padding:11px;margin-bottom:8px;box-shadow:0 2px 10px rgba(30,40,60,.045)}
    .importSummaryTitle{font-size:13px;font-weight:750;margin-bottom:6px}
    .importStats{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:#555}
    .importStat{background:#f0f2f5;border-radius:9px;padding:7px 8px}
    .importWarning{margin-top:8px;color:#b45309;font-size:12px;font-weight:700}
    .importBrands{margin-top:8px;color:var(--muted);font-size:11px;line-height:1.35}
    .importCurrencyBox,.importSupplierBox{background:#fff;border-radius:12px;padding:9px;margin-bottom:8px}
    .importCurrencyTitle,.importSupplierTitle{font-size:12px;font-weight:750;margin-bottom:7px}
    .importCurrencyWarning{margin:-1px 0 7px;color:#b45309;font-size:11px;font-weight:750;line-height:1.35}
    .importCurrencyFields,.importSupplierFields{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .importCurrencyFields select,.importCurrencyFields input,.importSupplierFields select,.importSupplierFields input{width:100%;height:36px;border:0;border-radius:9px;background:#eef0f4;padding:0 9px;font-size:12px;outline:0}
    .importCurrencyFields .wide{grid-column:1/-1}
    .importCurrencyHint,.importSupplierHint{margin-top:6px;color:var(--muted);font-size:10px;line-height:1.35}
    .importToolbar{display:flex;gap:7px;margin:8px 0;flex-wrap:wrap}
    .importSoftButton{height:34px;padding:0 10px;border-radius:10px;background:#e9ebef;color:var(--blue);font-size:12px;font-weight:700}
    .importBulk{display:flex;gap:6px;align-items:center;background:#fff;border-radius:12px;padding:8px;margin-bottom:8px}
    .importBulk select{min-width:0;flex:1;height:34px;border:0;border-radius:9px;background:#eef0f4;padding:0 8px;font-size:12px}
    .importItem{background:#fff;border-radius:13px;padding:10px;margin:6px 0;box-shadow:0 2px 10px rgba(30,40,60,.04)}
    .importItemName{font-size:13px;font-weight:700;line-height:1.25;overflow-wrap:anywhere}
    .importItemMeta{margin-top:4px;color:var(--muted);font-size:10px;line-height:1.35}
    .importItemFields{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
    .importItemFields select,.importItemFields input{width:100%;height:34px;border:0;border-radius:9px;background:#eef0f4;padding:0 8px;font-size:11px;outline:0}
    .importItemFields .wide{grid-column:1/-1}
    .importFooter{flex:0 0 auto;padding:8px 12px calc(10px + env(safe-area-inset-bottom));display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f6f7fa;border-top:1px solid #e5e7eb}
    .importCancel,.importApply{height:42px;border-radius:13px;font-size:14px;font-weight:750}
    .importCancel{background:#e9ebef;color:#555}
    .importApply{background:var(--blue);color:#fff}
    .importEmpty{text-align:center;color:var(--muted);padding:30px 15px;font-size:13px}
  `;
  document.head.appendChild(style);

  /* ==== Прихований file input ==== */

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".xls,.xlsx,.xlsm";
  fileInput.style.display = "none";
  fileInput.id = "supplierImportFile";
  document.body.appendChild(fileInput);

  fileInput.addEventListener("change", handleSupplierFile);

  /* ==== Кнопка "⇩ Імпорт" — вже в HTML, лише навішуємо клік ==== */

  const importButton = document.getElementById("supplierImportButton");

  if(importButton){
    importButton.addEventListener("click", () => fileInput.click());
  }else{
    console.warn("[supplier-import] Кнопка #supplierImportButton не знайдена в HTML");
  }

  /* ==== Шторка перевірки імпорту ==== */

  const importSheet = document.createElement("div");
  importSheet.className = "importSheet";
  importSheet.id = "supplierImportSheet";
  importSheet.innerHTML = `
    <div class="importPanel">
      <div class="importHead">
        <strong>Перевірка імпорту</strong>
        <button class="close" id="supplierImportClose">×</button>
      </div>
      <div class="importBody" id="supplierImportBody"></div>
      <div class="importFooter">
        <button class="importCancel" id="supplierImportCancel">Скасувати</button>
        <button class="importApply" id="supplierImportApply">Імпортувати</button>
      </div>
    </div>
  `;
  document.body.appendChild(importSheet);

  document.getElementById("supplierImportClose").onclick = closeSupplierImport;
  document.getElementById("supplierImportCancel").onclick = closeSupplierImport;
  document.getElementById("supplierImportApply").onclick = applySupplierImport;

  importSheet.addEventListener("click", event => {
    if(event.target === importSheet) closeSupplierImport();
  });

  /* ============ utils ============ */

  function cleanText(value){
    return String(value ?? "")
      .replace(/\u00a0/g," ")
      .replace(/[\r\n]+/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function activeImportItems(){
    return pendingSupplierImport.filter(item => item.include !== false);
  }

  function ntext(value){
    return cleanText(value).toLowerCase();
  }

  function parseNumber(value){
    if(typeof value === "number" && Number.isFinite(value)) return value;

    let text = cleanText(value)
      .replace(/[\s\u00A0']/g,"")
      .replace(/грн\.?/gi,"")
      .replace(/[^0-9,.-]/g,"");

    if(!text || text === "-" || text === "." || text === ",") return null;

    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");

    if(lastComma >= 0 && lastDot >= 0){
      const decimalSeparator = lastComma > lastDot ? "," : ".";
      const thousandsSeparator = decimalSeparator === "," ? "." : ",";
      text = text.split(thousandsSeparator).join("").replace(decimalSeparator,".");
    }else if(lastComma >= 0){
      const parts = text.split(",");
      if(parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].replace("-","").length <= 3)){
        text = parts.join("");
      }else{
        text = text.replace(",", ".");
      }
    }else if(lastDot >= 0){
      const parts = text.split(".");
      if(parts.length > 2 && parts[parts.length - 1].length === 3){
        text = parts.join("");
      }
    }

    if(!text || text === "-" || text === "." || text === "-.") return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function formatImportPrice(value){
    const number = Number(value);
    if(!Number.isFinite(number)) return "";
    const formatted = number.toLocaleString("uk-UA",{minimumFractionDigits:2,maximumFractionDigits:2});
    if(importCurrency === "EUR") return formatted + " EUR";
    if(importCurrency === "UAH") return formatted + " грн";
    if(importCurrency === "USD") return formatted + " USD";
    return formatted + " (валюта не визначена)";
  }

  function isUnit(value){
    const text = ntext(value).replace(/\./g,"");
    return /^(шт|м|м2|м²|м3|м³|компл|упак|уп|кг|л|погм|пог м|pcs|pc)$/.test(text);
  }

  function isLikelyArticle(value){
    const text = cleanText(value);
    return text.length > 0 && text.length < 40 && /[0-9a-zа-яіїєґ]/i.test(text);
  }

  /* ============ header detection ============ */

  function classifyPriceHeader(text){
    const t = ntext(text);
    if(!t) return null;

    const isExplicitRetail =
      /ціна.*без\s*зниж|цена.*без\s*скид|retail.*price|list.*price|роздрібн.*ціна|розничн.*цена/.test(t);

    const isExplicitMaster =
      /ціна.*майстра|ціна.*закуп|закупівельн|закупочн|оптов|wholesale|dealer.*price|моя\s*ціна/.test(t);

    const isDiscountAsMaster =
      /ціна.*(зі|з)\s*зниж|цена.*(со|с)\s*скид|ціна.*після.*зниж|цена.*после.*скид|discount.*price|акційн.*ціна|акционн.*цена/.test(t);

    const isPlainPriceWord =
      /^(ціна|цена|price)(\s*[.,:()].*)?$/i.test(t);

    const isGeneric =
      isPlainPriceWord &&
      !isExplicitRetail &&
      !isExplicitMaster &&
      !isDiscountAsMaster;

    if(isExplicitRetail) return "retail";
    if(isExplicitMaster) return "master";
    if(isDiscountAsMaster) return "master";
    if(isGeneric) return "generic";
    return null;
  }

  function classifyHeaderRow(row){
    const info = {
      articleCol: -1,
      qtyCol: -1,
      nameHeaderCol: -1,
      retailCol: -1,
      masterCol: -1,
      genericCol: -1,
      score: 0
    };

    row.forEach((cell,col) => {
      const text = ntext(cell);
      if(!text) return;

      if(/артикул|код товар|код$|sku/.test(text)){
        if(info.articleCol < 0) info.articleCol = col;
        info.score += 4;
      }

      if(/кількість|количество|к-сть|qty/.test(text)){
        if(info.qtyCol < 0) info.qtyCol = col;
        info.score += 4;
      }

      if(/товар|найменув|наименов|назва|именование|product/.test(text)){
        if(info.nameHeaderCol < 0) info.nameHeaderCol = col;
        info.score += 3;
      }

      const priceKind = classifyPriceHeader(cell);
      if(priceKind === "retail" && info.retailCol < 0){
        info.retailCol = col;
        info.score += 5;
      }else if(priceKind === "master" && info.masterCol < 0){
        info.masterCol = col;
        info.score += 5;
      }else if(priceKind === "generic" && info.genericCol < 0){
        info.genericCol = col;
        info.score += 4;
      }
    });

    return info;
  }

  function resolvePriceColumns(info){
    let regularPriceCol = -1;
    let discountPriceCol = -1;
    let priceCol = -1;

    if(info.retailCol >= 0 && info.masterCol >= 0){
      regularPriceCol = info.retailCol;
      discountPriceCol = info.masterCol;
      priceCol = info.retailCol;
      return { regularPriceCol, discountPriceCol, priceCol };
    }

    if(info.retailCol >= 0 && info.genericCol >= 0){
      regularPriceCol = info.retailCol;
      priceCol = info.retailCol;
      return { regularPriceCol, discountPriceCol, priceCol };
    }

    if(info.masterCol >= 0 && info.genericCol >= 0){
      regularPriceCol = info.genericCol;
      discountPriceCol = info.masterCol;
      priceCol = info.masterCol;
      return { regularPriceCol, discountPriceCol, priceCol };
    }

    if(info.retailCol >= 0){
      regularPriceCol = info.retailCol;
      priceCol = info.retailCol;
      return { regularPriceCol, discountPriceCol, priceCol };
    }

    if(info.masterCol >= 0){
      discountPriceCol = info.masterCol;
      priceCol = info.masterCol;
      return { regularPriceCol, discountPriceCol, priceCol };
    }

    if(info.genericCol >= 0){
      regularPriceCol = info.genericCol;
      priceCol = info.genericCol;
      return { regularPriceCol, discountPriceCol, priceCol };
    }

    return { regularPriceCol, discountPriceCol, priceCol };
  }

  function findHeaderRow(rows){
    let best = null;

    rows.slice(0,60).forEach((row,rowIndex) => {
      const info = classifyHeaderRow(row);
      const resolved = resolvePriceColumns(info);

      if(
        resolved.priceCol >= 0 &&
        info.nameHeaderCol >= 0 &&
        info.score >= 7
      ){
        const candidate = {
          rowIndex,
          score: info.score,
          articleCol: info.articleCol,
          qtyCol: info.qtyCol,
          nameHeaderCol: info.nameHeaderCol,
          priceCol: resolved.priceCol,
          regularPriceCol: resolved.regularPriceCol,
          discountPriceCol: resolved.discountPriceCol
        };

        if(!best || candidate.score > best.score){
          best = candidate;
        }
      }
    });

    if(best){
      console.log(
        "[supplier-import] Header row %d → name=%d, article=%d, qty=%d, price=%d, retail=%d, master=%d",
        best.rowIndex,
        best.nameHeaderCol,
        best.articleCol,
        best.qtyCol,
        best.priceCol,
        best.regularPriceCol,
        best.discountPriceCol
      );
    }else{
      console.warn("[supplier-import] Header row не знайдено");
    }

    return best;
  }

  function detectDataColumns(rows,header){
    const sample = rows.slice(header.rowIndex + 1, header.rowIndex + 45);

    const startName = Math.max(
      0,
      header.nameHeaderCol >= 0 ? header.nameHeaderCol : (header.articleCol >= 0 ? header.articleCol + 1 : 0)
    );

    const endName = Math.max(
      startName,
      (header.qtyCol >= 0 ? header.qtyCol : header.priceCol) - 1
    );

    let nameCol = startName;
    let bestNameScore = -1;

    for(let col = startName; col <= endName; col++){
      let count = 0;
      let chars = 0;
      sample.forEach(row => {
        const value = cleanText(row[col]);
        if(value && !isUnit(value) && parseNumber(value) === null && value.length >= 4){
          count++;
          chars += value.length;
        }
      });
      const score = count * 100 + chars;
      if(score > bestNameScore){
        bestNameScore = score;
        nameCol = col;
      }
    }

    let unitCol = -1;
    let bestUnitScore = 0;
    const maxCols = Math.max(
      ...sample.map(row => row.length),
      header.priceCol + 1,
      header.qtyCol + 1,
      header.regularPriceCol + 1,
      header.discountPriceCol + 1
    );

    for(let col = 0; col < maxCols; col++){
      if(
        col === nameCol ||
        col === header.articleCol ||
        col === header.qtyCol ||
        col === header.priceCol ||
        col === header.regularPriceCol ||
        col === header.discountPriceCol
      ) continue;

      let score = 0;
      sample.forEach(row => { if(isUnit(row[col])) score++; });
      if(score > bestUnitScore){
        bestUnitScore = score;
        unitCol = col;
      }
    }

    return {
      articleCol: header.articleCol,
      qtyCol: header.qtyCol,
      priceCol: header.priceCol,
      regularPriceCol: header.regularPriceCol ?? -1,
      discountPriceCol: header.discountPriceCol ?? -1,
      nameCol,
      unitCol
    };
  }

  /* ============ supplier names ============ */

  function loadSupplierNames(){
    try{
      const value = JSON.parse(localStorage.getItem(SUPPLIER_NAMES_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    }catch{ return {}; }
  }

  function saveSupplierNames(value){
    localStorage.setItem(SUPPLIER_NAMES_KEY,JSON.stringify(value));
  }

  function supplierKey(value){
    return ntext(value);
  }

  function detectSupplierFullName(rows,header){
    const limit = Math.min(rows.length,Math.max(header.rowIndex,1));
    for(let r = 0; r < limit; r++){
      const row = rows[r] || [];
      for(let c = 0; c < row.length; c++){
        const raw = cleanText(row[c]);
        const text = ntext(raw);
        if(!text || !/^(постачальник|поставщик|продавець|продавец)(\s|:|$)/.test(text)) continue;
        const afterColon = cleanText(raw.replace(/^(постачальник|поставщик|продавець|продавец)\s*:?\s*/i,""));
        if(afterColon) return afterColon;
        for(let next = c + 1; next < row.length; next++){
          const candidate = cleanText(row[next]);
          if(candidate) return candidate;
        }
      }
    }
    return "";
  }

  function getKnownSupplierNames(){
    const values = new Set();
    catalog.forEach(item => {
      if(item.type !== "material") return;
      const offers = Array.isArray(item.supplierOffers) ? item.supplierOffers : [];
      offers.forEach(offer => {
        const name = cleanText(offer && offer.supplierName);
        if(name) values.add(name);
      });
    });
    return Array.from(values).sort((a,b) => a.localeCompare(b,"uk"));
  }

  /* ============ import rules ============ */

  function loadImportRules(){
    try{
      const value = JSON.parse(localStorage.getItem(IMPORT_RULES_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    }catch{ return {}; }
  }

  function saveImportRules(rules){
    localStorage.setItem(IMPORT_RULES_KEY,JSON.stringify(rules));
  }

  function ruleKey(article,name){
    const a = ntext(article);
    if(a) return "a:" + a;
    return "n:" + ntext(name);
  }

  /* ============ brand / system / category ============ */

  function detectBrand(text,article = ""){
    const source = ntext(text + " " + article);
    const rules = [
      [/go[\s-]*plast/,"GO-PLAST"],
      [/\bviega\b/,"Viega"],
      [/\bm[üu]pro\b/,"MUPRO"],
      [/k[\s-]*flex/,"K-FLEX"],
      [/\boventrop\b/,"Oventrop"],
      [/\bbwt\b|\bmultiblock[\s-]*inline\b/,"BWT"],
      [/\bwaterstop\b|\bajax\b/,"Ajax"],
      [/\bcaleffi\b/,"Caleffi"],
      [/\bresideo\b/,"Resideo"],
      [/\batlas\b/,"Atlas"],
      [/\beurocarb\b/,"Eurocarb"],
      [/\bpurolite\b/,"Purolite"],
      [/\bciech\b/,"Ciech"],
      [/\bvalsir\b/,"Valsir"],
      [/\bwurth\b|\bwürth\b/,"WURTH"],
      [/geberit/,"Geberit"],
      [/ostendorf|htsafe|нтsafe|нт safe|ht safe/,"Ostendorf"],
      [/\btece\b|teceflex|tecefloor/,"TECE"],
      [/pattaroni/,"PATTARONI"],
      [/bonomi/,"Bonomi"],
      [/tiemme/,"Tiemme"],
      [/walraven|\bbis\b/,"Walraven"],
      [/sanflex/,"Sanflex"],
      [/meibes/,"Meibes"],
      [/simplex/,"Simplex"],
      [/\bhl\d|\bhl\b/,"HL"],
      [/\bnmc\b/,"NMC"]
    ];
    for(const [pattern,label] of rules){
      if(pattern.test(source)) return label;
    }
    return "";
  }

  function detectSystem(text,brand = ""){
    const source = ntext(text);
    const rules = [
      [/flow[\s-]*fit/,"FlowFit"],
      [/tece[\s-]*flex/,"TECEflex"],
      [/tece[\s-]*floor/,"TECEfloor"],
      [/ht[\s-]*safe|нт[\s-]*safe/,"HTsafe"],
      [/sanflex[\s-]*stabil/,"Sanflex Stabil"]
    ];
    for(const [pattern,label] of rules){
      if(pattern.test(source)) return label;
    }
    return "";
  }

  function detectCategory(text,brand = "",system = ""){
    const source = ntext(text + " " + brand + " " + system);

    if(/каналіз|канализ|sewer|htsafe|ht safe|\bhtda\b|хрестовин|крестовин|сифон|відвід.*канал|отвод.*канал|канализац/.test(source)){
      return "sewer";
    }
    if(/flowfit|teceflex|tece flex|\bbwt\b|multiblock[\s-]*inline|водопостач|водоснаб|водопров|труба.*вода|фітинг.*вода|фитинг.*вода|фільтр|фильтр|пом['’]?якш|умягч|водоочист|очищенн.*вод|аніоніт|анионит|purolite|вугілля|уголь|сіль таблет|соль таблет|atlas premier|eurocarb|ciech/.test(source)){
      return "water";
    }
    if(/запірн|запорн|кран|вентил|клапан|редуктор тиску|редуктор давления|колектор|коллектор|pattaroni|bonomi|tiemme|simplex/.test(source)){
      return "fittings";
    }
    if(/комплектуюч|комплектующ|кріплен|креплен|хомут|дюбел|шуруп|ізоляц|изоляц|рукавиц|перчатк|manometr|манометр|k[\s-]*flex|sanflex|walraven|wurth|würth/.test(source)){
      return "other";
    }
    return "";
  }

  function classifyHeading(text,context){
    const clean = cleanText(text);
    const source = ntext(clean);
    if(!source) return false;

    if(/каналіз|канализ/.test(source)){
      context.category = "sewer"; context.brand = ""; context.system = "";
      return true;
    }
    if(/водопостач|водоснаб|водопров/.test(source)){
      context.category = "water"; context.brand = ""; context.system = "";
      return true;
    }
    if(/запірн.*арматур|запорн.*арматур/.test(source)){
      context.category = "fittings"; context.brand = ""; context.system = "";
      return true;
    }
    if(/комплектуюч|комплектующ|кріплен|креплен|ізоляц|изоляц/.test(source)){
      context.category = "other";
      const headingBrand = detectBrand(clean);
      const headingSystem = detectSystem(clean,headingBrand);
      context.brand = headingBrand || "";
      context.system = headingSystem || "";
      return true;
    }

    const brand = detectBrand(clean);
    const system = detectSystem(clean,brand);

    if(system){
      context.system = system;
      if(!context.brand) context.brand = detectBrand(system);
      const category = detectCategory(clean,context.brand,system);
      if(category) context.category = category;
      return true;
    }

    if(brand){
      context.brand = brand;
      context.system = "";
      const category = detectCategory(clean,brand,"");
      if(category) context.category = category;
      return true;
    }

    return false;
  }

  function getRowText(row,from = 0,to = null){
    const end = to === null ? row.length - 1 : Math.min(to,row.length - 1);
    const parts = [];
    for(let i = from; i <= end; i++){
      const value = cleanText(row[i]);
      if(value) parts.push(value);
    }
    return parts.join(" ");
  }

  function extractArticleFromName(name){
    const text = cleanText(name);
    if(!text) return "";
    const match = text.match(/(?:^|\s)([A-ZА-ЯІЇЄҐ0-9][A-ZА-ЯІЇЄҐ0-9._-]{3,})$/i);
    if(!match) return "";
    const candidate = cleanText(match[1]);
    if(!/\d/.test(candidate)) return "";
    if(/^\d+(?:[.,]\d+)?$/.test(candidate)) return "";
    return candidate;
  }

  function extractManufacturerArticleFromName(name,directBrand = ""){
    const text = cleanText(name);
    if(!text) return "";

    if(!directBrand){
      const trailingNumeric = text.match(/(?:^|\s)(\d{5,10})$/);
      return trailingNumeric ? cleanText(trailingNumeric[1]) : "";
    }

    const candidates = [];
    const leading = text.match(/^([A-ZА-ЯІЇЄҐ0-9][A-ZА-ЯІЇЄҐ0-9._-]{4,15})(?:\s+|$)/i);
    if(leading) candidates.push(cleanText(leading[1]));

    const trailing = text.match(/(?:^|\s)([A-ZА-ЯІЇЄҐ0-9][A-ZА-ЯІЇЄҐ0-9._-]{4,15})$/i);
    if(trailing){
      const value = cleanText(trailing[1]);
      if(!candidates.some(item => ntext(item) === ntext(value))) candidates.push(value);
    }

    for(const candidate of candidates){
      if(!/\d/.test(candidate)) continue;
      if(/^\d+$/.test(candidate)){
        if(/^\d{5,10}$/.test(candidate)) return candidate;
        continue;
      }
      if(/^[A-ZА-ЯІЇЄҐ0-9._-]{5,16}$/i.test(candidate) && /[A-ZА-ЯІЇЄҐ]/i.test(candidate)){
        return candidate;
      }
    }

    return "";
  }

  /* ============ sheet parsing ============ */

  function parseSheetRows(rows,header){
    const columns = detectDataColumns(rows,header);
    const result = [];
    const context = { category:"", brand:"", system:"" };
    const savedRules = loadImportRules();
    let emptyStreak = 0;

    for(let rowIndex = header.rowIndex + 1; rowIndex < rows.length; rowIndex++){
      const row = rows[rowIndex] || [];
      const rowText = getRowText(row);

      if(!rowText){
        emptyStreak++;
        if(emptyStreak > 15 && result.length) break;
        continue;
      }
      emptyStreak = 0;

      const name = cleanText(row[columns.nameCol]);
      const supplierArticle = columns.articleCol >= 0 ? cleanText(row[columns.articleCol]) : "";
      let article = supplierArticle || extractArticleFromName(name);
      const qty = columns.qtyCol >= 0 ? parseNumber(row[columns.qtyCol]) : null;
      const price = parseNumber(row[columns.priceCol]);
      const retailPrice = columns.regularPriceCol >= 0 ? parseNumber(row[columns.regularPriceCol]) : null;
      const masterPrice = columns.discountPriceCol >= 0 ? parseNumber(row[columns.discountPriceCol]) : null;
      const unit = columns.unitCol >= 0 ? cleanText(row[columns.unitCol]) : "";

      const hasProductShape = name && price !== null && price >= 0;

      if(!hasProductShape){
        const lower = ntext(rowText);
        if(/разом|всього|итого|всего|пдв|ндс|до сплати|к оплате/.test(lower)) continue;
        classifyHeading(rowText,context);
        continue;
      }

      if(!isLikelyArticle(article) && !name) continue;

      let brand = context.brand || "";
      let system = context.system || "";
      let category = context.category || "";

      const detectedBrand = detectBrand(name,article);
      const detectedSystem = detectSystem(name,detectedBrand || brand);

      if(detectedBrand && context.brand && detectedBrand !== context.brand){
        brand = detectedBrand; system = ""; category = "";
      }else if(detectedBrand){
        brand = detectedBrand;
      }

      const manufacturerArticle = extractManufacturerArticleFromName(name,detectedBrand);
      if(manufacturerArticle) article = manufacturerArticle;

      if(detectedSystem) system = detectedSystem;

      const detectedCategory = detectCategory(name,detectedBrand || "",detectedSystem || "");
      if(detectedCategory){
        if(context.category && detectedCategory !== context.category){
          if(!detectedBrand) brand = "";
          if(!detectedSystem) system = "";
        }
        category = detectedCategory;
      }

      if(detectedCategory === "other"){
        if(!detectedBrand){
          const sourceName = ntext(name);
          const keepWalravenContext =
            context.brand === "Walraven" &&
            /\bbis\b|\b2s\b|\bwup\b|хомут|дюбел|шуруп|гвинт|винт|кріплен|креплен/.test(sourceName);
          brand = keepWalravenContext ? "Walraven" : "";
        }
        if(!detectedSystem) system = "";
      }

      const key = ruleKey(article,name);
      const saved = savedRules[key];

      if(saved){
        if(!category && typeof saved.category === "string") category = saved.category;
        if(!detectedBrand && detectedCategory !== "other" && typeof saved.manufacturer === "string" && saved.manufacturer) brand = saved.manufacturer;
        if(!detectedSystem && detectedCategory !== "other" && typeof saved.system === "string" && saved.system) system = saved.system;
      }

      result.push({
        rowIndex: rowIndex + 1,
        article,
        supplierArticle,
        name,
        qty,
        price,
        retailPrice,
        masterPrice,
        unit: unit || "шт",
        category,
        manufacturer: brand,
        system,
        sourceText: rowText
      });
    }

    return result;
  }

  function getImportableSheets(workbook){
    const result = [];

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:"",blankrows:true});
      const header = findHeaderRow(rows);
      if(!header) return;

      const items = parseSheetRows(rows,header);
      const supplierFullName = detectSupplierFullName(rows,header);

      const hasDualPrices = items.some(item =>
        Number.isFinite(item.retailPrice) && Number.isFinite(item.masterPrice)
      );
      const hasRetailPriceOnly = items.some(item =>
        Number.isFinite(item.retailPrice) && !Number.isFinite(item.masterPrice)
      );
      const hasMasterPriceOnly = items.some(item =>
        Number.isFinite(item.masterPrice) && !Number.isFinite(item.retailPrice)
      );

      console.log(
        "[supplier-import] Аркуш «%s»: позицій=%d, dual=%s, retailOnly=%s, masterOnly=%s",
        sheetName,
        items.length,
        hasDualPrices,
        hasRetailPriceOnly,
        hasMasterPriceOnly
      );

      result.push({
        sheetName, rows, header, items, supplierFullName,
        hasDualPrices, hasRetailPriceOnly, hasMasterPriceOnly
      });
    });

    return result.sort((a,b) => b.items.length - a.items.length);
  }

  function detectInvoiceCurrency(rows,header){
    const source = rows
      .slice(0,Math.min(rows.length,header.rowIndex + 3))
      .flat()
      .map(ntext)
      .join(" ");
    const found = new Set();
    if(/(?:\beur\b|€)/.test(source)) found.add("EUR");
    if(/(?:\buah\b|грн|₴)/.test(source)) found.add("UAH");
    if(/(?:\busd\b|\$)/.test(source)) found.add("USD");
    return found.size === 1 ? Array.from(found)[0] : "";
  }

  function prepareSupplierImport(parsed){
    pendingSupplierImport = parsed.items.map(item => ({...item,include:true}));
    importSupplierFullName = cleanText(parsed.supplierFullName || "");

    const supplierNames = loadSupplierNames();
    importSupplierName = importSupplierFullName && supplierNames[supplierKey(importSupplierFullName)]
      ? supplierNames[supplierKey(importSupplierFullName)]
      : "";

    importHasDualPrices = !!parsed.hasDualPrices;
    importHasRetailPriceOnly = !!parsed.hasRetailPriceOnly;
    importHasMasterPriceOnly = !!parsed.hasMasterPriceOnly;
    importPriceMode = importHasDualPrices ? "auto" : importHasMasterPriceOnly ? "master" : importHasRetailPriceOnly ? "retail" : "";

    const detectedCurrency = detectInvoiceCurrency(parsed.rows,parsed.header);
    importCurrency = detectedCurrency;
    importShowAll = false;

    importEurRate = Number(localStorage.getItem(EUR_RATE_KEY) || importEurRate || 0);
    if(!Number.isFinite(importEurRate) || importEurRate < 0) importEurRate = 0;

    importUsdRate = Number(localStorage.getItem(USD_RATE_KEY) || importUsdRate || 0);
    if(!Number.isFinite(importUsdRate) || importUsdRate < 0) importUsdRate = 0;

    const applyButton = document.getElementById("supplierImportApply");
    applyButton.textContent = "Імпортувати";
    applyButton.onclick = applySupplierImport;
    renderSupplierImport();
    importSheet.classList.add("open");
  }

  function openImportSheetChoice(){
    const body = document.getElementById("supplierImportBody");
    const applyButton = document.getElementById("supplierImportApply");
    body.innerHTML = `
      <div class="importSummary">
        <div class="importSummaryTitle">Оберіть аркуш з товарами</div>
        <select id="supplierImportSheetChoice" style="width:100%;height:40px;border:0;border-radius:10px;background:#eef0f4;padding:0 9px;font-size:13px">
          ${parsedImportSheets.map(sheet => `<option value="${escapeHtml(sheet.sheetName)}" ${sheet.sheetName === selectedImportSheet ? "selected" : ""}>${escapeHtml(sheet.sheetName)} — ${sheet.items.length} поз.</option>`).join("")}
        </select>
      </div>
    `;
    applyButton.textContent = "Продовжити";
    applyButton.onclick = () => {
      const select = document.getElementById("supplierImportSheetChoice");
      const sheet = parsedImportSheets.find(item => item.sheetName === (select && select.value));
      if(sheet) prepareSupplierImport(sheet);
    };
    importSheet.classList.add("open");
  }

  async function handleSupplierFile(event){
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if(!file) return;

    if(typeof XLSX === "undefined"){
      alert("Модуль XLS/XLSX не завантажився.");
      return;
    }

    try{
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer,{type:"array",cellDates:false});
      const sheets = getImportableSheets(workbook);
      const parsed = sheets[0] || null;

      if(!parsed || !parsed.items.length){
        alert("Не вдалося знайти таблицю товарів у цьому рахунку.");
        return;
      }

      if(sheets.length > 1){
        parsedImportSheets = sheets;
        selectedImportSheet = sheets[0].sheetName;
        openImportSheetChoice();
        return;
      }

      prepareSupplierImport(parsed);

    }catch(error){
      console.error("Supplier import error:",error);
      alert("Не вдалося прочитати файл рахунку.");
    }
  }

  function closeSupplierImport(){
    importSheet.classList.remove("open");
    pendingSupplierImport = [];
    importShowAll = false;
    importSupplierName = "";
    importSupplierFullName = "";
    importPriceMode = "";
    importHasDualPrices = false;
    importHasRetailPriceOnly = false;
    importHasMasterPriceOnly = false;
    parsedImportSheets = [];
    selectedImportSheet = "";
  }

  function categoryOptions(selected){
    const values = [
      ["","Не визначено"],
      ["fittings","Арматура"],
      ["water","Водопостачання"],
      ["sewer","Каналізація"],
      ["other","Інше"]
    ];
    return values.map(([value,label]) => `
      <option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>
    `).join("");
  }

  function getImportStats(){
    const stats = { fittings:0, water:0, sewer:0, other:0, unknown:0 };
    activeImportItems().forEach(item => {
      if(item.category && Object.prototype.hasOwnProperty.call(stats,item.category)){
        stats[item.category]++;
      }else{
        stats.unknown++;
      }
    });
    return stats;
  }

  function getImportBrands(){
    return Array.from(new Set(
      activeImportItems().map(item => cleanText(item.manufacturer)).filter(Boolean)
    )).sort((a,b) => a.localeCompare(b,"uk"));
  }

  function updatePendingItem(index,field,value){
    const item = pendingSupplierImport[index];
    if(!item) return;
    item[field] = cleanText(value);
    if(field === "category") item.category = value;
    renderSupplierImport();
  }

  function toggleImportItem(index){
    const item = pendingSupplierImport[index];
    if(!item) return;
    item.include = item.include === false;
    renderSupplierImport();
  }

  function applyBulkCategory(){
    const select = document.getElementById("supplierBulkCategory");
    if(!select) return;
    const value = select.value;
    if(!value) return;
    activeImportItems().forEach(item => {
      if(!item.category) item.category = value;
    });
    renderSupplierImport();
  }

  function updateImportCurrency(){
    const supplierNameInput = document.getElementById("supplierImportName");
    if(supplierNameInput) supplierNameInput.oninput = updateImportSupplier;

    const supplierFullNameInput = document.getElementById("supplierImportFullName");
    if(supplierFullNameInput) supplierFullNameInput.oninput = updateImportSupplier;

    const priceModeSelect = document.getElementById("supplierImportPriceMode");
    if(priceModeSelect) priceModeSelect.onchange = updateImportPriceMode;

    const currencySelect = document.getElementById("supplierImportCurrency");
    const rateInput = document.getElementById("supplierImportEurRate");

    if(currencySelect){
      importCurrency = ["UAH","EUR","USD"].includes(currencySelect.value)
        ? currencySelect.value
        : "";
    }

    if(rateInput){
      rateInput.disabled = !importCurrency;
    }
  }

  function updateImportRate(){
    const input = document.getElementById("supplierImportEurRate");
    if(!input) return;
    const value = Number(String(input.value).replace(",","."));
    importEurRate = Number.isFinite(value) && value >= 0 ? value : 0;
  }

  function updateImportUsdRate(){
    const input = document.getElementById("supplierImportUsdRate");
    if(!input) return;
    const value = Number(String(input.value).replace(",","."));
    importUsdRate = Number.isFinite(value) && value >= 0 ? value : 0;
  }

  function updateImportSupplier(){
    const nameInput = document.getElementById("supplierImportName");
    const fullInput = document.getElementById("supplierImportFullName");
    if(nameInput) importSupplierName = cleanText(nameInput.value);
    if(fullInput) importSupplierFullName = cleanText(fullInput.value);
  }

  function updateImportPriceMode(){
    const select = document.getElementById("supplierImportPriceMode");
    if(select) importPriceMode = select.value;
  }

  function getImportPreview(item){
    const existing = findExistingCatalogItem(item);
    if(!existing) return { kind:"new", label:"Новий товар", existing:null, unitWarning:false };

    const unitWarning = !!(
      existing.unit && item.unit && ntext(existing.unit) !== ntext(item.unit)
    );
    const pair = getImportedPricePair(item,"preview");
    const offer = Array.isArray(existing.supplierOffers)
      ? existing.supplierOffers.find(value => supplierKey(value && value.supplierName) === supplierKey(importSupplierName))
      : null;

    const sameRetail = !pair.retail || (
      offer && Number(offer.retail && offer.retail.priceEUR) === Number(pair.retail.priceEUR)
    );
    const sameMaster = !pair.master || (
      offer && Number(offer.master && offer.master.priceEUR) === Number(pair.master.priceEUR)
    );
    const sameFields =
      ntext(existing.name) === ntext(item.name) &&
      ntext(existing.unit) === ntext(item.unit) &&
      ntext(existing.category) === ntext(item.category) &&
      ntext(existing.manufacturer) === ntext(item.manufacturer) &&
      ntext(existing.system) === ntext(item.system);

    return sameRetail && sameMaster && sameFields
      ? { kind:"same", label:"Без змін", existing, unitWarning }
      : { kind:"update", label:"Буде оновлено", existing, unitWarning };
  }

  function getImportPreviewStats(){
    return activeImportItems().reduce((stats,item) => {
      const kind = getImportPreview(item).kind;
      stats[kind]++;
      return stats;
    },{ new:0, update:0, same:0 });
  }

  function renderSupplierImport(){
    const body = document.getElementById("supplierImportBody");
    if(!pendingSupplierImport.length){
      body.innerHTML = `<div class="importEmpty">Немає даних для імпорту.</div>`;
      return;
    }

    const stats = getImportStats();
    const brands = getImportBrands();
    const activeItems = activeImportItems();
    const allItems = pendingSupplierImport;

    const unknown = activeItems.filter(item => !item.category);
    const visibleItems = importShowAll ? allItems : allItems.slice(0,20);
    const visibleIndexes = visibleItems.map(item => pendingSupplierImport.indexOf(item));

    const knownSuppliers = getKnownSupplierNames();
    const previewStats = getImportPreviewStats();

    body.innerHTML = `

      <div class="importSupplierBox">
        <div class="importSupplierTitle">Постачальник і тип ціни</div>
        <div class="importSupplierFields">
          <input id="supplierImportName" list="supplierImportKnownNames" value="${escapeHtml(importSupplierName)}" placeholder="Коротка назва постачальника">
          <select id="supplierImportPriceMode" ${importHasDualPrices || importHasRetailPriceOnly || importHasMasterPriceOnly ? "disabled" : ""}>
            ${importHasDualPrices
              ? `<option value="auto" selected>Роздрібна + моя ціна</option>`
              : importHasMasterPriceOnly
                ? `<option value="master" selected>Моя ціна (оптова)</option>`
                : importHasRetailPriceOnly
                  ? `<option value="retail" selected>Роздрібна ціна</option>`
              : `<option value="" ${!importPriceMode ? "selected" : ""}>Оберіть тип ціни</option>
                 <option value="retail" ${importPriceMode === "retail" ? "selected" : ""}>Роздрібна ціна</option>
                 <option value="master" ${importPriceMode === "master" ? "selected" : ""}>Моя ціна (оптова)</option>`}
          </select>
          <input class="wide" id="supplierImportFullName" value="${escapeHtml(importSupplierFullName)}" placeholder="Повна назва з рахунку — необов’язково">
        </div>
        <datalist id="supplierImportKnownNames">
          ${knownSuppliers.map(name => `<option value="${escapeHtml(name)}"></option>`).join("")}
        </datalist>
        <div class="importSupplierHint">Колонка "Ціна зі знижкою" трактується як ваша оптова (майстер) ціна. Один товар — одна позиція каталогу.</div>
      </div>

      <div class="importCurrencyBox">
        <div class="importCurrencyTitle">Валюта рахунку</div>

        ${!importCurrency
          ? `<div class="importCurrencyWarning">Не вдалося визначити валюту рахунку. Оберіть її перед імпортом.</div>`
          : ""}

        <div class="importCurrencyFields">
          <select id="supplierImportCurrency">
            <option value="" ${!importCurrency ? "selected" : ""}>Оберіть валюту</option>
            <option value="UAH" ${importCurrency === "UAH" ? "selected" : ""}>UAH</option>
            <option value="EUR" ${importCurrency === "EUR" ? "selected" : ""}>EUR</option>
            <option value="USD" ${importCurrency === "USD" ? "selected" : ""}>USD</option>
          </select>

          ${!importCurrency
            ? `<input disabled placeholder="Спершу оберіть валюту">`
            : importCurrency === "USD"
            ? `<input id="supplierImportUsdRate" inputmode="decimal" value="${importUsdRate > 0 ? escapeHtml(String(importUsdRate)) : ""}" placeholder="Курс USD, грн">`
            : `<input
            id="supplierImportEurRate"
            inputmode="decimal"
            value="${importEurRate > 0 ? escapeHtml(String(importEurRate)) : ""}"
            placeholder="Курс EUR, грн"
          >`}

          ${importCurrency === "USD"
            ? `<input class="wide" id="supplierImportEurRate" inputmode="decimal" value="${importEurRate > 0 ? escapeHtml(String(importEurRate)) : ""}" placeholder="Курс EUR, грн">`
            : ""}
        </div>

        <div class="importCurrencyHint">
          ${!importCurrency
            ? "Система не підставляє UAH автоматично."
            : importCurrency === "EUR"
              ? (importEurRate > 0
                  ? "Курс збережеться лише для цього постачальника. Глобальний курс каталогу не зміниться."
                  : "Ціни збережуться як EUR. Якщо вкажете курс — він застосується лише до цього постачальника.")
              : importCurrency === "UAH"
                ? "Для рахунку в UAH ціна буде переведена в EUR за вказаним курсом."
                : "Ціна в USD буде переведена в EUR за вказаними курсами."}
        </div>
      </div>

      <div class="importSummary">
        <div class="importSummaryTitle">До імпорту: ${activeItems.length} з ${pendingSupplierImport.length} поз.</div>
        <div class="importStats">
          <div class="importStat">Арматура: ${stats.fittings}</div>
          <div class="importStat">Водопостачання: ${stats.water}</div>
          <div class="importStat">Каналізація: ${stats.sewer}</div>
          <div class="importStat">Інше: ${stats.other}</div>
        </div>
        <div class="importBrands">Нові: ${previewStats.new} · Оновлення: ${previewStats.update} · Без змін: ${previewStats.same}</div>
        ${stats.unknown ? `<div class="importWarning">Не визначено: ${stats.unknown}</div>` : ""}
        ${brands.length ? `<div class="importBrands">Бренди: ${brands.map(escapeHtml).join(", ")}</div>` : ""}
      </div>

      ${stats.unknown ? `
        <div class="importBulk">
          <select id="supplierBulkCategory">
            <option value="">Категорія для невизначених</option>
            <option value="fittings">Арматура</option>
            <option value="water">Водопостачання</option>
            <option value="sewer">Каналізація</option>
            <option value="other">Інше</option>
          </select>
          <button class="importSoftButton" id="supplierBulkApply">Застосувати</button>
        </div>
      ` : ""}

      <div class="importToolbar">
        <button class="importSoftButton" id="supplierToggleList">
          ${importShowAll ? "Показати коротко" : "Показати всі позиції"}
        </button>
      </div>

      ${visibleIndexes.map(index => {
        const item = pendingSupplierImport[index];
        const preview = getImportPreview(item);
        return `
          <div class="importItem">
            <div class="importItemName">${escapeHtml(item.name)}</div>
            <div class="importItemMeta">
              ${item.article ? `Артикул: ${escapeHtml(item.article)} · ` : ""}
              ${item.supplierArticle && ntext(item.supplierArticle) !== ntext(item.article)
                ? `Код постачальника: ${escapeHtml(item.supplierArticle)} · ` : ""}
              ${Number.isFinite(item.qty) ? `${item.qty} ${escapeHtml(item.unit)} · ` : ""}
              ${Number.isFinite(item.retailPrice) && Number.isFinite(item.masterPrice)
                ? `Роздріб: ${formatImportPrice(item.retailPrice)} · Моя ціна: ${formatImportPrice(item.masterPrice)}`
                : Number.isFinite(item.masterPrice)
                  ? `Моя ціна: ${formatImportPrice(item.masterPrice)}`
                  : Number.isFinite(item.retailPrice)
                    ? `Роздріб: ${formatImportPrice(item.retailPrice)}`
                    : formatImportPrice(item.price)}
              · <b>${preview.label}</b>
              ${preview.unitWarning ? " · <b>Увага: інша одиниця</b>" : ""}
            </div>
            <div class="importItemFields">
              <button type="button" class="importSoftButton wide" onclick="window.SupplierImportToggle(${index})">
                ${item.include === false ? "Повернути до імпорту" : "Не імпортувати"}
              </button>
              <select onchange="window.SupplierImportUpdate(${index},'category',this.value)">
                ${categoryOptions(item.category)}
              </select>
              <input value="${escapeHtml(item.manufacturer)}" placeholder="Бренд"
                onchange="window.SupplierImportUpdate(${index},'manufacturer',this.value)">
              <input class="wide" value="${escapeHtml(item.system)}" placeholder="Система"
                onchange="window.SupplierImportUpdate(${index},'system',this.value)">
            </div>
          </div>
        `;
      }).join("")}

      ${!importShowAll && !unknown.length && allItems.length > 20 ? `
        <div class="importEmpty">
          Показано перші 20 позицій.<br><br>
          <button type="button" class="importSoftButton" id="supplierShowAll">Показати всі</button>
        </div>
      ` : ""}
    `;

    const currencySelect = document.getElementById("supplierImportCurrency");
    if(currencySelect){
      currencySelect.onchange = () => {
        updateImportCurrency();
        renderSupplierImport();
      };
    }

    const rateInput = document.getElementById("supplierImportEurRate");
    if(rateInput) rateInput.oninput = updateImportRate;

    const usdRateInput = document.getElementById("supplierImportUsdRate");
    if(usdRateInput) usdRateInput.oninput = updateImportUsdRate;

    const bulkButton = document.getElementById("supplierBulkApply");
    if(bulkButton) bulkButton.onclick = applyBulkCategory;

    const showAllButton = document.getElementById("supplierShowAll");
    if(showAllButton) showAllButton.onclick = () => { importShowAll = true; renderSupplierImport(); };

    const toggleButton = document.getElementById("supplierToggleList");
    if(toggleButton) toggleButton.onclick = () => { importShowAll = !importShowAll; renderSupplierImport(); };
  }

  window.SupplierImportUpdate = updatePendingItem;
  window.SupplierImportToggle = toggleImportItem;

  /* ============ matching ============ */

  function findExistingCatalogItem(imported){
    const article = ntext(imported.article);

    if(article){
      const byArticle = catalog.filter(item =>
        item.type === "material" && ntext(item.article) === article
      );
      const brand = ntext(imported.manufacturer);
      const byBrandAndArticle = brand
        ? byArticle.find(item => ntext(item.manufacturer) === brand)
        : null;
      if(byBrandAndArticle) return byBrandAndArticle;
      if(byArticle.length === 1) return byArticle[0];
    }

    const supplierArticle = ntext(imported.supplierArticle);
    if(supplierArticle && importSupplierName){
      const supplier = supplierKey(importSupplierName);
      const bySupplierArticle = catalog.find(item =>
        item.type === "material" &&
        Array.isArray(item.supplierOffers) &&
        item.supplierOffers.some(offer =>
          supplierKey(offer && offer.supplierName) === supplier &&
          ntext(offer && offer.supplierArticle) === supplierArticle
        )
      );
      if(bySupplierArticle) return bySupplierArticle;
    }

    const name = ntext(imported.name);
    if(name){
      return catalog.find(item =>
        item.type === "material" && ntext(item.name) === name
      ) || null;
    }

    return null;
  }

  function makeImportedId(){
    return "import-" + Date.now() + "-" + Math.random().toString(36).slice(2,8);
  }

  function rememberImportRule(item,rules){
    const key = ruleKey(item.article,item.name);
    if(!key) return;
    rules[key] = {
      category: item.category || "",
      manufacturer: item.manufacturer || "",
      system: item.system || ""
    };
  }

  /* ============ price conversion / snapshot ============ */

  function convertImportedPriceToEUR(sourcePrice){
    const number = Number(sourcePrice);
    if(!Number.isFinite(number) || number < 0) return null;
    if(importCurrency === "EUR") return number;
    if(!Number.isFinite(importEurRate) || importEurRate <= 0) return null;
    if(importCurrency === "USD"){
      if(!Number.isFinite(importUsdRate) || importUsdRate <= 0) return null;
      return number * importUsdRate / importEurRate;
    }
    return number / importEurRate;
  }

  function makePriceSnapshot(sourcePrice,importedAt){
    const priceEUR = convertImportedPriceToEUR(sourcePrice);
    if(!Number.isFinite(priceEUR) || priceEUR < 0) return null;

    return {
      priceEUR,
      sourcePrice: Number(sourcePrice),
      sourceCurrency: importCurrency,
      eurRate: importEurRate > 0 ? importEurRate : null,
      usdRate: importCurrency === "USD" ? importUsdRate : null,
      importedAt
    };
  }

  function getImportedPricePair(imported,importedAt){
    let retail = null;
    let master = null;

    if(importHasDualPrices){
      if(Number.isFinite(imported.retailPrice)) retail = makePriceSnapshot(imported.retailPrice,importedAt);
      if(Number.isFinite(imported.masterPrice)) master = makePriceSnapshot(imported.masterPrice,importedAt);
    }else if(importHasRetailPriceOnly){
      retail = makePriceSnapshot(imported.retailPrice,importedAt);
    }else if(importHasMasterPriceOnly){
      master = makePriceSnapshot(imported.masterPrice,importedAt);
    }else if(importPriceMode === "retail"){
      retail = makePriceSnapshot(imported.price,importedAt);
    }else if(importPriceMode === "master"){
      master = makePriceSnapshot(imported.price,importedAt);
    }
    return { retail, master };
  }

  function upsertSupplierOffer(item,pricePair,importedAt,supplierArticle = ""){
    if(!Array.isArray(item.supplierOffers)) item.supplierOffers = [];
    const key = supplierKey(importSupplierName);

    let offer = item.supplierOffers.find(value =>
      supplierKey(value && value.supplierName) === key
    );

    if(!offer){
      offer = {
        supplierId: key,
        supplierName: importSupplierName,
        supplierFullName: importSupplierFullName || "",
        retail: null,
        master: null,
        updatedAt: importedAt
      };
      item.supplierOffers.push(offer);
    }

    offer.supplierId = key;
    offer.supplierName = importSupplierName;
    if(importSupplierFullName) offer.supplierFullName = importSupplierFullName;
    if(supplierArticle) offer.supplierArticle = cleanText(supplierArticle);
    if(pricePair.retail) offer.retail = pricePair.retail;
    if(pricePair.master) offer.master = pricePair.master;
    offer.updatedAt = importedAt;
  }

  function getCatalogRetailPriceEUR(existing,pricePair){
    if(pricePair.retail) return pricePair.retail.priceEUR;
    if(pricePair.master) return pricePair.master.priceEUR;
    const previous = Number(existing && (existing.retailPriceEUR ?? existing.basePriceEUR));
    return Number.isFinite(previous) && previous >= 0 ? previous : 0;
  }

  function getCatalogPurchasePriceEUR(existing,pricePair){
    if(pricePair.master) return pricePair.master.priceEUR;
    const previous = Number(existing && existing.purchasePriceEUR);
    return Number.isFinite(previous) && previous >= 0 ? previous : 0;
  }

  /* ============ apply ============ */

  function applySupplierImport(){
    if(!pendingSupplierImport.length) return;

    updateImportSupplier();
    updateImportPriceMode();
    updateImportCurrency();
    updateImportRate();

    if(!importSupplierName){
      alert("Вкажіть коротку назву постачальника.");
      return;
    }

    if(!importHasDualPrices && !["retail","master"].includes(importPriceMode)){
      alert("Оберіть тип ціни: роздрібна або моя (оптова).");
      return;
    }

    if(!["UAH","EUR","USD"].includes(importCurrency)){
      alert("Оберіть валюту рахунку.");
      return;
    }

    const importItems = activeImportItems();
    if(!importItems.length){
      alert("Позначте хоча б одну позицію для імпорту.");
      return;
    }

    const unresolved = importItems.filter(item => !item.category);
    if(unresolved.length){
      alert(`Залишилось ${unresolved.length} невизначених позицій. Спочатку призначте їм категорію.`);
      return;
    }

    if(
      importCurrency !== "EUR" &&
      (!Number.isFinite(importEurRate) || importEurRate <= 0)
    ){
      alert("Вкажіть коректний курс EUR.");
      return;
    }

    if(
      importCurrency === "EUR" &&
      importEurRate !== 0 &&
      (!Number.isFinite(importEurRate) || importEurRate < 0)
    ){
      alert("Курс EUR має бути додатним числом або порожнім.");
      return;
    }

    if(
      importCurrency === "USD" &&
      (!Number.isFinite(importUsdRate) || importUsdRate <= 0)
    ){
      alert("Вкажіть коректний курс USD.");
      return;
    }

    const rules = loadImportRules();
    const importedAt = new Date().toISOString();

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    const unitConflicts = importItems
      .map(item => ({ item, preview: getImportPreview(item) }))
      .filter(value => value.preview.unitWarning);

    if(unitConflicts.length){
      alert(
        "Імпорт зупинено: для частини знайдених товарів відрізняється одиниця виміру.\n\n" +
        unitConflicts.slice(0,8).map(value =>
          value.item.name + ": у каталозі «" + value.preview.existing.unit + "», у файлі «" + value.item.unit + "»"
        ).join("\n") +
        (unitConflicts.length > 8 ? "\n…" : "")
      );
      return;
    }

    for(const imported of importItems){
      const pricePair = getImportedPricePair(imported,importedAt);
      if(!pricePair.retail && !pricePair.master){
        alert(`Не вдалося визначити ціну для позиції:\n${imported.name}`);
        return;
      }
    }

    importItems.forEach(imported => {
      rememberImportRule(imported,rules);

      const pricePair = getImportedPricePair(imported,importedAt);
      const existing = findExistingCatalogItem(imported);
      const preview = getImportPreview(imported);

      if(existing && preview.kind === "same"){
        unchanged++;
        return;
      }

      if(existing){
        const retailPriceEUR = getCatalogRetailPriceEUR(existing,pricePair);
        const purchasePriceEUR = getCatalogPurchasePriceEUR(existing,pricePair);

        existing.name = imported.name;
        if(!existing.estimateName) existing.estimateName = imported.name;

        existing.retailPriceEUR = retailPriceEUR;
        existing.purchasePriceEUR = purchasePriceEUR;
        existing.basePriceEUR = retailPriceEUR;

        delete existing.price;

        existing.unit = imported.unit || "шт";
        existing.category = imported.category;
        existing.manufacturer = imported.manufacturer || "";
        existing.system = imported.system || "";
        existing.article = imported.article || existing.article || "";

        upsertSupplierOffer(existing,pricePair,importedAt,imported.supplierArticle);
        updated++;
      }else{
        const retailPriceEUR = getCatalogRetailPriceEUR(null,pricePair);
        const purchasePriceEUR = getCatalogPurchasePriceEUR(null,pricePair);

        catalog.push({
          id: makeImportedId(),
          name: imported.name,
          estimateName: imported.name,
          type: "material",
          category: imported.category,
          manufacturer: imported.manufacturer || "",
          system: imported.system || "",
          article: imported.article || "",
          retailPriceEUR,
          purchasePriceEUR,
          basePriceEUR: retailPriceEUR,
          unit: imported.unit || "шт",
          supplierOffers: []
        });

        const createdItem = catalog[catalog.length - 1];
        upsertSupplierOffer(createdItem,pricePair,importedAt,imported.supplierArticle);
        created++;
      }
    });

    saveImportRules(rules);

    if(importSupplierFullName){
      const supplierNames = loadSupplierNames();
      supplierNames[supplierKey(importSupplierFullName)] = importSupplierName;
      saveSupplierNames(supplierNames);
    }

    saveCatalog();

    const supplierNameForAlert = importSupplierName;
    const rateInfo = importEurRate > 0 ? `\nКурс для цього постачальника: ${importEurRate} грн/€` : "";

    closeSupplierImport();

    renderFilters();
    renderBrandFilters();
    renderSystemFilters();
    renderCatalog();

    alert(
      `Імпорт завершено.\nПостачальник: ${supplierNameForAlert}${rateInfo}\nДодано: ${created}\nОновлено: ${updated}\nБез змін: ${unchanged}`
    );
  }

})();