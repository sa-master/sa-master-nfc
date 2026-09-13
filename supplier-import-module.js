    /* =========================
       SUPPLIER XLS/XLSX IMPORT v7
       Safe add-on: catalog only
    ========================= */

    (function initSupplierImport(){

      const CATEGORY_LABELS = {
        fittings:"Арматура",
        water:"Водопостачання",
        sewer:"Каналізація",
        other:"Інше",
        "":"Не визначено"
      };

      const IMPORT_RULES_KEY =
        "plumber_importRules";

      const EUR_RATE_KEY =
        "plumber_eurRate";

      const SUPPLIER_NAMES_KEY =
        "plumber_supplierNames";

      let pendingSupplierImport = [];
      let importShowAll = false;
      let importCurrency = "UAH";
      let importSupplierName = "";
      let importSupplierFullName = "";
      let importPriceMode = "";
      let importHasDualPrices = false;

      let importEurRate =
        Number(
          localStorage.getItem(
            EUR_RATE_KEY
          ) || 0
        );

      if(
        !Number.isFinite(importEurRate) ||
        importEurRate < 0
      ){
        importEurRate = 0;
      }

      const style =
        document.createElement("style");

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
        .importCurrencyFields,.importSupplierFields{display:grid;grid-template-columns:1fr 1fr;gap:7px}
        .importCurrencyFields select,.importCurrencyFields input,.importSupplierFields select,.importSupplierFields input{width:100%;height:36px;border:0;border-radius:9px;background:#eef0f4;padding:0 9px;font-size:12px;outline:0}
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

      const fileInput =
        document.createElement("input");

      fileInput.type = "file";
      fileInput.accept = ".xls,.xlsx,.xlsm";
      fileInput.style.display = "none";
      fileInput.id = "supplierImportFile";

      document.body.appendChild(
        fileInput
      );

      const panelHeadRight =
        document.querySelector(
          ".panelHeadRight"
        );

      const importButton =
        document.createElement(
          "button"
        );

      importButton.className =
        "importButton";

      importButton.id =
        "supplierImportButton";

      importButton.textContent =
        "⇩ Імпорт";

      importButton.type =
        "button";

      importButton.onclick =
        () => fileInput.click();

      panelHeadRight.insertBefore(
        importButton,
        document.getElementById(
          "catalogEditButton"
        )
      );

      const importSheet =
        document.createElement(
          "div"
        );

      importSheet.className =
        "importSheet";

      importSheet.id =
        "supplierImportSheet";

      importSheet.innerHTML = `
        <div class="importPanel">

          <div class="importHead">

            <strong>
              Перевірка імпорту
            </strong>

            <button
              class="close"
              id="supplierImportClose"
            >
              ×
            </button>

          </div>

          <div
            class="importBody"
            id="supplierImportBody"
          ></div>

          <div class="importFooter">

            <button
              class="importCancel"
              id="supplierImportCancel"
            >
              Скасувати
            </button>

            <button
              class="importApply"
              id="supplierImportApply"
            >
              Імпортувати
            </button>

          </div>

        </div>
      `;

      document.body.appendChild(
        importSheet
      );

      document.getElementById(
        "supplierImportClose"
      ).onclick =
        closeSupplierImport;

      document.getElementById(
        "supplierImportCancel"
      ).onclick =
        closeSupplierImport;

      document.getElementById(
        "supplierImportApply"
      ).onclick =
        applySupplierImport;

      importSheet.addEventListener(
        "click",
        event => {

          if(
            event.target ===
            importSheet
          ){
            closeSupplierImport();
          }
        }
      );

      fileInput.addEventListener(
        "change",
        handleSupplierFile
      );

      const originalOpenCatalog =
        window.openCatalog;

      window.openCatalog =
        function(type){

          originalOpenCatalog(type);

          importButton.style.display =
            type === "material"
              ? "block"
              : "none";
        };

      function cleanText(value){

        return String(value ?? "")
          .replace(/\u00a0/g," ")
          .replace(/[\r\n]+/g," ")
          .replace(/\s+/g," ")
          .trim();
      }

      function ntext(value){

        return cleanText(value)
          .toLowerCase();
      }

      function parseNumber(value){

        if(
          typeof value === "number" &&
          Number.isFinite(value)
        ){
          return value;
        }

        let text =
          cleanText(value)
            .replace(/[\s\u00A0']/g,"")
            .replace(/грн\.?/gi,"")
            .replace(/[^0-9,.-]/g,"");

        if(
          !text ||
          text === "-" ||
          text === "." ||
          text === ","
        ){
          return null;
        }

        const lastComma =
          text.lastIndexOf(",");

        const lastDot =
          text.lastIndexOf(".");

        if(
          lastComma >= 0 &&
          lastDot >= 0
        ){

          const decimalSeparator =
            lastComma > lastDot
              ? ","
              : ".";

          const thousandsSeparator =
            decimalSeparator === ","
              ? "."
              : ",";

          text =
            text
              .split(thousandsSeparator)
              .join("")
              .replace(
                decimalSeparator,
                "."
              );

        }else if(lastComma >= 0){

          const parts =
            text.split(",");

          if(
            parts.length > 2 ||
            (
              parts.length === 2 &&
              parts[1].length === 3 &&
              parts[0].replace("-","").length <= 3
            )
          ){
            text = parts.join("");
          }else{
            text = text.replace(",", ".");
          }

        }else if(lastDot >= 0){

          const parts =
            text.split(".");

          if(
            parts.length > 2 &&
            parts[parts.length - 1].length === 3
          ){
            text = parts.join("");
          }
        }

        if(
          !text ||
          text === "-" ||
          text === "." ||
          text === "-."
        ){
          return null;
        }

        const number =
          Number(text);

        return Number.isFinite(number)
          ? number
          : null;
      }

      function formatImportPrice(value){

        const number =
          Number(value);

        if(
          !Number.isFinite(number)
        ){
          return "";
        }

        const formatted =
          number.toLocaleString(
            "uk-UA",
            {
              minimumFractionDigits:2,
              maximumFractionDigits:2
            }
          );

        return importCurrency === "EUR"
          ? formatted + " EUR"
          : formatted + " грн";
      }

      function isUnit(value){

        const text =
          ntext(value)
            .replace(/\./g,"");

        return /^(шт|м|м2|м²|м3|м³|компл|упак|уп|кг|л|погм|пог м|pcs|pc)$/
          .test(text);
      }

      function isLikelyArticle(value){

        const text =
          cleanText(value);

        return (
          text.length > 0 &&
          text.length < 40 &&
          /[0-9a-zа-яіїєґ]/i
            .test(text)
        );
      }

      function findHeaderRow(rows){

        let best = null;

        rows
          .slice(0,60)
          .forEach(
            (row,rowIndex) => {

              let score = 0;
              let articleCol = -1;
              let qtyCol = -1;
              let nameHeaderCol = -1;

              let genericPriceCol = -1;
              let explicitRetailPriceCol = -1;
              let explicitMasterPriceCol = -1;

              row.forEach(
                (cell,col) => {

                  const text =
                    ntext(cell);

                  if(!text){
                    return;
                  }

                  if(
                    /артикул|код товар|код$|sku/
                      .test(text)
                  ){

                    score += 4;

                    if(
                      articleCol < 0
                    ){
                      articleCol = col;
                    }
                  }

                  if(
                    /кількість|количество|к-сть|qty/
                      .test(text)
                  ){

                    score += 4;

                    if(
                      qtyCol < 0
                    ){
                      qtyCol = col;
                    }
                  }

                  const isExplicitRetailPrice =
                    /ціна.*без\s*зниж|цена.*без\s*скид|retail.*price|list.*price/
                      .test(text);

                  const isExplicitMasterPrice =
                    /ціна.*(зі|з)\s*зниж|цена.*(со|с)\s*скид|ціна.*після.*зниж|цена.*после.*скид|discount.*price/
                      .test(text) &&
                    !isExplicitRetailPrice;

                  const isGenericPrice =
                    /(^|\s)ціна($|\s)|(^|\s)цена($|\s)|^price$/
                      .test(text) &&
                    !isExplicitRetailPrice &&
                    !isExplicitMasterPrice;

                  if(
                    isExplicitRetailPrice &&
                    explicitRetailPriceCol < 0
                  ){
                    explicitRetailPriceCol = col;
                    score += 5;
                  }

                  if(
                    isExplicitMasterPrice &&
                    explicitMasterPriceCol < 0
                  ){
                    explicitMasterPriceCol = col;
                    score += 5;
                  }

                  if(
                    isGenericPrice &&
                    genericPriceCol < 0
                  ){
                    genericPriceCol = col;
                    score += 4;
                  }

                  if(
                    /товар|найменув|наименов|назва|именование|product/
                      .test(text)
                  ){

                    score += 3;

                    if(
                      nameHeaderCol < 0
                    ){
                      nameHeaderCol = col;
                    }
                  }
                }
              );

              let regularPriceCol = -1;
              let discountPriceCol = -1;
              let priceCol = -1;

              if(
                explicitRetailPriceCol >= 0 &&
                genericPriceCol >= 0
              ){
                regularPriceCol =
                  explicitRetailPriceCol;

                discountPriceCol =
                  genericPriceCol;

                priceCol =
                  genericPriceCol;

              }else if(
                explicitMasterPriceCol >= 0 &&
                genericPriceCol >= 0
              ){
                regularPriceCol =
                  genericPriceCol;

                discountPriceCol =
                  explicitMasterPriceCol;

                priceCol =
                  explicitMasterPriceCol;

              }else if(
                explicitRetailPriceCol >= 0
              ){
                priceCol =
                  explicitRetailPriceCol;

              }else if(
                explicitMasterPriceCol >= 0
              ){
                priceCol =
                  explicitMasterPriceCol;

              }else if(
                genericPriceCol >= 0
              ){
                priceCol =
                  genericPriceCol;
              }

              if(
                qtyCol >= 0 &&
                priceCol >= 0 &&
                nameHeaderCol >= 0 &&
                score >= 11
              ){

                if(
                  !best ||
                  score > best.score
                ){

                  best = {
                    rowIndex,
                    score,
                    articleCol,
                    qtyCol,
                    priceCol,
                    regularPriceCol,
                    discountPriceCol,
                    nameHeaderCol
                  };
                }
              }
            }
          );

        return best;
      }

      function detectDataColumns(
        rows,
        header
      ){

        const sample =
          rows.slice(
            header.rowIndex + 1,
            header.rowIndex + 45
          );

        const startName =
          Math.max(
            0,
            header.nameHeaderCol >= 0
              ? header.nameHeaderCol
              : (
                  header.articleCol >= 0
                    ? header.articleCol + 1
                    : 0
                )
          );

        const endName =
          Math.max(
            startName,
            header.qtyCol - 1
          );

        let nameCol =
          startName;

        let bestNameScore =
          -1;

        for(
          let col = startName;
          col <= endName;
          col++
        ){

          let count = 0;
          let chars = 0;

          sample.forEach(
            row => {

              const value =
                cleanText(
                  row[col]
                );

              if(
                value &&
                !isUnit(value) &&
                parseNumber(value) === null &&
                value.length >= 4
              ){

                count++;
                chars +=
                  value.length;
              }
            }
          );

          const score =
            count * 100 +
            chars;

          if(
            score >
            bestNameScore
          ){

            bestNameScore =
              score;

            nameCol =
              col;
          }
        }

        let unitCol =
          -1;

        let bestUnitScore =
          0;

        const maxCols =
          Math.max(
            ...sample.map(
              row => row.length
            ),
            header.priceCol + 1,
            header.qtyCol + 1
          );

        for(
          let col = 0;
          col < maxCols;
          col++
        ){

          if(
            col === nameCol ||
            col === header.articleCol ||
            col === header.qtyCol ||
            col === header.priceCol
          ){
            continue;
          }

          let score = 0;

          sample.forEach(
            row => {

              if(
                isUnit(
                  row[col]
                )
              ){
                score++;
              }
            }
          );

          if(
            score >
            bestUnitScore
          ){

            bestUnitScore =
              score;

            unitCol =
              col;
          }
        }

        return {
          articleCol:
            header.articleCol,

          qtyCol:
            header.qtyCol,

          priceCol:
            header.priceCol,

          regularPriceCol:
            header.regularPriceCol ?? -1,

          discountPriceCol:
            header.discountPriceCol ?? -1,

          nameCol,

          unitCol
        };
      }

      function loadSupplierNames(){
        try{
          const value = JSON.parse(localStorage.getItem(SUPPLIER_NAMES_KEY) || "{}");
          return value && typeof value === "object" ? value : {};
        }catch{
          return {};
        }
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

      function loadImportRules(){

        try{

          const value =
            JSON.parse(
              localStorage.getItem(
                IMPORT_RULES_KEY
              ) || "{}"
            );

          return (
            value &&
            typeof value ===
              "object"
          )
            ? value
            : {};

        }catch{

          return {};
        }
      }

      function saveImportRules(
        rules
      ){

        localStorage.setItem(
          IMPORT_RULES_KEY,
          JSON.stringify(
            rules
          )
        );
      }

      function ruleKey(
        article,
        name
      ){

        const a =
          ntext(article);

        if(a){
          return "a:" + a;
        }

        return (
          "n:" +
          ntext(name)
        );
      }

      function detectBrand(
        text,
        article = ""
      ){

        const source =
          ntext(
            text +
            " " +
            article
          );

        const rules = [

          [
            /go[\s-]*plast/,
            "GO-PLAST"
          ],

          [
            /\bviega\b/,
            "Viega"
          ],

          [
            /k[\s-]*flex/,
            "K-FLEX"
          ],

          [
            /\boventrop\b/,
            "Oventrop"
          ],

          [
            /\bresideo\b/,
            "Resideo"
          ],

          [
            /\batlas\b/,
            "Atlas"
          ],

          [
            /\beurocarb\b/,
            "Eurocarb"
          ],

          [
            /\bpurolite\b/,
            "Purolite"
          ],

          [
            /\bciech\b/,
            "Ciech"
          ],

          [
            /\bvalsir\b/,
            "Valsir"
          ],

          [
            /\bwurth\b|\bwürth\b/,
            "WURTH"
          ],

          [
            /geberit/,
            "Geberit"
          ],

          [
            /ostendorf|htsafe|нтsafe|нт safe|ht safe/,
            "Ostendorf"
          ],

          [
            /\btece\b|teceflex|tecefloor/,
            "TECE"
          ],

          [
            /pattaroni/,
            "PATTARONI"
          ],

          [
            /bonomi/,
            "Bonomi"
          ],

          [
            /tiemme/,
            "Tiemme"
          ],

          [
            /walraven|\bbis\b/,
            "Walraven"
          ],

          [
            /sanflex/,
            "Sanflex"
          ],

          [
            /meibes/,
            "Meibes"
          ],

          [
            /simplex/,
            "Simplex"
          ],

          [
            /\bhl\d|\bhl\b/,
            "HL"
          ],

          [
            /\bnmc\b/,
            "NMC"
          ]

        ];

        for(
          const [
            pattern,
            label
          ] of rules
        ){

          if(
            pattern.test(
              source
            )
          ){
            return label;
          }
        }

        return "";
      }

      function detectSystem(
        text,
        brand = ""
      ){

        const source =
          ntext(text);

        const rules = [

          [
            /flow[\s-]*fit/,
            "FlowFit"
          ],

          [
            /tece[\s-]*flex/,
            "TECEflex"
          ],

          [
            /tece[\s-]*floor/,
            "TECEfloor"
          ],

          [
            /ht[\s-]*safe|нт[\s-]*safe/,
            "HTsafe"
          ],

          [
            /sanflex[\s-]*stabil/,
            "Sanflex Stabil"
          ]

        ];

        for(
          const [
            pattern,
            label
          ] of rules
        ){

          if(
            pattern.test(
              source
            )
          ){
            return label;
          }
        }

        return "";
      }

      function detectCategory(
        text,
        brand = "",
        system = ""
      ){

        const source =
          ntext(
            text +
            " " +
            brand +
            " " +
            system
          );

        if(
          /каналіз|канализ|sewer|htsafe|ht safe|відвід.*канал|отвод.*канал|канализац/
            .test(source)
        ){
          return "sewer";
        }

        if(
          /flowfit|teceflex|tece flex|водопостач|водоснаб|водопров|труба.*вода|фітинг.*вода|фитинг.*вода|фільтр|фильтр|пом['’]?якш|умягч|водоочист|очищенн.*вод|аніоніт|анионит|purolite|вугілля|уголь|сіль таблет|соль таблет|atlas premier|eurocarb|ciech/
            .test(source)
        ){
          return "water";
        }

        if(
          /запірн|запорн|кран|вентил|клапан|редуктор тиску|редуктор давления|колектор|коллектор|pattaroni|bonomi|tiemme|simplex/
            .test(source)
        ){
          return "fittings";
        }

        if(
          /комплектуюч|комплектующ|кріплен|креплен|хомут|дюбел|шуруп|ізоляц|изоляц|рукавиц|перчатк|manometr|манометр|k[\s-]*flex|sanflex|walraven|wurth|würth/
            .test(source)
        ){
          return "other";
        }

        return "";
      }

      function classifyHeading(
        text,
        context
      ){

        const clean =
          cleanText(text);

        const source =
          ntext(clean);

        if(!source){
          return false;
        }

        if(
          /каналіз|канализ/
            .test(source)
        ){

          context.category =
            "sewer";

          context.brand = "";
          context.system = "";

          return true;
        }

        if(
          /водопостач|водоснаб|водопров/
            .test(source)
        ){

          context.category =
            "water";

          context.brand = "";
          context.system = "";

          return true;
        }

        if(
          /запірн.*арматур|запорн.*арматур/
            .test(source)
        ){

          context.category =
            "fittings";

          context.brand = "";
          context.system = "";

          return true;
        }

        if(
          /комплектуюч|комплектующ|кріплен|креплен|ізоляц|изоляц/
            .test(source)
        ){

          context.category =
            "other";

          const headingBrand =
            detectBrand(clean);

          const headingSystem =
            detectSystem(
              clean,
              headingBrand
            );

          context.brand =
            headingBrand || "";

          context.system =
            headingSystem || "";

          return true;
        }

        const brand =
          detectBrand(clean);

        const system =
          detectSystem(
            clean,
            brand
          );

        if(system){

          context.system =
            system;

          if(!context.brand){

            context.brand =
              detectBrand(
                system
              );
          }

          const category =
            detectCategory(
              clean,
              context.brand,
              system
            );

          if(category){
            context.category =
              category;
          }

          return true;
        }

        if(brand){

          context.brand =
            brand;

          context.system = "";

          const category =
            detectCategory(
              clean,
              brand,
              ""
            );

          if(category){
            context.category =
              category;
          }

          return true;
        }

        return false;
      }

      function getRowText(
        row,
        from = 0,
        to = null
      ){

        const end =
          to === null
            ? row.length - 1
            : Math.min(
                to,
                row.length - 1
              );

        const parts = [];

        for(
          let i = from;
          i <= end;
          i++
        ){

          const value =
            cleanText(row[i]);

          if(value){
            parts.push(value);
          }
        }

        return parts.join(" ");
      }

      function extractArticleFromName(
        name
      ){

        const text =
          cleanText(name);

        if(!text){
          return "";
        }

        const match =
          text.match(
            /(?:^|\s)([A-ZА-ЯІЇЄҐ0-9][A-ZА-ЯІЇЄҐ0-9._-]{3,})$/i
          );

        if(!match){
          return "";
        }

        const candidate =
          cleanText(
            match[1]
          );

        if(
          !/\d/.test(candidate)
        ){
          return "";
        }

        if(
          /^\d+(?:[.,]\d+)?$/
            .test(candidate)
        ){
          return "";
        }

        return candidate;
      }

      function parseSheetRows(
        rows,
        header
      ){

        const columns =
          detectDataColumns(
            rows,
            header
          );

        const result = [];

        const context = {
          category:"",
          brand:"",
          system:""
        };

        const savedRules =
          loadImportRules();

        let emptyStreak = 0;

        for(
          let rowIndex =
            header.rowIndex + 1;

          rowIndex < rows.length;

          rowIndex++
        ){

          const row =
            rows[rowIndex] || [];

          const rowText =
            getRowText(row);

          if(!rowText){

            emptyStreak++;

            if(
              emptyStreak > 15 &&
              result.length
            ){
              break;
            }

            continue;
          }

          emptyStreak = 0;

          const name =
            cleanText(
              row[
                columns.nameCol
              ]
            );

          const article =
            columns.articleCol >= 0
              ? cleanText(
                  row[
                    columns.articleCol
                  ]
                )
              : extractArticleFromName(
                  name
                );

          const qty =
            parseNumber(
              row[
                columns.qtyCol
              ]
            );

          const price =
            parseNumber(
              row[
                columns.priceCol
              ]
            );

          const retailPrice =
            columns.regularPriceCol >= 0
              ? parseNumber(row[columns.regularPriceCol])
              : null;

          const masterPrice =
            columns.discountPriceCol >= 0
              ? parseNumber(row[columns.discountPriceCol])
              : null;

          const unit =
            columns.unitCol >= 0
              ? cleanText(
                  row[
                    columns.unitCol
                  ]
                )
              : "";

          const hasProductShape =
            name &&
            qty !== null &&
            qty > 0 &&
            price !== null &&
            price >= 0;

          if(!hasProductShape){

            const lower =
              ntext(rowText);

            if(
              /разом|всього|итого|всего|пдв|ндс|до сплати|к оплате/
                .test(lower)
            ){
              continue;
            }

            classifyHeading(
              rowText,
              context
            );

            continue;
          }

          if(
            !isLikelyArticle(article) &&
            !name
          ){
            continue;
          }

          let brand =
            context.brand || "";

          let system =
            context.system || "";

          let category =
            context.category || "";

          const detectedBrand =
            detectBrand(
              name,
              article
            );

          const detectedSystem =
            detectSystem(
              name,
              detectedBrand ||
              brand
            );

          if(detectedBrand){
            brand =
              detectedBrand;
          }

          if(detectedSystem){
            system =
              detectedSystem;
          }

          const detectedCategory =
            detectCategory(
              name,
              detectedBrand ||
              "",
              detectedSystem ||
              ""
            );

          if(detectedCategory){
            category =
              detectedCategory;
          }

          if(
            detectedCategory === "other"
          ){
            if(!detectedBrand){

              const sourceName =
                ntext(name);

              const keepWalravenContext =
                context.brand === "Walraven" &&
                /\bbis\b|\b2s\b|\bwup\b|хомут|дюбел|шуруп|гвинт|винт|кріплен|креплен/
                  .test(sourceName);

              brand =
                keepWalravenContext
                  ? "Walraven"
                  : "";
            }

            if(!detectedSystem){
              system = "";
            }
          }

          const key =
            ruleKey(
              article,
              name
            );

          const saved =
            savedRules[key];

          if(saved){

            if(
              !category &&
              typeof saved.category ===
              "string"
            ){
              category =
                saved.category;
            }

            if(
              !detectedBrand &&
              detectedCategory !== "other" &&
              typeof saved.manufacturer ===
              "string" &&
              saved.manufacturer
            ){
              brand =
                saved.manufacturer;
            }

            if(
              !detectedSystem &&
              detectedCategory !== "other" &&
              typeof saved.system ===
              "string" &&
              saved.system
            ){
              system =
                saved.system;
            }
          }

          result.push({

            rowIndex:
              rowIndex + 1,

            article,

            name,

            qty,

            price,

            retailPrice,

            masterPrice,

            unit:
              unit || "шт",

            category,

            manufacturer:
              brand,

            system,

            sourceText:
              rowText

          });
        }

        return result;
      }

      function chooseBestSheet(
        workbook
      ){

        let best = null;

        workbook.SheetNames
          .forEach(
            sheetName => {

              const sheet =
                workbook.Sheets[
                  sheetName
                ];

              const rows =
                XLSX.utils.sheet_to_json(
                  sheet,
                  {
                    header:1,
                    raw:false,
                    defval:"",
                    blankrows:true
                  }
                );

              const header =
                findHeaderRow(rows);

              if(!header){
                return;
              }

              const items =
                parseSheetRows(
                  rows,
                  header
                );

              const supplierFullName =
                detectSupplierFullName(rows,header);

              const hasDualPrices =
                items.some(item =>
                  Number.isFinite(item.retailPrice) &&
                  Number.isFinite(item.masterPrice)
                );

              if(
                !best ||
                items.length >
                best.items.length
              ){

                best = {
                  sheetName,
                  rows,
                  header,
                  items,
                  supplierFullName,
                  hasDualPrices
                };
              }
            }
          );

        return best;
      }

      async function handleSupplierFile(
        event
      ){

        const file =
          event.target.files &&
          event.target.files[0];

        event.target.value = "";

        if(!file){
          return;
        }

        if(
          typeof XLSX ===
          "undefined"
        ){

          alert(
            "Модуль XLS/XLSX не завантажився."
          );

          return;
        }

        try{

          const buffer =
            await file.arrayBuffer();

          const workbook =
            XLSX.read(
              buffer,
              {
                type:"array",
                cellDates:false
              }
            );

          const parsed =
            chooseBestSheet(
              workbook
            );

          if(
            !parsed ||
            !parsed.items.length
          ){

            alert(
              "Не вдалося знайти таблицю товарів у цьому рахунку."
            );

            return;
          }

          pendingSupplierImport =
            parsed.items;

          importSupplierFullName =
            cleanText(parsed.supplierFullName || "");

          const supplierNames = loadSupplierNames();
          importSupplierName =
            importSupplierFullName && supplierNames[supplierKey(importSupplierFullName)]
              ? supplierNames[supplierKey(importSupplierFullName)]
              : "";

          importHasDualPrices = !!parsed.hasDualPrices;
          importPriceMode = importHasDualPrices ? "auto" : "";

          importShowAll = false;

          importEurRate =
            Number(
              localStorage.getItem(
                EUR_RATE_KEY
              ) || importEurRate || 0
            );

          if(
            !Number.isFinite(importEurRate) ||
            importEurRate < 0
          ){
            importEurRate = 0;
          }

          renderSupplierImport();

          importSheet.classList.add(
            "open"
          );

        }catch(error){

          console.error(
            "Supplier import error:",
            error
          );

          alert(
            "Не вдалося прочитати файл рахунку."
          );
        }
      }

      function closeSupplierImport(){

        importSheet.classList.remove(
          "open"
        );

        pendingSupplierImport = [];
        importShowAll = false;
        importSupplierName = "";
        importSupplierFullName = "";
        importPriceMode = "";
        importHasDualPrices = false;
      }

      function categoryOptions(
        selected
      ){

        const values = [
          ["","Не визначено"],
          ["fittings","Арматура"],
          ["water","Водопостачання"],
          ["sewer","Каналізація"],
          ["other","Інше"]
        ];

        return values
          .map(
            ([value,label]) => `
              <option
                value="${value}"
                ${
                  value === selected
                    ? "selected"
                    : ""
                }
              >
                ${label}
              </option>
            `
          )
          .join("");
      }

      function getImportStats(){

        const stats = {
          fittings:0,
          water:0,
          sewer:0,
          other:0,
          unknown:0
        };

        pendingSupplierImport
          .forEach(
            item => {

              if(
                item.category &&
                Object.prototype
                  .hasOwnProperty.call(
                    stats,
                    item.category
                  )
              ){

                stats[
                  item.category
                ]++;

              }else{

                stats.unknown++;
              }
            }
          );

        return stats;
      }

      function getImportBrands(){

        return Array.from(
          new Set(
            pendingSupplierImport
              .map(
                item =>
                  cleanText(
                    item.manufacturer
                  )
              )
              .filter(Boolean)
          )
        )
        .sort(
          (a,b) =>
            a.localeCompare(
              b,
              "uk"
            )
        );
      }

      function updatePendingItem(
        index,
        field,
        value
      ){

        const item =
          pendingSupplierImport[index];

        if(!item){
          return;
        }

        item[field] =
          cleanText(value);

        if(
          field === "category"
        ){
          item.category =
            value;
        }

        renderSupplierImport();
      }

      function applyBulkCategory(){

        const select =
          document.getElementById(
            "supplierBulkCategory"
          );

        if(!select){
          return;
        }

        const value =
          select.value;

        if(!value){
          return;
        }

        pendingSupplierImport
          .forEach(
            item => {

              if(!item.category){
                item.category =
                  value;
              }
            }
          );

        renderSupplierImport();
      }

      function updateImportCurrency(){

        const supplierNameInput = document.getElementById("supplierImportName");
        if(supplierNameInput) supplierNameInput.oninput = updateImportSupplier;

        const supplierFullNameInput = document.getElementById("supplierImportFullName");
        if(supplierFullNameInput) supplierFullNameInput.oninput = updateImportSupplier;

        const priceModeSelect = document.getElementById("supplierImportPriceMode");
        if(priceModeSelect) priceModeSelect.onchange = updateImportPriceMode;

        const currencySelect =
          document.getElementById(
            "supplierImportCurrency"
          );

        const rateInput =
          document.getElementById(
            "supplierImportEurRate"
          );

        if(currencySelect){

          importCurrency =
            currencySelect.value === "EUR"
              ? "EUR"
              : "UAH";
        }

        if(rateInput){

          rateInput.disabled =
            importCurrency === "EUR";
        }
      }

      function updateImportRate(){

        const input =
          document.getElementById(
            "supplierImportEurRate"
          );

        if(!input){
          return;
        }

        const value =
          Number(
            String(input.value)
              .replace(",",".")
          );

        importEurRate =
          Number.isFinite(value) &&
          value >= 0
            ? value
            : 0;
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

      function renderSupplierImport(){

        const body =
          document.getElementById(
            "supplierImportBody"
          );

        if(
          !pendingSupplierImport.length
        ){

          body.innerHTML = `
            <div class="importEmpty">
              Немає даних для імпорту.
            </div>
          `;

          return;
        }

        const stats =
          getImportStats();

        const brands =
          getImportBrands();

        const unknown =
          pendingSupplierImport
            .filter(
              item =>
                !item.category
            );

        const visibleItems =
          importShowAll
            ? pendingSupplierImport
            : (
                unknown.length
                  ? unknown
                  : pendingSupplierImport
                    .slice(0,20)
              );

        const visibleIndexes =
          visibleItems.map(
            item =>
              pendingSupplierImport
                .indexOf(item)
          );

        const knownSuppliers = getKnownSupplierNames();

        body.innerHTML = `

          <div class="importSupplierBox">
            <div class="importSupplierTitle">Постачальник і тип ціни</div>
            <div class="importSupplierFields">
              <input id="supplierImportName" list="supplierImportKnownNames" value="${escapeHtml(importSupplierName)}" placeholder="Коротка назва постачальника">
              <select id="supplierImportPriceMode" ${importHasDualPrices ? "disabled" : ""}>
                ${importHasDualPrices
                  ? `<option value="auto" selected>Роздрібна + ціна майстра</option>`
                  : `<option value="" ${!importPriceMode ? "selected" : ""}>Оберіть тип ціни</option>
                     <option value="retail" ${importPriceMode === "retail" ? "selected" : ""}>Роздрібна ціна</option>
                     <option value="master" ${importPriceMode === "master" ? "selected" : ""}>Ціна майстра</option>`}
              </select>
              <input class="wide" id="supplierImportFullName" value="${escapeHtml(importSupplierFullName)}" placeholder="Повна назва з рахунку — необов’язково">
            </div>
            <datalist id="supplierImportKnownNames">
              ${knownSuppliers.map(name => `<option value="${escapeHtml(name)}"></option>`).join("")}
            </datalist>
            <div class="importSupplierHint">Один товар залишається однією позицією каталогу. Пропозиція постачальника зберігається всередині неї.</div>
          </div>

          <div class="importCurrencyBox">

            <div class="importCurrencyTitle">
              Валюта рахунку
            </div>

            <div class="importCurrencyFields">

              <select
                id="supplierImportCurrency"
              >
                <option
                  value="UAH"
                  ${
                    importCurrency === "UAH"
                      ? "selected"
                      : ""
                  }
                >
                  UAH
                </option>

                <option
                  value="EUR"
                  ${
                    importCurrency === "EUR"
                      ? "selected"
                      : ""
                  }
                >
                  EUR
                </option>
              </select>

              <input
                id="supplierImportEurRate"
                inputmode="decimal"
                value="${
                  importEurRate > 0
                    ? escapeHtml(
                        String(importEurRate)
                      )
                    : ""
                }"
                placeholder="Курс EUR, грн"
                ${
                  importCurrency === "EUR"
                    ? "disabled"
                    : ""
                }
              >

            </div>

            <div class="importCurrencyHint">
              Для рахунку в UAH ціна буде переведена в EUR за вказаним курсом.
            </div>

          </div>

          <div class="importSummary">

            <div class="importSummaryTitle">
              Знайдено ${pendingSupplierImport.length} позицій
            </div>

            <div class="importStats">

              <div class="importStat">
                Арматура: ${stats.fittings}
              </div>

              <div class="importStat">
                Водопостачання: ${stats.water}
              </div>

              <div class="importStat">
                Каналізація: ${stats.sewer}
              </div>

              <div class="importStat">
                Інше: ${stats.other}
              </div>

            </div>

            ${
              stats.unknown
                ? `
                  <div class="importWarning">
                    Не визначено: ${stats.unknown}
                  </div>
                `
                : ""
            }

            ${
              brands.length
                ? `
                  <div class="importBrands">
                    Бренди:
                    ${brands
                      .map(escapeHtml)
                      .join(", ")}
                  </div>
                `
                : ""
            }

          </div>

          ${
            stats.unknown
              ? `
                <div class="importBulk">

                  <select
                    id="supplierBulkCategory"
                  >
                    <option value="">
                      Категорія для невизначених
                    </option>

                    <option value="fittings">
                      Арматура
                    </option>

                    <option value="water">
                      Водопостачання
                    </option>

                    <option value="sewer">
                      Каналізація
                    </option>

                    <option value="other">
                      Інше
                    </option>
                  </select>

                  <button
                    class="importSoftButton"
                    id="supplierBulkApply"
                  >
                    Застосувати
                  </button>

                </div>
              `
              : ""
          }

          <div class="importToolbar">

            <button
              class="importSoftButton"
              id="supplierToggleList"
            >
              ${
                importShowAll
                  ? "Показати коротко"
                  : "Показати всі позиції"
              }
            </button>

          </div>

          ${
            visibleIndexes.map(
              index => {

                const item =
                  pendingSupplierImport[
                    index
                  ];

                return `
                  <div class="importItem">

                    <div class="importItemName">
                      ${escapeHtml(item.name)}
                    </div>

                    <div class="importItemMeta">

                      ${
                        item.article
                          ? `Артикул: ${escapeHtml(item.article)} · `
                          : ""
                      }

                      ${
                        Number.isFinite(
                          item.qty
                        )
                          ? `${item.qty} ${escapeHtml(item.unit)} · `
                          : ""
                      }

                      ${Number.isFinite(item.retailPrice) && Number.isFinite(item.masterPrice)
                        ? `Роздріб: ${formatImportPrice(item.retailPrice)} · Майстер: ${formatImportPrice(item.masterPrice)}`
                        : formatImportPrice(item.price)}

                    </div>

                    <div class="importItemFields">

                      <select
                        onchange="window.SupplierImportUpdate(${index},'category',this.value)"
                      >
                        ${categoryOptions(
                          item.category
                        )}
                      </select>

                      <input
                        value="${escapeHtml(item.manufacturer)}"
                        placeholder="Бренд"
                        onchange="window.SupplierImportUpdate(${index},'manufacturer',this.value)"
                      >

                      <input
                        class="wide"
                        value="${escapeHtml(item.system)}"
                        placeholder="Система"
                        onchange="window.SupplierImportUpdate(${index},'system',this.value)"
                      >

                    </div>

                  </div>
                `;
              }
            ).join("")
          }

          ${
            !importShowAll &&
            !unknown.length &&
            pendingSupplierImport.length > 20
              ? `
                <div class="importEmpty">
                  Показано перші 20 позицій.
                  <br><br>

                  <button
                    type="button"
                    class="importSoftButton"
                    id="supplierShowAll"
                  >
                    Показати всі
                  </button>

                </div>
              `
              : ""
          }
        `;

        const currencySelect =
          document.getElementById(
            "supplierImportCurrency"
          );

        if(currencySelect){

          currencySelect.onchange =
            () => {

              updateImportCurrency();
              renderSupplierImport();
            };
        }

        const rateInput =
          document.getElementById(
            "supplierImportEurRate"
          );

        if(rateInput){

          rateInput.oninput =
            updateImportRate;
        }

        const bulkButton =
          document.getElementById(
            "supplierBulkApply"
          );

        if(bulkButton){

          bulkButton.onclick =
            applyBulkCategory;
        }

        const showAllButton =
          document.getElementById(
            "supplierShowAll"
          );

        if(showAllButton){

          showAllButton.onclick =
            () => {

              importShowAll = true;
              renderSupplierImport();
            };
        }

        const toggleButton =
          document.getElementById(
            "supplierToggleList"
          );

        if(toggleButton){

          toggleButton.onclick =
            () => {

              importShowAll =
                !importShowAll;

              renderSupplierImport();
            };
        }
      }

      window.SupplierImportUpdate =
        updatePendingItem;

      function findExistingCatalogItem(
        imported
      ){

        const article =
          ntext(
            imported.article
          );

        if(article){

          const byArticle =
            catalog.find(
              item =>
                item.type === "material" &&
                ntext(
                  item.article
                ) === article
            );

          if(byArticle){
            return byArticle;
          }
        }

        const name =
          ntext(
            imported.name
          );

        if(name){

          return catalog.find(
            item =>
              item.type === "material" &&
              ntext(
                item.name
              ) === name
          ) || null;
        }

        return null;
      }

      function makeImportedId(){

        return (
          "import-" +
          Date.now() +
          "-" +
          Math.random()
            .toString(36)
            .slice(2,8)
        );
      }

      function rememberImportRule(
        item,
        rules
      ){

        const key =
          ruleKey(
            item.article,
            item.name
          );

        if(!key){
          return;
        }

        rules[key] = {

          category:
            item.category || "",

          manufacturer:
            item.manufacturer || "",

          system:
            item.system || ""

        };
      }

      function convertImportedPriceToEUR(sourcePrice){
        const number = Number(sourcePrice);
        if(!Number.isFinite(number) || number < 0) return null;
        if(importCurrency === "EUR") return number;
        if(!Number.isFinite(importEurRate) || importEurRate <= 0) return null;
        return number / importEurRate;
      }

      function makePriceSnapshot(sourcePrice,importedAt){
        const priceEUR = convertImportedPriceToEUR(sourcePrice);
        if(!Number.isFinite(priceEUR) || priceEUR < 0) return null;
        return {
          priceEUR,
          sourcePrice:Number(sourcePrice),
          sourceCurrency:importCurrency,
          eurRate:importCurrency === "UAH" ? importEurRate : null,
          importedAt
        };
      }

      function getImportedPricePair(imported,importedAt){
        let retail = null;
        let master = null;
        if(importHasDualPrices){
          if(Number.isFinite(imported.retailPrice)) retail = makePriceSnapshot(imported.retailPrice,importedAt);
          if(Number.isFinite(imported.masterPrice)) master = makePriceSnapshot(imported.masterPrice,importedAt);
        }else if(importPriceMode === "retail"){
          retail = makePriceSnapshot(imported.price,importedAt);
        }else if(importPriceMode === "master"){
          master = makePriceSnapshot(imported.price,importedAt);
        }
        return {retail,master};
      }

      function upsertSupplierOffer(item,pricePair,importedAt){
        if(!Array.isArray(item.supplierOffers)) item.supplierOffers = [];
        const key = supplierKey(importSupplierName);
        let offer = item.supplierOffers.find(value => supplierKey(value && value.supplierName) === key);
        if(!offer){
          offer = {supplierId:key,supplierName:importSupplierName,supplierFullName:importSupplierFullName || "",retail:null,master:null,updatedAt:importedAt};
          item.supplierOffers.push(offer);
        }
        offer.supplierId = key;
        offer.supplierName = importSupplierName;
        if(importSupplierFullName) offer.supplierFullName = importSupplierFullName;
        if(pricePair.retail) offer.retail = pricePair.retail;
        if(pricePair.master) offer.master = pricePair.master;
        offer.updatedAt = importedAt;
      }

      function getCompatibilityBasePriceEUR(imported,pricePair){
        if(pricePair.master) return pricePair.master.priceEUR;
        if(pricePair.retail) return pricePair.retail.priceEUR;
        return convertImportedPriceToEUR(imported.price);
      }

      function applySupplierImport(){

        if(
          !pendingSupplierImport.length
        ){
          return;
        }

        updateImportSupplier();
        updateImportPriceMode();
        updateImportCurrency();
        updateImportRate();

        if(!importSupplierName){
          alert("Вкажіть коротку назву постачальника.");
          return;
        }

        if(!importHasDualPrices && !["retail","master"].includes(importPriceMode)){
          alert("Оберіть тип ціни: роздрібна або ціна майстра.");
          return;
        }

        const unresolved =
          pendingSupplierImport
            .filter(
              item =>
                !item.category
            );

        if(unresolved.length){

          alert(
            `Залишилось ${unresolved.length} невизначених позицій. Спочатку призначте їм категорію.`
          );

          return;
        }

        if(
          importCurrency === "UAH" &&
          (
            !Number.isFinite(
              importEurRate
            ) ||
            importEurRate <= 0
          )
        ){

          alert(
            "Вкажіть коректний курс EUR."
          );

          return;
        }

        const rules =
          loadImportRules();

        const importedAt = new Date().toISOString();

        let created = 0;
        let updated = 0;

        for(
          const imported
          of pendingSupplierImport
        ){

          const pricePair = getImportedPricePair(imported,importedAt);

          if(!pricePair.retail && !pricePair.master){

            alert(
              `Не вдалося визначити ціну для позиції:\n${imported.name}`
            );

            return;
          }
        }

        pendingSupplierImport
          .forEach(
            imported => {

              rememberImportRule(
                imported,
                rules
              );

              const pricePair = getImportedPricePair(imported,importedAt);
              const basePriceEUR = getCompatibilityBasePriceEUR(imported,pricePair);

              const existing =
                findExistingCatalogItem(
                  imported
                );

              if(existing){

                existing.name =
                  imported.name;

                if(
                  !existing.estimateName
                ){
                  existing.estimateName =
                    imported.name;
                }

                existing.basePriceEUR =
                  basePriceEUR;

                delete existing.price;

                existing.unit =
                  imported.unit || "шт";

                existing.category =
                  imported.category;

                existing.manufacturer =
                  imported.manufacturer || "";

                existing.system =
                  imported.system || "";

                existing.article =
                  imported.article ||
                  existing.article ||
                  "";

                upsertSupplierOffer(existing,pricePair,importedAt);

                updated++;

              }else{

                catalog.push({

                  id:
                    makeImportedId(),

                  name:
                    imported.name,

                  estimateName:
                    imported.name,

                  type:
                    "material",

                  category:
                    imported.category,

                  manufacturer:
                    imported.manufacturer || "",

                  system:
                    imported.system || "",

                  article:
                    imported.article || "",

                  basePriceEUR:
                    basePriceEUR,

                  unit:
                    imported.unit || "шт",

                  supplierOffers:[]

                });

                const createdItem = catalog[catalog.length - 1];
                upsertSupplierOffer(createdItem,pricePair,importedAt);

                created++;
              }
            }
          );

        saveImportRules(
          rules
        );

        if(importSupplierFullName){
          const supplierNames = loadSupplierNames();
          supplierNames[supplierKey(importSupplierFullName)] = importSupplierName;
          saveSupplierNames(supplierNames);
        }

        if(
          importCurrency === "UAH"
        ){

          localStorage.setItem(
            EUR_RATE_KEY,
            String(
              importEurRate
            )
          );

          try{

            eurRate =
              importEurRate;

          }catch(error){

            console.warn(
              "EUR rate sync:",
              error
            );
          }

          if(
            typeof updateEurRateButton ===
            "function"
          ){

            updateEurRateButton();
          }
        }

        saveCatalog();

        const supplierNameForAlert = importSupplierName;

        closeSupplierImport();

        renderFilters();
        renderBrandFilters();
        renderSystemFilters();
        renderCatalog();

        alert(
          `Імпорт завершено.\nПостачальник: ${supplierNameForAlert}\nДодано: ${created}\nОновлено: ${updated}`
        );
      }

    })();
