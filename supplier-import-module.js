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

  function getImportedBasePriceEUR(
    imported
  ){

    const sourcePrice =
      Number(
        imported.price
      );

    if(
      !Number.isFinite(
        sourcePrice
      ) ||
      sourcePrice < 0
    ){
      return null;
    }

    if(
      importCurrency === "EUR"
    ){
      return sourcePrice;
    }

    if(
      !Number.isFinite(
        importEurRate
      ) ||
      importEurRate <= 0
    ){
      return null;
    }

    return (
      sourcePrice /
      importEurRate
    );
  }

  function getCompatibilityPriceUAH(
    imported,
    basePriceEUR
  ){

    if(
      importCurrency === "UAH"
    ){
      return Number(
        imported.price
      ) || 0;
    }

    if(
      Number.isFinite(
        importEurRate
      ) &&
      importEurRate > 0
    ){
      return (
        basePriceEUR *
        importEurRate
      );
    }

    return 0;
  }

  function applySupplierImport(){

    if(
      !pendingSupplierImport.length
    ){
      return;
    }

    updateImportCurrency();
    updateImportRate();

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

    let created = 0;
    let updated = 0;

    for(
      const imported
      of pendingSupplierImport
    ){

      const basePriceEUR =
        getImportedBasePriceEUR(
          imported
        );

      if(
        !Number.isFinite(
          basePriceEUR
        ) ||
        basePriceEUR < 0
      ){

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

          const basePriceEUR =
            getImportedBasePriceEUR(
              imported
            );

          const compatibilityPrice =
            getCompatibilityPriceUAH(
              imported,
              basePriceEUR
            );

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

            existing.price =
              compatibilityPrice;

            existing.unit =
              imported.unit || "шт";

            existing.category =
              imported.category;

            existing.manufacturer =
              imported.manufacturer || "";

            existing.system =
              imported.system || "";

            existing.article =
              imported.article || "";

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

              price:
                compatibilityPrice,

              unit:
                imported.unit || "шт"

            });

            created++;
          }
        }
      );

    saveImportRules(
      rules
    );

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

    closeSupplierImport();

    renderFilters();
    renderBrandFilters();
    renderSystemFilters();
    renderCatalog();

    alert(
      `Імпорт завершено.\nДодано: ${created}\nОновлено: ${updated}`
    );
  }

})();
