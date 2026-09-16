/* =========================
   SUPPLIER XLS/XLSX IMPORT v8.9
   - "Ціна зі знижкою" = ціна майстра (оптова)
   - Курс EUR зберігається per-supplier у снапшотах цін
   - Виправлено: isGeneric, fallback retail←master
   - Прибрано кнопку "₴ Ціни" та діагностичну шторку
========================= */

(function initSupplierImport(){

  const CATEGORY_LABELS = {
    fittings:"Арматура",
    water:"Водопостачання",
    sewer:"Каналізація",
    other:"Інше",
    "":"Не визначено"
  };

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

  const style = document.createElement("style");
  style.textContent = `
    .importButton{height:32px;padding:0 9px;border-radius:9px;background:#e9ebef;color:var(--blue);font-size:12px;font-weight:700;display:none}
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

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".xls,.xlsx,.xlsm";
  fileInput.style.display = "none";
  fileInput.id = "supplierImportFile";
  document.body.appendChild(fileInput);

  const panelHeadRight = document.querySelector(".panelHeadRight");
  const catalogEditButton = document.getElementById("catalogEditButton");

  const importButton = document.createElement("button");
  importButton.className = "importButton";
  importButton.id = "supplierImportButton";
  importButton.textContent = "⇩ Імпорт";
  importButton.type = "button";
  importButton.onclick = () => fileInput.click();

  if(panelHeadRight && catalogEditButton){
    panelHeadRight.insertBefore(importButton, catalogEditButton);
  }else if(panelHeadRight){
    panelHeadRight.appendChild(importButton);
  }

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

  fileInput.addEventListener("change", handleSupplierFile);

  const originalOpenCatalog = window.openCatalog;

  window.openCatalog = function(type){
    if(typeof originalOpenCatalog === "function"){
      originalOpenCatalog(type);
    }
    importButton.style.display = type === "material" ? "block" : "none";
  };

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
          discountPriceCol: resolved.discountPriceCol,
          _diag: {
            retailCol: info.retailCol,
            masterCol: info.masterCol,
            genericCol: info.genericCol
          }
        };

        if(!best || candidate.score > best.score){
          best = candidate;
        }
      }
    });

    if(best){
      console.log(
        "[supplier-import] Header row %d → name=%d, article=%d, qty=%d, price=%d, retail=%d, master=%d (retailCol=%d masterCol=%d genericCol=%d)",
        best.rowIndex,
        best.nameHeaderCol,
        best.articleCol,
        best.qtyCol,
        best.priceCol,
        best.regularPriceCol,
        best.discountPriceCol,
        best._diag.retailCol,
        best._diag.masterCol,
        best._diag.genericCol
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
      [/go[\s-