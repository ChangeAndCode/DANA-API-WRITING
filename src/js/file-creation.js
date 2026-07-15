const fileType = document.getElementById("fileType");
const sections = document.querySelectorAll(".format-section");
const createFileButton = document.getElementById("createFileButton");
const updateFileButton = document.getElementById("updateFileButton");
const validationResult = document.getElementById("validationResult");
const adminFileNameGroup = document.getElementById("adminFileNameGroup");
const adminFileNameInput = document.getElementById("adminFileName");
let editingFileId = "";

const map = {
  finishedProduct: "format-finishedProduct",
  rawMaterial: "format-rawMaterial",
  billOfMaterials: "format-billOfMaterials",
  splScrap: "format-splScrap",
};

const DOCUMENT_TYPE_LABELS = {
  finishedProduct: "Finished Product",
  rawMaterial: "Raw Material",
  billOfMaterials: "Bill of Materials",
  splScrap: "Packing List (SPL/Scrap)",
};

const finishedProductColumns = [
  { key: "partNumber", label: "Part Number", maxLength: 30, required: true },
  { key: "description", label: "Description", maxLength: 60, required: true },
  {
    key: "unitWeightLb",
    label: "Unit Weight Lb.",
    maxLength: 17,
    required: true,
  },
  {
    key: "dutiableValueUsd",
    label: "Dutiable Value (USD)",
    maxLength: 17,
    required: true,
  },
  { key: "filler", label: "Filler" },
  {
    key: "addedValueUsd",
    label: "Added Value (USD)",
    maxLength: 17,
    required: true,
  },
  {
    key: "unitOfMeasure",
    label: "Unit of Measure",
    maxLength: 3,
    required: true,
  },
  {
    key: "countryOfOrigin",
    label: "Country of Origin",
    maxLength: 2,
    required: true,
  },
  {
    key: "usaImportHts",
    label: "USA Importation HTS Code",
    maxLength: 12,
    required: true,
  },
  {
    key: "usaExportCode",
    label: "USA Exportation Code",
    maxLength: 12,
    required: true,
  },
  { key: "FDA Product Code", label: "FDA Product Code" },
  { key: "FDA Storage", label: "FDA Storage" },
  { key: "FDA Country of Origin", label: "FDA Country of Origin" },
  { key: "FDA Marker", label: "FDA Marker" },
  {
    key: "FDA Affirmation of Compliance Code 1",
    label: "FDA Affirmation of Compliance Code 1",
  },
  {
    key: "FDA Affirmation of Compliance Qualifier 1",
    label: "FDA Affirmation of Compliance Qualifier 1",
  },
  {
    key: "FDA Affirmation of Compliance Code 2",
    label: "FDA Affirmation of Compliance Code 2",
  },
  {
    key: "FDA Affirmation of Compliance Qualifier 2",
    label: "FDA Affirmation of Compliance Qualifier 2",
  },
  {
    key: "FDA Affirmation of Compliance Code 3",
    label: "FDA Affirmation of Compliance Code 3",
  },
  {
    key: "FDA Affirmation of Compliance Qualifier 3",
    label: "FDA Affirmation of Compliance Qualifier 3",
  },
  {
    key: "FDA Affirmation of Compliance Code 4",
    label: "FDA Affirmation of Compliance Code 4",
  },
  {
    key: "FDA Affirmation of Compliance Qualifier 4",
    label: "FDA Affirmation of Compliance Qualifier 4",
  },
  {
    key: "FDA Affirmation of Compliance Code 5",
    label: "FDA Affirmation of Compliance Code 5",
  },
  {
    key: "FDA Affirmation of Compliance Qualifier 5",
    label: "FDA Affirmation of Compliance Qualifier 5",
  },
  {
    key: "FDA Affirmation of Compliance Code 6",
    label: "FDA Affirmation of Compliance Code 6",
  },
  {
    key: "FDA Affirmation of Compliance Qualifier 6",
    label: "FDA Affirmation of Compliance Qualifier 6",
  },
  { key: "NAFTA", label: "NAFTA" },
  { key: "Preference Criterion", label: "Preference Criterion" },
  { key: "Producer", label: "Producer" },
  { key: "Net Cost", label: "Net Cost" },
  { key: "Period (From)", label: "Period (From)" },
  { key: "Period (To)", label: "Period (To)" },
  { key: "USML (ITAR)", label: "USML (ITAR)" },
];

const rawMaterialColumns = [
  { key: "partNumber", label: "Part Number", maxLength: 30, required: true },
  { key: "description", label: "Description", maxLength: 60, required: true },
  {
    key: "unitWeightLb",
    label: "Unit Weight Lb.",
    maxLength: 17,
    required: true,
  },
  {
    key: "unitCostUsd",
    label: "Unit Cost (USD)",
    maxLength: 17,
    required: true,
  },
  {
    key: "unitOfMeasure",
    label: "Unit of measure",
    maxLength: 3,
    required: true,
  },
  {
    key: "countryOfOrigin",
    label: "Country of origin",
    maxLength: 2,
    required: true,
  },
  {
    key: "importHts",
    label: "Importation HTS Code",
    maxLength: 12,
    required: true,
  },
  {
    key: "exportHts",
    label: "Exportation HTS Code",
    maxLength: 12,
    required: true,
  },
  { key: "eccn", label: "ECCN", maxLength: 10, required: true },
  { key: "filler", label: "Filler" },
  { key: "licenseNumber", label: "License Number (LCN)" },
  { key: "licenseException", label: "License Exception" },
  { key: "licenseExpiration", label: "License Expiration date" },
  { key: "usml", label: "USML (ITAR)" },
];

const billOfMaterialsColumns = [
  {
    key: "finishedGoodPartNumber",
    label: "Finished Good Part Number",
    maxLength: 30,
    required: true,
  },
  {
    key: "componentPartNumber",
    label: "Component Part Number",
    maxLength: 30,
    required: true,
  },
  { key: "type", label: "Type", maxLength: 1, required: true },
  { key: "quantity", label: "Quantity", maxLength: 17, required: true },
  {
    key: "unitOfMeasure",
    label: "Unit of Measure",
    maxLength: 3,
    required: true,
  },
  {
    key: "componentClassification",
    label: "Component classification",
    maxLength: 20,
  },
];

const splScrapMetaFields = [
  {
    key: "Customer(southbound) / Ship to (northbound)",
    label: "Customer / Ship to",
    required: true,
  },
  {
    key: "Type of goods",
    label: "Type of goods",
    required: true,
    options: ["FG", "RM", "EQ"],
  },
  {
    key: "Type of shipment",
    label: "Type of shipment",
    required: true,
    options: ["Northbound", "Southbound", "Scrap"],
  },
  {
    key: "Expected date of arrival",
    label: "Expected date of arrival",
    required: true,
    inputType: "text",
    placeholder: "YYYYMMDD",
    pattern: "\\d{8}",
    title: "Fecha en formato YYYYMMDD",
  },
  { key: "Waybill number", label: "Waybill number" },
  { key: "Total gross weight", label: "Total gross weight" },
  { key: "Total bundles", label: "Total bundles" },
];

const splScrapColumns = [
  { key: "partNumber", label: "Part Number", maxLength: 30, required: true },
  { key: "description", label: "Description", maxLength: 60, required: true },
  { key: "quantity", label: "Quantity", maxLength: 17, required: true },
  {
    key: "unitOfMeasure",
    label: "Unit Of Measure",
    maxLength: 3,
    required: true,
  },
  {
    key: "unitValueUsd",
    label: "Unit Value (USD)",
    maxLength: 17,
    required: true,
  },
  {
    key: "addedValueUsd",
    label: "Added Value (USD)",
    maxLength: 17,
    required: true,
  },
  {
    key: "totalValueUsd",
    label: "Total Value (USD)",
    maxLength: 17,
    derived: true,
  },
  {
    key: "unitNetWeight",
    label: "Unit Net Weight",
    maxLength: 17,
    required: true,
  },
  {
    key: "countryOfOrigin",
    label: "Country of Origin",
    maxLength: 2,
    required: true,
  },
  { key: "eccn", label: "ECCN", maxLength: 10, required: true },
  { key: "licenseNo", label: "License No." },
  { key: "licenseException", label: "License Exception" },
  { key: "usImpHts", label: "US IMP HTS Code", maxLength: 16, required: true },
  { key: "usExpHts", label: "US EXP HTS Code", maxLength: 16, required: true },
  {
    key: "regime",
    label: "Regime",
    options: ["Permanent", "Temporary"],
  },
  { key: "brand", label: "Brand" },
  { key: "model", label: "Model" },
  { key: "serial", label: "Serial" },
  { key: "powerSourceType", label: "Power Source Type" },
  { key: "capacity", label: "Capacity" },
  { key: "mainFunction", label: "Main Function" },
  { key: "poNumber", label: "PO Number" },
];

const fpTable = document.getElementById("fpTable");
const fpHead = fpTable ? fpTable.querySelector("thead") : null;
const fpBody = fpTable ? fpTable.querySelector("tbody") : null;
const fpAddRowBtn = document.getElementById("fpAddRowBtn");
let fpInitialized = false;

const rmTable = document.getElementById("rmTable");
const rmHead = rmTable ? rmTable.querySelector("thead") : null;
const rmBody = rmTable ? rmTable.querySelector("tbody") : null;
const rmAddRowBtn = document.getElementById("rmAddRowBtn");
let rmInitialized = false;

const bmTable = document.getElementById("bmTable");
const bmHead = bmTable ? bmTable.querySelector("thead") : null;
const bmBody = bmTable ? bmTable.querySelector("tbody") : null;
const bmAddRowBtn = document.getElementById("bmAddRowBtn");
let bmInitialized = false;

const splTable = document.getElementById("splTable");
const splHead = splTable ? splTable.querySelector("thead") : null;
const splBody = splTable ? splTable.querySelector("tbody") : null;
const splAddRowBtn = document.getElementById("splAddRowBtn");
const splMetaContainer = document.getElementById("splMetaFields");
const splMetaInputs = {};
let splInitialized = false;
const SPLSCRAP_SCRAP_TYPE_OF_GOODS = "FG";
const manualCatalogState = {
  unitOfMeasure: {
    options: [],
    optionsSet: new Set(),
  },
  countryOfOrigin: {
    options: [],
    optionsSet: new Set(),
  },
};
let manualCatalogLoadPromise = null;
let activeCatalogAutocompleteInput = null;
let activeStaticDropdownInput = null;
const CATALOG_AUTOCOMPLETE_MAX_VISIBLE_OPTIONS = 10;
const CATALOG_AUTOCOMPLETE_WIDTH_PX = 140;

function normalizeCatalogCodeValue(value) {
  return String(value || "").trim().toUpperCase();
}

function getCatalogKeyForColumn(column) {
  if (!column || !column.key) return "";
  if (column.key === "unitOfMeasure") return "unitOfMeasure";
  if (column.key === "countryOfOrigin") return "countryOfOrigin";
  return "";
}

function applyManualCatalogOptions(payload = {}) {
  const unitOfMeasure = Array.isArray(payload.unitOfMeasure)
    ? payload.unitOfMeasure.map(normalizeCatalogCodeValue).filter(Boolean)
    : [];
  const countryOfOrigin = Array.isArray(payload.countryOfOrigin)
    ? payload.countryOfOrigin.map(normalizeCatalogCodeValue).filter(Boolean)
    : [];

  manualCatalogState.unitOfMeasure.options = Array.from(
    new Set(unitOfMeasure),
  ).sort((left, right) => left.localeCompare(right));
  manualCatalogState.unitOfMeasure.optionsSet = new Set(
    manualCatalogState.unitOfMeasure.options,
  );

  manualCatalogState.countryOfOrigin.options = Array.from(
    new Set(countryOfOrigin),
  ).sort((left, right) => left.localeCompare(right));
  manualCatalogState.countryOfOrigin.optionsSet = new Set(
    manualCatalogState.countryOfOrigin.options,
  );

  syncAllCatalogAutocompleteInputs();
}

async function loadManualCatalogOptions(forceRefresh = false) {
  if (forceRefresh) {
    manualCatalogLoadPromise = null;
  }
  if (manualCatalogLoadPromise) return manualCatalogLoadPromise;

  manualCatalogLoadPromise = fetch("/api/files/catalog-options")
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "No se pudieron cargar los catalogos.");
      }
      applyManualCatalogOptions(data);
      return data;
    })
    .catch((error) => {
      console.warn("No se pudieron cargar los catalogos manuales", error);
      applyManualCatalogOptions({});
      return {
        unitOfMeasure: [],
        countryOfOrigin: [],
      };
    });

  return manualCatalogLoadPromise;
}

function getCatalogAutocompleteUi(input) {
  if (!input) return null;
  if (input._catalogAutocompleteUi) {
    const existingUi = input._catalogAutocompleteUi;
    const parent = input.parentNode;
    if (
      existingUi.wrapper &&
      !existingUi.wrapper.isConnected &&
      parent &&
      parent !== existingUi.wrapper
    ) {
      parent.insertBefore(existingUi.wrapper, input);
      existingUi.wrapper.appendChild(input);
      existingUi.wrapper.appendChild(existingUi.toggle);
      existingUi.wrapper.appendChild(existingUi.menu);
    }
    return existingUi;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "catalog-autocomplete";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "catalog-autocomplete-toggle";
  toggle.setAttribute("aria-label", "Mostrar opciones");
  toggle.innerHTML = "&#9662;";

  const menu = document.createElement("div");
  menu.className = "catalog-autocomplete-menu hidden";

  const parent = input.parentNode;
  if (parent) {
    parent.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    wrapper.appendChild(toggle);
    wrapper.appendChild(menu);
  }

  input.classList.add("catalog-autocomplete-input");
  input.autocomplete = "off";

  input._catalogAutocompleteUi = { wrapper, toggle, menu };
  return input._catalogAutocompleteUi;
}

function updateCatalogAutocompleteWidth(input) {
  const ui = getCatalogAutocompleteUi(input);
  if (!ui || !ui.wrapper) return;

  ui.wrapper.style.width = `${CATALOG_AUTOCOMPLETE_WIDTH_PX}px`;
  ui.wrapper.style.minWidth = `${CATALOG_AUTOCOMPLETE_WIDTH_PX}px`;
  input.style.width = "100%";
}

function getCatalogOptionsForInput(input) {
  if (!input) return [];
  const catalogKey = input.dataset.catalogKey;
  if (!catalogKey || !manualCatalogState[catalogKey]) return [];
  return manualCatalogState[catalogKey].options;
}

function getCatalogFilteredOptions(input) {
  const options = getCatalogOptionsForInput(input);
  const query = normalizeCatalogCodeValue(input.value);
  if (!query) return options;

  const startsWith = [];
  const includes = [];
  options.forEach((optionValue) => {
    if (optionValue.startsWith(query)) {
      startsWith.push(optionValue);
    } else if (optionValue.includes(query)) {
      includes.push(optionValue);
    }
  });
  return [...startsWith, ...includes];
}

function closeCatalogAutocompleteMenu(input) {
  if (!input) return;
  const ui = getCatalogAutocompleteUi(input);
  if (!ui) return;
  ui.menu.classList.add("hidden");
  ui.wrapper.classList.remove("catalog-autocomplete-open");
  delete input.dataset.catalogActiveIndex;
  if (activeCatalogAutocompleteInput === input) {
    activeCatalogAutocompleteInput = null;
  }
}

function closeAllCatalogAutocompleteMenus(exceptInput = null) {
  document
    .querySelectorAll("input[data-catalog-key]")
    .forEach((input) => {
      if (input !== exceptInput) closeCatalogAutocompleteMenu(input);
    });
}

function updateCatalogAutocompleteActiveOption(input, nextIndex) {
  const ui = getCatalogAutocompleteUi(input);
  if (!ui) return;

  const options = Array.from(
    ui.menu.querySelectorAll(".catalog-autocomplete-option"),
  );
  if (!options.length) {
    delete input.dataset.catalogActiveIndex;
    return;
  }

  const boundedIndex = Math.max(0, Math.min(nextIndex, options.length - 1));
  input.dataset.catalogActiveIndex = String(boundedIndex);

  options.forEach((optionButton, index) => {
    optionButton.classList.toggle("is-active", index === boundedIndex);
  });

  const activeOption = options[boundedIndex];
  if (activeOption) {
    activeOption.scrollIntoView({ block: "nearest" });
  }
}

function selectCatalogAutocompleteOption(input, optionValue) {
  if (!input) return;
  input.value = normalizeCatalogCodeValue(optionValue);
  input.setCustomValidity("");
  if (input.dataset.catalogKey === "unitOfMeasure") {
    handleSplScrapUnitOfMeasureInput(input, true);
  }
  closeCatalogAutocompleteMenu(input);
}

function renderCatalogAutocompleteMenu(input) {
  if (!input) return;

  const ui = getCatalogAutocompleteUi(input);
  if (!ui) return;

  closeAllCatalogAutocompleteMenus(input);
  updateCatalogAutocompleteWidth(input);
  const filteredOptions = getCatalogFilteredOptions(input);
  ui.menu.innerHTML = "";

  if (!filteredOptions.length) {
    closeCatalogAutocompleteMenu(input);
    return;
  }

  filteredOptions.forEach((optionValue, index) => {
    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.className = "catalog-autocomplete-option";
    optionButton.textContent = optionValue;
    optionButton.addEventListener("mousedown", (event) => {
      event.preventDefault();
      selectCatalogAutocompleteOption(input, optionValue);
    });
    ui.menu.appendChild(optionButton);

    if (index === 0) {
      optionButton.classList.add("is-active");
    }
  });

  ui.menu.style.maxHeight = `${CATALOG_AUTOCOMPLETE_MAX_VISIBLE_OPTIONS * 36}px`;
  ui.menu.classList.remove("hidden");
  ui.wrapper.classList.add("catalog-autocomplete-open");
  activeCatalogAutocompleteInput = input;
  updateCatalogAutocompleteActiveOption(input, 0);
}

function syncCatalogAutocompleteInput(input) {
  if (!input) return;
  updateCatalogAutocompleteWidth(input);
  if (activeCatalogAutocompleteInput === input) {
    renderCatalogAutocompleteMenu(input);
  }
}

function syncAllCatalogAutocompleteInputs() {
  document
    .querySelectorAll("input[data-catalog-key]")
    .forEach((input) => syncCatalogAutocompleteInput(input));
}

function validateCatalogCodeInput(input, { reportIfInvalid = false } = {}) {
  if (!input) return true;

  const catalogKey = input.dataset.catalogKey;
  if (!catalogKey || !manualCatalogState[catalogKey]) return true;

  const nextValue = normalizeCatalogCodeValue(input.value);
  input.value = nextValue;

  if (!nextValue) {
    input.setCustomValidity("");
    return true;
  }

  const allowedSet = manualCatalogState[catalogKey].optionsSet;

  if (allowedSet.size > 0 && !allowedSet.has(nextValue)) {
    const message =
      catalogKey === "countryOfOrigin"
        ? "Selecciona un codigo valido de Country of Origin."
        : "Selecciona un codigo valido de Unit of Measure.";
    input.setCustomValidity(message);
    if (reportIfInvalid) input.reportValidity();
    return false;
  }

  input.setCustomValidity("");
  return true;
}

function bindCatalogAutocompleteInput(input, catalogKey) {
  if (!input || !catalogKey) return;

  input.dataset.catalogKey = catalogKey;
  input.spellcheck = false;
  const ui = getCatalogAutocompleteUi(input);
  syncCatalogAutocompleteInput(input);

  if (input.dataset.catalogAutocompleteBound === "true") return;

  input.addEventListener("input", () => {
    input.value = normalizeCatalogCodeValue(input.value);
    if (catalogKey === "unitOfMeasure") {
      handleSplScrapUnitOfMeasureInput(input, false);
    }
    input.setCustomValidity("");
    renderCatalogAutocompleteMenu(input);
  });

  input.addEventListener("blur", () => {
    window.setTimeout(() => {
      if (catalogKey === "unitOfMeasure") {
        handleSplScrapUnitOfMeasureInput(input, true);
      }
      closeCatalogAutocompleteMenu(input);
      validateCatalogCodeInput(input, { reportIfInvalid: true });
    }, 120);
  });

  input.addEventListener("focus", () => {
    renderCatalogAutocompleteMenu(input);
  });

  input.addEventListener("click", () => {
    renderCatalogAutocompleteMenu(input);
  });

  input.addEventListener(
    "keydown",
    (event) => {
      const ui = getCatalogAutocompleteUi(input);
      if (!ui || ui.menu.classList.contains("hidden")) return;

      const optionButtons = Array.from(
        ui.menu.querySelectorAll(".catalog-autocomplete-option"),
      );
      if (!optionButtons.length) return;

      const currentIndex = Number.parseInt(
        input.dataset.catalogActiveIndex || "0",
        10,
      );

      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        updateCatalogAutocompleteActiveOption(input, currentIndex + 1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        updateCatalogAutocompleteActiveOption(input, currentIndex - 1);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const nextIndex = Number.parseInt(
          input.dataset.catalogActiveIndex || "0",
          10,
        );
        const activeOption = optionButtons[nextIndex] || optionButtons[0];
        if (activeOption) {
          selectCatalogAutocompleteOption(input, activeOption.textContent || "");
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeCatalogAutocompleteMenu(input);
      }
    },
    true,
  );

  if (ui && ui.toggle) {
    ui.toggle.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    ui.toggle.addEventListener("click", () => {
      input.focus();
      const isHidden = ui.menu.classList.contains("hidden");
      if (isHidden) {
        renderCatalogAutocompleteMenu(input);
      } else {
        closeCatalogAutocompleteMenu(input);
      }
    });
  }

  input.dataset.catalogAutocompleteBound = "true";
}

function bindCatalogInputsForRow(rowElement, columns = []) {
  if (!rowElement) return;

  const editors = Array.from(rowElement.querySelectorAll("input, select"));
  columns.forEach((column, index) => {
    const catalogKey = getCatalogKeyForColumn(column);
    const editor = editors[index];
    if (catalogKey && editor && editor.tagName === "INPUT") {
      bindCatalogAutocompleteInput(editor, catalogKey);
    }
    if (column?.key === "regime" && editor && editor.tagName === "INPUT") {
      bindStaticOptionsDropdownInput(editor, column.options, {
        placeholder: "-- Seleccione --",
      });
    }
  });
}

function getStaticDropdownOptions(input) {
  return Array.isArray(input?._staticDropdownOptions)
    ? input._staticDropdownOptions
    : [];
}

function closeStaticDropdownMenu(input) {
  if (!input) return;
  const ui = getCatalogAutocompleteUi(input);
  if (!ui) return;
  ui.menu.classList.add("hidden");
  ui.wrapper.classList.remove("catalog-autocomplete-open");
  delete input.dataset.staticDropdownActiveIndex;
  if (activeStaticDropdownInput === input) {
    activeStaticDropdownInput = null;
  }
}

function closeAllStaticDropdownMenus(exceptInput = null) {
  document
    .querySelectorAll('input[data-static-dropdown="true"]')
    .forEach((input) => {
      if (input !== exceptInput) closeStaticDropdownMenu(input);
    });
}

function updateStaticDropdownActiveOption(input, nextIndex) {
  const ui = getCatalogAutocompleteUi(input);
  if (!ui) return;

  const options = Array.from(
    ui.menu.querySelectorAll(".catalog-autocomplete-option"),
  );
  if (!options.length) {
    delete input.dataset.staticDropdownActiveIndex;
    return;
  }

  const boundedIndex = Math.max(0, Math.min(nextIndex, options.length - 1));
  input.dataset.staticDropdownActiveIndex = String(boundedIndex);

  options.forEach((optionButton, index) => {
    optionButton.classList.toggle("is-active", index === boundedIndex);
  });

  const activeOption = options[boundedIndex];
  if (activeOption) {
    activeOption.scrollIntoView({ block: "nearest" });
  }
}

function selectStaticDropdownOption(input, optionValue) {
  if (!input) return;
  input.value = String(optionValue || "").trim();
  input.setCustomValidity("");
  closeStaticDropdownMenu(input);
}

function renderStaticDropdownMenu(input) {
  if (!input) return;

  const ui = getCatalogAutocompleteUi(input);
  if (!ui) return;

  closeAllCatalogAutocompleteMenus();
  closeAllStaticDropdownMenus(input);
  updateCatalogAutocompleteWidth(input);
  ui.menu.innerHTML = "";

  const placeholder = input.dataset.staticDropdownPlaceholder || "-- Seleccione --";
  const options = [
    { value: "", label: placeholder },
    ...getStaticDropdownOptions(input).map((optionValue) => ({
      value: optionValue,
      label: optionValue,
    })),
  ];

  options.forEach((optionData, index) => {
    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.className = "catalog-autocomplete-option";
    optionButton.textContent = optionData.label;
    optionButton.dataset.optionValue = optionData.value;
    optionButton.addEventListener("mousedown", (event) => {
      event.preventDefault();
      selectStaticDropdownOption(input, optionData.value);
    });
    ui.menu.appendChild(optionButton);

    const isCurrent =
      normalizeCatalogCodeValue(input.value) ===
      normalizeCatalogCodeValue(optionData.value);
    if (isCurrent || (!input.value && index === 0)) {
      optionButton.classList.add("is-active");
      input.dataset.staticDropdownActiveIndex = String(index);
    }
  });

  ui.menu.classList.remove("hidden");
  ui.wrapper.classList.add("catalog-autocomplete-open");
  activeStaticDropdownInput = input;

  const initialIndex = Number.parseInt(
    input.dataset.staticDropdownActiveIndex || "0",
    10,
  );
  updateStaticDropdownActiveOption(input, initialIndex);
}

function bindStaticOptionsDropdownInput(
  input,
  options = [],
  { placeholder = "-- Seleccione --" } = {},
) {
  if (!input) return;

  input.dataset.staticDropdown = "true";
  input.dataset.staticDropdownPlaceholder = placeholder;
  input._staticDropdownOptions = Array.from(
    new Map(
      (Array.isArray(options) ? options : [])
        .map((optionValue) => String(optionValue || "").trim())
        .filter(Boolean)
        .map((optionValue) => [
          normalizeCatalogCodeValue(optionValue),
          optionValue,
        ]),
    ).values(),
  );
  input.readOnly = true;
  input.placeholder = placeholder;
  input.spellcheck = false;

  const ui = getCatalogAutocompleteUi(input);
  updateCatalogAutocompleteWidth(input);

  if (input.dataset.staticDropdownBound === "true") return;

  input.addEventListener("focus", () => {
    renderStaticDropdownMenu(input);
  });

  input.addEventListener("click", () => {
    renderStaticDropdownMenu(input);
  });

  input.addEventListener("blur", () => {
    window.setTimeout(() => {
      closeStaticDropdownMenu(input);
    }, 120);
  });

  input.addEventListener(
    "keydown",
    (event) => {
      const ui = getCatalogAutocompleteUi(input);
      if (!ui || ui.menu.classList.contains("hidden")) return;

      const optionButtons = Array.from(
        ui.menu.querySelectorAll(".catalog-autocomplete-option"),
      );
      if (!optionButtons.length) return;

      const currentIndex = Number.parseInt(
        input.dataset.staticDropdownActiveIndex || "0",
        10,
      );

      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        updateStaticDropdownActiveOption(input, currentIndex + 1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        updateStaticDropdownActiveOption(input, currentIndex - 1);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const nextIndex = Number.parseInt(
          input.dataset.staticDropdownActiveIndex || "0",
          10,
        );
        const activeOption = optionButtons[nextIndex] || optionButtons[0];
        if (activeOption) {
          selectStaticDropdownOption(
            input,
            activeOption.dataset.optionValue || "",
          );
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeStaticDropdownMenu(input);
      }
    },
    true,
  );

  if (ui && ui.toggle) {
    ui.toggle.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    ui.toggle.addEventListener("click", () => {
      input.focus();
      const isHidden = ui.menu.classList.contains("hidden");
      if (isHidden) {
        renderStaticDropdownMenu(input);
      } else {
        closeStaticDropdownMenu(input);
      }
    });
  }

  input.dataset.staticDropdownBound = "true";
}

function getCatalogInputsForDocumentType(documentType) {
  if (documentType === "finishedProduct") {
    return fpBody ? Array.from(fpBody.querySelectorAll("input[data-catalog-key]")) : [];
  }
  if (documentType === "rawMaterial") {
    return rmBody ? Array.from(rmBody.querySelectorAll("input[data-catalog-key]")) : [];
  }
  if (documentType === "billOfMaterials") {
    return bmBody ? Array.from(bmBody.querySelectorAll("input[data-catalog-key]")) : [];
  }
  if (documentType === "splScrap") {
    return splBody ? Array.from(splBody.querySelectorAll("input[data-catalog-key]")) : [];
  }
  return [];
}

function validateCatalogInputsForDocumentType(documentType) {
  const inputs = getCatalogInputsForDocumentType(documentType);
  const firstInvalid = inputs.find(
    (input) => !validateCatalogCodeInput(input, { reportIfInvalid: false }),
  );

  if (!firstInvalid) return true;

  const fieldLabel = firstInvalid.placeholder || firstInvalid.name || "Campo";
  renderErrorList([
    { message: `${fieldLabel}: selecciona un codigo valido del catalogo.` },
  ]);
  firstInvalid.focus();
  firstInvalid.reportValidity();
  return false;
}

function buildFinishedProductTable() {
  if (!fpHead || !fpBody) return;

  fpHead.innerHTML = "";
  const headerRow = document.createElement("tr");
  finishedProductColumns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col.label;
    if (col.required) {
      const asterisk = document.createElement("span");
      asterisk.className = "required-asterisk";
      asterisk.textContent = " *";
      th.appendChild(asterisk);
    }
    headerRow.appendChild(th);
  });
  const actionsTh = document.createElement("th");
  actionsTh.textContent = "Acciones";
  headerRow.appendChild(actionsTh);
  fpHead.appendChild(headerRow);

  fpBody.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    addFinishedProductRow();
  }
  updateTableScroll(fpBody);
}

function buildRawMaterialTable() {
  if (!rmHead || !rmBody) return;

  rmHead.innerHTML = "";
  const headerRow = document.createElement("tr");
  rawMaterialColumns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col.label;
    if (col.required) {
      const asterisk = document.createElement("span");
      asterisk.className = "required-asterisk";
      asterisk.textContent = " *";
      th.appendChild(asterisk);
    }
    headerRow.appendChild(th);
  });
  const actionsTh = document.createElement("th");
  actionsTh.textContent = "Acciones";
  headerRow.appendChild(actionsTh);
  rmHead.appendChild(headerRow);

  rmBody.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    addRawMaterialRow();
  }
  updateTableScroll(rmBody);
}

function addFinishedProductRow(values = {}) {
  if (!fpBody) return;
  const row = document.createElement("tr");

  finishedProductColumns.forEach((col) => {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.name = `finishedProduct[${col.key}][]`;
    input.placeholder = col.label;
    const rawVal =
      values && Object.prototype.hasOwnProperty.call(values, col.label)
        ? values[col.label]
        : "";
    let displayVal = rawVal;
    if (col.label === "Period (From)" || col.label === "Period (To)") {
      displayVal = formatYmdCompact(rawVal);
    }
    if (displayVal !== null && displayVal !== undefined) {
      input.value = String(displayVal);
    }
    if (col.maxLength) input.maxLength = col.maxLength;
    if (col.required) input.required = true;
    if (col.key === "partNumber") {
      input.addEventListener("input", () => {
        input.value = input.value.toUpperCase();
      });
    }
    if (col.derived) {
      input.readOnly = true;
      input.tabIndex = -1;
      input.setAttribute("aria-readonly", "true");
      input.dataset.skipNavigation = "true";
      input.title =
        "Este valor se calcula automáticamente con Quantity, Unit Value y Added Value.";
    }
    // Autoformato y límite estricto para HTS Code (finishedProduct)
    if (col.key === "usaImportHts" || col.key === "usaExportCode") {
      input.addEventListener("input", () => {
        const val = input.value.replace(/\D/g, "");
        let formatted = val;
        if (val.length > 4) formatted = val.slice(0, 4) + "." + val.slice(4);
        if (val.length > 6)
          formatted = formatted.slice(0, 7) + "." + formatted.slice(7);
        // Limitar a 12 caracteres exactos xxxx.xx.xxxx
        input.value = formatted.slice(0, 12);
      });
    }
    // Navegación por teclado con Enter
    input.addEventListener("keydown", function (e) {
      const rowInputs = Array.from(
        input.closest("tr").querySelectorAll("input"),
      );
      const row = Array.from(fpBody.querySelectorAll("tr")).indexOf(
        input.closest("tr"),
      );
      const col = rowInputs.indexOf(input);
      if (e.key === "Enter") {
        e.preventDefault();
        if (col < rowInputs.length - 1) {
          rowInputs[col + 1].focus();
        } else {
          if (row < fpBody.children.length - 1) {
            const nextRowInputs = Array.from(
              fpBody.children[row + 1].querySelectorAll("input"),
            );
            if (nextRowInputs[0]) nextRowInputs[0].focus();
          } else {
            addFinishedProductRow();
            setTimeout(() => {
              const newRowInputs = Array.from(
                fpBody.children[fpBody.children.length - 1].querySelectorAll(
                  "input",
                ),
              );
              if (newRowInputs[0]) newRowInputs[0].focus();
            }, 0);
          }
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (col < rowInputs.length - 1) {
          rowInputs[col + 1].focus();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (col > 0) {
          rowInputs[col - 1].focus();
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (row < fpBody.children.length - 1) {
          const nextRowInputs = Array.from(
            fpBody.children[row + 1].querySelectorAll("input"),
          );
          if (nextRowInputs[col]) nextRowInputs[col].focus();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (row > 0) {
          const prevRowInputs = Array.from(
            fpBody.children[row - 1].querySelectorAll("input"),
          );
          if (prevRowInputs[col]) prevRowInputs[col].focus();
        }
      }
    });
    td.appendChild(input);
    row.appendChild(td);
  });

  const actionsTd = document.createElement("td");
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "row-remove-btn";
  removeBtn.textContent = "Eliminar";
  removeBtn.addEventListener("click", () => {
    row.remove();
    if (fpBody.children.length === 0) {
      addFinishedProductRow();
    }
  });
  actionsTd.appendChild(removeBtn);
  row.appendChild(actionsTd);

  fpBody.appendChild(row);
  bindCatalogInputsForRow(row, finishedProductColumns);
  updateTableScroll(fpBody);
}

function setFinishedProductRows(rows = []) {
  if (!fpBody) return;
  if (!fpInitialized) {
    buildFinishedProductTable();
    fpInitialized = true;
  }
  fpBody.innerHTML = "";
  const list = Array.isArray(rows) && rows.length ? rows : [{}];
  list.forEach((row) => addFinishedProductRow(row));
  updateTableScroll(fpBody);
}

function setRawMaterialRows(rows = []) {
  if (!rmBody) return;
  if (!rmInitialized) {
    buildRawMaterialTable();
    rmInitialized = true;
  }
  rmBody.innerHTML = "";
  const list = Array.isArray(rows) && rows.length ? rows : [{}];
  list.forEach((row) => addRawMaterialRow(row));
  updateTableScroll(rmBody);
}

function setBillOfMaterialsRows(rows = []) {
  if (!bmBody) return;
  if (!bmInitialized) {
    buildBillOfMaterialsTable();
    bmInitialized = true;
  }
  bmBody.innerHTML = "";
  const list = Array.isArray(rows) && rows.length ? rows : [{}];
  list.forEach((row) => addBillOfMaterialsRow(row));
  updateTableScroll(bmBody);
}

function setSplScrapRows(rows = []) {
  if (!splBody || !splMetaContainer) return;
  if (!splInitialized) {
    buildSplScrapMetaFields();
    buildSplScrapTable();
    splInitialized = true;
  }

  const list = Array.isArray(rows) && rows.length ? rows : [{}];
  const firstRow = list[0] || {};
  splScrapMetaFields.forEach((field) => {
    const input = splMetaInputs[field.key];
    if (!input) return;
    const value = firstRow[field.key];
    if (field.key === "Expected date of arrival") {
      input.value =
        value !== undefined && value !== null ? formatYmdCompact(value) : "";
      input.value = formatYmdDigits(input.value);
      return;
    }
    input.value = value !== undefined && value !== null ? String(value) : "";
  });

  splBody.innerHTML = "";
  list.forEach((row) => addSplScrapRow(row));
  applySplScrapShipmentMode();
  updateTableScroll(splBody);
}
// Utilidad para scroll interno en tablas si hay más de 6 filas
function updateTableScroll(tbody) {
  if (!tbody) return;
  const parent = tbody.parentElement;
  if (!parent) return;
  if (tbody.children.length >= 6) {
    parent.style.maxHeight = "350px";
    parent.style.overflowY = "auto";
  } else {
    parent.style.maxHeight = "";
    parent.style.overflowY = "";
  }
}

function addRawMaterialRow(values = {}) {
  if (!rmBody) return;
  const row = document.createElement("tr");

  rawMaterialColumns.forEach((col) => {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.name = `rawMaterial[${col.key}][]`;
    input.placeholder = col.label;
    if (col.maxLength) input.maxLength = col.maxLength;
    const rawVal =
      values && Object.prototype.hasOwnProperty.call(values, col.label)
        ? values[col.label]
        : "";
    let displayVal = rawVal;
    if (col.label === "License Expiration date") {
      displayVal = formatYmdCompact(rawVal);
    }
    if (displayVal !== null && displayVal !== undefined) {
      input.value = String(displayVal);
    }
    if (col.required) input.required = true;
    if (col.key === "partNumber") {
      input.addEventListener("input", () => {
        input.value = input.value.toUpperCase();
      });
    }
    // Autoformato y límite estricto para HTS Code (rawMaterial)
    if (col.key === "importHts" || col.key === "exportHts") {
      input.addEventListener("input", () => {
        const val = input.value.replace(/\D/g, "");
        let formatted = val;
        if (val.length > 4) formatted = val.slice(0, 4) + "." + val.slice(4);
        if (val.length > 6)
          formatted = formatted.slice(0, 7) + "." + formatted.slice(7);
        // Limitar a 12 caracteres exactos xxxx.xx.xxxx
        input.value = formatted.slice(0, 12);
      });
    }
    // Navegación por teclado con Enter
    input.addEventListener("keydown", function (e) {
      const rowInputs = Array.from(
        input.closest("tr").querySelectorAll("input"),
      );
      const row = Array.from(rmBody.querySelectorAll("tr")).indexOf(
        input.closest("tr"),
      );
      const col = rowInputs.indexOf(input);
      if (e.key === "Enter") {
        e.preventDefault();
        if (col < rowInputs.length - 1) {
          rowInputs[col + 1].focus();
        } else {
          if (row < rmBody.children.length - 1) {
            const nextRowInputs = Array.from(
              rmBody.children[row + 1].querySelectorAll("input"),
            );
            if (nextRowInputs[0]) nextRowInputs[0].focus();
          } else {
            addRawMaterialRow();
            setTimeout(() => {
              const newRowInputs = Array.from(
                rmBody.children[rmBody.children.length - 1].querySelectorAll(
                  "input",
                ),
              );
              if (newRowInputs[0]) newRowInputs[0].focus();
            }, 0);
          }
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (col < rowInputs.length - 1) {
          rowInputs[col + 1].focus();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (col > 0) {
          rowInputs[col - 1].focus();
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (row < rmBody.children.length - 1) {
          const nextRowInputs = Array.from(
            rmBody.children[row + 1].querySelectorAll("input"),
          );
          if (nextRowInputs[col]) nextRowInputs[col].focus();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (row > 0) {
          const prevRowInputs = Array.from(
            rmBody.children[row - 1].querySelectorAll("input"),
          );
          if (prevRowInputs[col]) prevRowInputs[col].focus();
        }
      }
    });
    td.appendChild(input);
    row.appendChild(td);
  });

  const actionsTd = document.createElement("td");
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "row-remove-btn";
  removeBtn.textContent = "Eliminar";
  removeBtn.addEventListener("click", () => {
    row.remove();
    if (rmBody.children.length === 0) {
      addRawMaterialRow();
    }
  });
  actionsTd.appendChild(removeBtn);
  row.appendChild(actionsTd);

  rmBody.appendChild(row);
  bindCatalogInputsForRow(row, rawMaterialColumns);
  updateTableScroll(rmBody);
}

function buildBillOfMaterialsTable() {
  if (!bmHead || !bmBody) return;

  bmHead.innerHTML = "";
  const headerRow = document.createElement("tr");
  billOfMaterialsColumns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col.label;
    if (col.required) {
      const asterisk = document.createElement("span");
      asterisk.className = "required-asterisk";
      asterisk.textContent = " *";
      th.appendChild(asterisk);
    }
    headerRow.appendChild(th);
  });
  const actionsTh = document.createElement("th");
  actionsTh.textContent = "Acciones";
  headerRow.appendChild(actionsTh);
  bmHead.appendChild(headerRow);

  bmBody.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    addBillOfMaterialsRow();
  }
  updateTableScroll(bmBody);
}

function addBillOfMaterialsRow(values = {}) {
  if (!bmBody) return;
  const row = document.createElement("tr");

  billOfMaterialsColumns.forEach((col) => {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.name = `billOfMaterials[${col.key}][]`;
    input.placeholder = col.label;
    if (col.maxLength) input.maxLength = col.maxLength;
    const rawVal =
      values && Object.prototype.hasOwnProperty.call(values, col.label)
        ? values[col.label]
        : "";
    if (rawVal !== null && rawVal !== undefined) {
      input.value = String(rawVal);
    }
    if (col.required) input.required = true;
    if (
      col.key === "finishedGoodPartNumber" ||
      col.key === "componentPartNumber"
    ) {
      input.addEventListener("input", () => {
        input.value = input.value.toUpperCase();
      });
    }
    // Navegación por teclado con Enter
    input.addEventListener("keydown", function (e) {
      const rowInputs = Array.from(
        input.closest("tr").querySelectorAll("input"),
      );
      const row = Array.from(bmBody.querySelectorAll("tr")).indexOf(
        input.closest("tr"),
      );
      const col = rowInputs.indexOf(input);
      if (e.key === "Enter") {
        e.preventDefault();
        if (col < rowInputs.length - 1) {
          rowInputs[col + 1].focus();
        } else {
          if (row < bmBody.children.length - 1) {
            const nextRowInputs = Array.from(
              bmBody.children[row + 1].querySelectorAll("input"),
            );
            if (nextRowInputs[0]) nextRowInputs[0].focus();
          } else {
            addBillOfMaterialsRow();
            setTimeout(() => {
              const newRowInputs = Array.from(
                bmBody.children[bmBody.children.length - 1].querySelectorAll(
                  "input",
                ),
              );
              if (newRowInputs[0]) newRowInputs[0].focus();
            }, 0);
          }
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (col < rowInputs.length - 1) {
          rowInputs[col + 1].focus();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (col > 0) {
          rowInputs[col - 1].focus();
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (row < bmBody.children.length - 1) {
          const nextRowInputs = Array.from(
            bmBody.children[row + 1].querySelectorAll("input"),
          );
          if (nextRowInputs[col]) nextRowInputs[col].focus();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (row > 0) {
          const prevRowInputs = Array.from(
            bmBody.children[row - 1].querySelectorAll("input"),
          );
          if (prevRowInputs[col]) prevRowInputs[col].focus();
        }
      }
    });
    td.appendChild(input);
    row.appendChild(td);
  });

  const actionsTd = document.createElement("td");
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "row-remove-btn";
  removeBtn.textContent = "Eliminar";
  removeBtn.addEventListener("click", () => {
    row.remove();
    if (bmBody.children.length === 0) {
      addBillOfMaterialsRow();
    }
  });
  actionsTd.appendChild(removeBtn);
  row.appendChild(actionsTd);

  bmBody.appendChild(row);
  bindCatalogInputsForRow(row, billOfMaterialsColumns);
  updateTableScroll(bmBody);
}

function formatYmd(value) {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 8);
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  let out = y;
  if (m) out += `-${m}`;
  if (d) out += `-${d}`;
  return out;
}

function formatYmdDigits(value) {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 8);
  return digits;
}

function formatYmdCompact(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  }
  const raw = String(value).trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) return digits.slice(0, 8);
  return raw;
}

function parseSplScrapNumericInput(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(/,/g, "");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSplScrapDerivedNumber(value) {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round((value + Number.EPSILON) * 1e8) / 1e8;
  return rounded.toFixed(8).replace(/\.?0+$/, "");
}

function calculateSplScrapTotalValue(quantityValue, unitValue, addedValue) {
  const quantity = parseSplScrapNumericInput(quantityValue);
  const unitValueUsd = parseSplScrapNumericInput(unitValue);
  const addedValueUsd = parseSplScrapNumericInput(addedValue);

  if (
    quantity === null ||
    unitValueUsd === null ||
    addedValueUsd === null
  ) {
    return "";
  }

  return formatSplScrapDerivedNumber(
    (unitValueUsd + addedValueUsd) * quantity,
  );
}

function getSplScrapRowField(rowElement, key) {
  if (!rowElement) return null;
  return rowElement.querySelector(`[data-spl-key="${key}"]`);
}

function updateSplScrapRowComputedFields(rowElement) {
  if (!rowElement) return;

  const quantityInput = getSplScrapRowField(rowElement, "quantity");
  const unitValueInput = getSplScrapRowField(rowElement, "unitValueUsd");
  const addedValueInput = getSplScrapRowField(rowElement, "addedValueUsd");
  const totalValueInput = getSplScrapRowField(rowElement, "totalValueUsd");

  if (!totalValueInput) return;

  totalValueInput.value = calculateSplScrapTotalValue(
    quantityInput ? quantityInput.value : "",
    unitValueInput ? unitValueInput.value : "",
    addedValueInput ? addedValueInput.value : "",
  );
}

function isSplScrapShipmentScrap(value) {
  return String(value || "").trim().toLowerCase() === "scrap";
}

function getSplScrapIsScrapMode() {
  return isSplScrapShipmentScrap(splMetaInputs["Type of shipment"]?.value);
}

function handleSplScrapUnitOfMeasureInput(input, finalize = false) {
  if (!input) return;
  input.value = String(input.value || "").trim().toUpperCase();
}

function isSplScrapAutoZeroValue(value) {
  const normalized = String(value || "").trim();
  if (normalized === "") return true;
  const parsed = parseSplScrapNumericInput(normalized);
  return parsed === 0;
}

function splScrapRowHasMeaningfulData(rowElement, isScrap = false) {
  if (!rowElement) return false;

  return splScrapColumns.some((col) => {
    if (col.derived) return false;

    const field = getSplScrapRowField(rowElement, col.key);
    if (!field) return false;

    const value = String(field.value || "").trim();
    if (value === "") return false;

    if (isScrap && col.key === "addedValueUsd" && isSplScrapAutoZeroValue(value)) {
      return false;
    }

    return true;
  });
}

function normalizeSplScrapRowsForShipmentMode(isScrap) {
  if (!splBody) return;

  const rows = Array.from(splBody.querySelectorAll("tr"));
  if (!rows.length) {
    addSplScrapRow();
    return;
  }

  if (!isScrap) return;

  const rowsWithData = rows.filter((rowElement) =>
    splScrapRowHasMeaningfulData(rowElement, true),
  );
  const rowsToKeep =
    rowsWithData.length > 0 ? new Set(rowsWithData) : new Set([rows[0]]);

  rows.forEach((rowElement) => {
    if (!rowsToKeep.has(rowElement)) {
      rowElement.remove();
    }
  });

  if (!splBody.children.length) {
    addSplScrapRow();
  }
}

function applySplScrapTypeOfGoodsRestriction(isScrap) {
  const typeOfGoodsInput = splMetaInputs["Type of goods"];
  if (!typeOfGoodsInput) return;

  const options = Array.from(typeOfGoodsInput.options || []);

  if (isScrap) {
    if (typeOfGoodsInput.dataset.scrapLocked !== "true") {
      typeOfGoodsInput.dataset.nonScrapValue = typeOfGoodsInput.value || "";
    }
    options.forEach((option) => {
      if (!option.value) return;
      option.disabled = option.value !== SPLSCRAP_SCRAP_TYPE_OF_GOODS;
    });
    typeOfGoodsInput.value = SPLSCRAP_SCRAP_TYPE_OF_GOODS;
    typeOfGoodsInput.disabled = true;
    typeOfGoodsInput.dataset.scrapLocked = "true";
    return;
  }

  options.forEach((option) => {
    option.disabled = false;
  });
  typeOfGoodsInput.disabled = false;
  if (typeOfGoodsInput.dataset.scrapLocked === "true") {
    typeOfGoodsInput.value = typeOfGoodsInput.dataset.nonScrapValue || "";
  }
  delete typeOfGoodsInput.dataset.scrapLocked;
  delete typeOfGoodsInput.dataset.nonScrapValue;
}

function applySplScrapRowShipmentMode(rowElement, isScrap) {
  if (!rowElement) return;

  const addedValueInput = getSplScrapRowField(rowElement, "addedValueUsd");
  if (addedValueInput) {
    if (isScrap) {
      if (addedValueInput.dataset.scrapLocked !== "true") {
        addedValueInput.dataset.nonScrapValue = addedValueInput.value || "";
      }
      addedValueInput.value = "0";
      addedValueInput.readOnly = true;
      addedValueInput.tabIndex = -1;
      addedValueInput.setAttribute("aria-readonly", "true");
      addedValueInput.dataset.scrapLocked = "true";
    } else {
      addedValueInput.readOnly = false;
      addedValueInput.tabIndex = 0;
      addedValueInput.removeAttribute("aria-readonly");
      if (addedValueInput.dataset.scrapLocked === "true") {
        addedValueInput.value = addedValueInput.dataset.nonScrapValue || "";
      }
      delete addedValueInput.dataset.scrapLocked;
      delete addedValueInput.dataset.nonScrapValue;
    }
  }

  const unitOfMeasureInput = getSplScrapRowField(rowElement, "unitOfMeasure");
  if (unitOfMeasureInput) {
    unitOfMeasureInput.placeholder = "Unit Of Measure";
    unitOfMeasureInput.removeAttribute("title");
    handleSplScrapUnitOfMeasureInput(unitOfMeasureInput, false);
    syncCatalogAutocompleteInput(unitOfMeasureInput);
  }

  updateSplScrapRowComputedFields(rowElement);
}

function applySplScrapShipmentMode() {
  const isScrap = getSplScrapIsScrapMode();
  applySplScrapTypeOfGoodsRestriction(isScrap);

  if (!splBody) return;
  splBody.querySelectorAll("tr").forEach((rowElement) => {
    applySplScrapRowShipmentMode(rowElement, isScrap);
  });
  normalizeSplScrapRowsForShipmentMode(isScrap);
  updateTableScroll(splBody);
}

function buildSplScrapMetaFields() {
  if (!splMetaContainer) return;
  splMetaContainer.innerHTML = "";

  splScrapMetaFields.forEach((field, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = "meta-field";

    const label = document.createElement("label");
    const inputId = `splMeta_${idx}`;
    label.setAttribute("for", inputId);
    label.textContent = field.label;
    if (field.required) {
      const asterisk = document.createElement("span");
      asterisk.className = "required-asterisk";
      asterisk.textContent = " *";
      label.appendChild(asterisk);
    }

    let input;
    if (Array.isArray(field.options)) {
      input = document.createElement("select");
      const emptyOpt = document.createElement("option");
      emptyOpt.value = "";
      emptyOpt.textContent = "-- Seleccione --";
      input.appendChild(emptyOpt);
      field.options.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        input.appendChild(option);
      });
    } else {
      input = document.createElement("input");
      input.type = field.inputType || "text";
      input.placeholder = field.label;
    }

    input.id = inputId;
    if (field.required) input.required = true;
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.pattern) input.setAttribute("pattern", field.pattern);
    if (field.title) input.title = field.title;
    if (field.key === "Expected date of arrival") {
      input.maxLength = 8;
      input.addEventListener("input", (e) => {
        e.target.value = formatYmdDigits(e.target.value);
      });
    }
    if (field.key === "Type of shipment") {
      input.addEventListener("change", () => {
        applySplScrapShipmentMode();
      });
    }

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    splMetaContainer.appendChild(wrapper);
    splMetaInputs[field.key] = input;
  });

  applySplScrapShipmentMode();
}

function buildSplScrapTable() {
  if (!splHead || !splBody) return;

  splHead.innerHTML = "";
  const headerRow = document.createElement("tr");
  splScrapColumns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col.label;
    if (col.required) {
      const asterisk = document.createElement("span");
      asterisk.className = "required-asterisk";
      asterisk.textContent = " *";
      th.appendChild(asterisk);
    }
    headerRow.appendChild(th);
  });
  const actionsTh = document.createElement("th");
  actionsTh.textContent = "Acciones";
  headerRow.appendChild(actionsTh);
  splHead.appendChild(headerRow);

  splBody.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    addSplScrapRow();
  }
  updateTableScroll(splBody);
}

function getSplScrapRowEditors(rowElement) {
  if (!rowElement) return [];
  return Array.from(rowElement.querySelectorAll("input, select")).filter(
    (element) => element.dataset.skipNavigation !== "true",
  );
}

function addSplScrapRow(values = {}) {
  if (!splBody) return;
  const row = document.createElement("tr");

  splScrapColumns.forEach((col) => {
    const td = document.createElement("td");
    let input;
    if (Array.isArray(col.options) && col.key !== "regime") {
      input = document.createElement("select");
      const emptyOpt = document.createElement("option");
      emptyOpt.value = "";
      emptyOpt.textContent = "-- Seleccione --";
      input.appendChild(emptyOpt);
      col.options.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        input.appendChild(option);
      });
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.placeholder =
        col.key === "regime" ? "-- Seleccione --" : col.label;
      if (col.key === "regime") {
        input.classList.add("spl-regime-select");
      }
      if (col.maxLength) input.maxLength = col.maxLength;
    }
    input.name = `splScrap[${col.key}][]`;
    input.dataset.splKey = col.key;
    if (col.derived) {
      input.readOnly = true;
      input.dataset.skipNavigation = "true";
      input.title =
        "Este valor se calcula automáticamente con Quantity, Unit Value y Added Value.";
    }
    if (col.required) input.required = true;
    const initialValue =
      col.label && values && values[col.label] !== undefined
        ? values[col.label]
        : values && values[col.key] !== undefined
          ? values[col.key]
          : "";
    if (initialValue !== undefined && initialValue !== null) {
      input.value = String(initialValue);
    }
    if (col.key === "partNumber") {
      input.addEventListener("input", () => {
        input.value = input.value.toUpperCase();
      });
    }
    // Autoformato y límite estricto para HTS Code (packing list SPL/Scrap)
    if (
      input.tagName === "INPUT" &&
      (col.key === "usImpHts" || col.key === "usExpHts")
    ) {
      input.addEventListener("input", () => {
        const val = input.value.replace(/\D/g, "");
        let formatted = val;
        if (val.length > 4) formatted = val.slice(0, 4) + "." + val.slice(4);
        if (val.length > 6)
          formatted = formatted.slice(0, 7) + "." + formatted.slice(7);
        // Limitar a 12 caracteres exactos xxxx.xx.xxxx
        input.value = formatted.slice(0, 12);
      });
    }
    if (
      input.tagName === "INPUT" &&
      (col.key === "quantity" ||
        col.key === "unitValueUsd" ||
        col.key === "addedValueUsd")
    ) {
      input.addEventListener("input", () => {
        updateSplScrapRowComputedFields(row);
      });
    }
    // Navegación por teclado con Enter
    input.addEventListener("keydown", function (e) {
      const currentRow = input.closest("tr");
      const rowInputs = getSplScrapRowEditors(currentRow);
      const row = Array.from(splBody.querySelectorAll("tr")).indexOf(
        currentRow,
      );
      const col = rowInputs.indexOf(input);
      if (e.key === "Enter") {
        e.preventDefault();
        if (col < rowInputs.length - 1) {
          rowInputs[col + 1].focus();
        } else {
          if (row < splBody.children.length - 1) {
            const nextRowInputs = getSplScrapRowEditors(
              splBody.children[row + 1],
            );
            if (nextRowInputs[0]) nextRowInputs[0].focus();
          } else {
            addSplScrapRow();
            setTimeout(() => {
              const newRowInputs = getSplScrapRowEditors(
                splBody.children[splBody.children.length - 1],
              );
              if (newRowInputs[0]) newRowInputs[0].focus();
            }, 0);
          }
        }
      } else if (
        currentRow &&
        input.tagName === "SELECT" &&
        (e.key === "ArrowDown" || e.key === "ArrowUp")
      ) {
        return;
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (col < rowInputs.length - 1) {
          rowInputs[col + 1].focus();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (col > 0) {
          rowInputs[col - 1].focus();
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (row < splBody.children.length - 1) {
          const nextRowInputs = getSplScrapRowEditors(
            splBody.children[row + 1],
          );
          if (nextRowInputs[col]) nextRowInputs[col].focus();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (row > 0) {
          const prevRowInputs = getSplScrapRowEditors(
            splBody.children[row - 1],
          );
          if (prevRowInputs[col]) prevRowInputs[col].focus();
        }
      }
    });
    td.appendChild(input);
    row.appendChild(td);
  });

  const actionsTd = document.createElement("td");
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "row-remove-btn";
  removeBtn.textContent = "Eliminar";
  removeBtn.addEventListener("click", () => {
    row.remove();
    if (splBody.children.length === 0) {
      addSplScrapRow();
    }
  });
  actionsTd.appendChild(removeBtn);
  row.appendChild(actionsTd);

  splBody.appendChild(row);
  bindCatalogInputsForRow(row, splScrapColumns);
  applySplScrapRowShipmentMode(row, getSplScrapIsScrapMode());
  updateSplScrapRowComputedFields(row);
  updateTableScroll(splBody);
}

function showFormat(type) {
  resetValidationResult();
  sections.forEach((s) => s.classList.add("hidden"));
  const id = map[type];
  if (id) {
    document.getElementById(id).classList.remove("hidden");
  }
    if (adminFileNameGroup) {
      if (
        type === "finishedProduct" ||
        type === "rawMaterial" ||
        type === "billOfMaterials" ||
        type === "splScrap"
      ) {
        adminFileNameGroup.classList.remove("hidden");
      } else {
      adminFileNameGroup.classList.add("hidden");
      if (adminFileNameInput) adminFileNameInput.value = "";
    }
  }
  if (type === "finishedProduct" && !fpInitialized) {
    buildFinishedProductTable();
    fpInitialized = true;
  }
  if (type === "rawMaterial" && !rmInitialized) {
    buildRawMaterialTable();
    rmInitialized = true;
  }
  if (type === "billOfMaterials" && !bmInitialized) {
    buildBillOfMaterialsTable();
    bmInitialized = true;
  }
  if (type === "splScrap" && !splInitialized) {
    buildSplScrapMetaFields();
    buildSplScrapTable();
    splInitialized = true;
  }
}

if (fpAddRowBtn) {
  fpAddRowBtn.addEventListener("click", addFinishedProductRow);
}

if (rmAddRowBtn) {
  rmAddRowBtn.addEventListener("click", addRawMaterialRow);
}

if (bmAddRowBtn) {
  bmAddRowBtn.addEventListener("click", addBillOfMaterialsRow);
}

if (splAddRowBtn) {
  splAddRowBtn.addEventListener("click", addSplScrapRow);
}

function renderErrorList(errors, title = "Errores") {
  if (!validationResult) return;
  validationResult.classList.remove("hidden", "success", "error", "warning");
  validationResult.classList.add("error");
  validationResult.innerHTML = "";

  const safeErrors = Array.isArray(errors) ? errors : [];
  const h4 = document.createElement("h4");
  h4.textContent = `${title} (${safeErrors.length})`;
  const ul = document.createElement("ul");
  safeErrors.forEach((err) => {
    const li = document.createElement("li");
    li.textContent = err.message || JSON.stringify(err);
    ul.appendChild(li);
  });
  validationResult.append(h4, ul);
}

function resetValidationResult() {
  if (!validationResult) return;
  validationResult.classList.remove("success", "error", "warning");
  validationResult.classList.add("hidden");
  validationResult.innerHTML = "";
}

function getDocumentTypeLabel(documentType) {
  return DOCUMENT_TYPE_LABELS[documentType] || documentType || "-";
}

function getNomenclatureFromLastDownloadedName(lastDownloadedName) {
  const safeValue = String(lastDownloadedName || "").trim();
  if (!safeValue) return "";
  const lastDotIndex = safeValue.lastIndexOf(".");
  return lastDotIndex > 0 ? safeValue.slice(0, lastDotIndex) : safeValue;
}

function buildCreatedFileDetails({
  adminFileName = "",
  nomenclature = "",
  documentType = "",
  lastDownloadedName = "",
} = {}) {
  const details = document.createElement("div");
  details.className = "conversion-result-details";
  const resolvedNomenclature =
    nomenclature || getNomenclatureFromLastDownloadedName(lastDownloadedName);

  const lines = [
    ["Nombre", adminFileName || "-"],
    ["Nomenclatura", resolvedNomenclature || "-"],
    ["Tipo", getDocumentTypeLabel(documentType)],
  ];

  lines.forEach(([label, value]) => {
    const line = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    line.appendChild(strong);
    line.appendChild(document.createTextNode(value));
    details.appendChild(line);
  });

  return details;
}

function renderSuccess({
  jobId,
  adminFileName = "",
  nomenclature = "",
  documentType = "",
  lastDownloadedName = "",
} = {}) {
  if (!validationResult) return;
  validationResult.classList.remove("hidden", "success", "error", "warning");
  validationResult.classList.add("success");
  validationResult.innerHTML = "";

  const h4 = document.createElement("h4");
  h4.textContent = "Archivo creado";
  const p = document.createElement("p");
  p.textContent = "El archivo se gener\u00f3 autom\u00e1ticamente.";
  const details = buildCreatedFileDetails({
    adminFileName,
    nomenclature,
    documentType,
    lastDownloadedName,
  });
  const actions = document.createElement("div");
  actions.className = "result-actions";
  const link = document.createElement("a");
  link.href = `/api/files/${jobId}/download`;
  link.target = "_blank";
  link.textContent = "Descargar Archivo";
  actions.appendChild(link);

  validationResult.append(h4, p, details, actions);
}

function renderWarning(errors, jobId) {
  if (!validationResult) return;
  validationResult.classList.remove("hidden", "success", "error", "warning");
  validationResult.classList.add("warning");
  validationResult.innerHTML = "";

  const h4 = document.createElement("h4");
  h4.textContent = "Creado con errores";
  const p = document.createElement("p");
  p.textContent = "El archivo se proces\u00f3, pero se encontraron problemas.";

  validationResult.append(h4, p);

  if (Array.isArray(errors) && errors.length > 0) {
    const ul = document.createElement("ul");
    errors.forEach((err) => {
      const li = document.createElement("li");
      li.textContent = err.message || JSON.stringify(err);
      ul.appendChild(li);
    });
    validationResult.appendChild(ul);
  }

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const link = document.createElement("a");
  link.href = `/api/files/${jobId}/errors`;
  link.target = "_blank";
  link.textContent = "Descargar Reporte de Errores";
  actions.appendChild(link);
  validationResult.appendChild(actions);
}

function collectFinishedProductRows() {
  if (!fpBody) return [];
  const rows = [];
  fpBody.querySelectorAll("tr").forEach((tr) => {
    const inputs = tr.querySelectorAll("input");
    const row = {};
    finishedProductColumns.forEach((col, idx) => {
      const val = inputs[idx] ? inputs[idx].value : "";
      row[col.label] = val;
    });
    const hasValue = Object.values(row).some((v) => String(v).trim() !== "");
    if (hasValue) rows.push(row);
  });
  return rows;
}

function collectRawMaterialRows() {
  if (!rmBody) return [];
  const rows = [];
  rmBody.querySelectorAll("tr").forEach((tr) => {
    const inputs = tr.querySelectorAll("input");
    const row = {};
    rawMaterialColumns.forEach((col, idx) => {
      const val = inputs[idx] ? inputs[idx].value : "";
      row[col.label] = val;
    });
    const hasValue = Object.values(row).some((v) => String(v).trim() !== "");
    if (hasValue) rows.push(row);
  });
  return rows;
}

function collectBillOfMaterialsRows() {
  if (!bmBody) return [];
  const rows = [];
  bmBody.querySelectorAll("tr").forEach((tr) => {
    const inputs = tr.querySelectorAll("input");
    const row = {};
    billOfMaterialsColumns.forEach((col, idx) => {
      const val = inputs[idx] ? inputs[idx].value : "";
      row[col.label] = val;
    });
    const hasValue = Object.values(row).some((v) => String(v).trim() !== "");
    if (hasValue) rows.push(row);
  });
  return rows;
}

function collectSplScrapMeta() {
  const meta = {};
  splScrapMetaFields.forEach((field) => {
    const input = splMetaInputs[field.key];
    meta[field.key] = input ? input.value : "";
  });
  return meta;
}

function collectSplScrapRows() {
  if (!splBody) return [];
  const meta = collectSplScrapMeta();
  const isScrap = getSplScrapIsScrapMode();
  const rows = [];
  splBody.querySelectorAll("tr").forEach((tr) => {
    updateSplScrapRowComputedFields(tr);
    const inputs = tr.querySelectorAll("input, select");
    const row = {};
    splScrapColumns.forEach((col, idx) => {
      const val = inputs[idx] ? inputs[idx].value : "";
      row[col.label] = val;
    });
    const hasValue = splScrapRowHasMeaningfulData(tr, isScrap);
    if (hasValue) rows.push({ ...meta, ...row });
  });
  return rows;
}

async function createManualFile(documentType, rows, displayName) {
  if (!rows.length) {
    renderErrorList([{ message: "No hay filas con datos para crear." }]);
    return;
  }

  const spinner = createFileButton
    ? createFileButton.querySelector(".spinner")
    : null;
  if (createFileButton) createFileButton.disabled = true;
  if (spinner) spinner.classList.remove("hidden");

  try {
    const response = await fetch("/api/files/create-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentType,
        rows,
        displayName: displayName || undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Error al crear.");
    }
    if (data.status === "completed") {
      renderSuccess({
        jobId: data.jobId,
        adminFileName: data.adminFileName,
        nomenclature: data.nomenclature,
        documentType: data.documentType,
        lastDownloadedName: data.lastDownloadedName,
      });
    } else if (data.status === "completed_with_errors") {
      renderWarning(data.errors || [], data.jobId);
    } else {
      renderErrorList(
        data.errors || [{ message: "No se pudo crear el archivo." }],
      );
    }
  } catch (err) {
    renderErrorList([{ message: err.message || "Error al crear archivo." }]);
  } finally {
    if (createFileButton) createFileButton.disabled = false;
    if (spinner) spinner.classList.add("hidden");
  }
}

async function loadFileForEdit(docId, docType) {
  if (!docId) return;
  const targetType = docType || "finishedProduct";
    if (
      targetType !== "finishedProduct" &&
      targetType !== "rawMaterial" &&
      targetType !== "billOfMaterials" &&
      targetType !== "splScrap"
    ) {
      renderErrorList([{ message: "Tipo de archivo invalido para editar." }]);
      return;
    }
  try {
    const response = await fetch(
      `/api/files/admin-files/${docId}?type=${targetType}`,
    );
    if (!response.ok) {
      throw new Error("No se pudo cargar el archivo.");
    }
    const data = await response.json();
    const doc = data && data.document ? data.document : null;
    if (!doc) {
      throw new Error("Archivo no encontrado.");
    }

    editingFileId = doc._id;
    if (fileType) {
      fileType.value = targetType;
      fileType.disabled = true;
    }
    showFormat(targetType);

    if (adminFileNameGroup) {
      adminFileNameGroup.classList.remove("hidden");
    }
    if (adminFileNameInput) {
      adminFileNameInput.value = doc.adminFileName || "";
    }

      if (targetType === "finishedProduct") {
        setFinishedProductRows(doc.rows || []);
      } else if (targetType === "rawMaterial") {
        setRawMaterialRows(doc.rows || []);
      } else if (targetType === "billOfMaterials") {
        setBillOfMaterialsRows(doc.rows || []);
      } else if (targetType === "splScrap") {
        setSplScrapRows(doc.rows || []);
      }

    if (createFileButton) createFileButton.classList.add("hidden");
    if (updateFileButton) updateFileButton.classList.remove("hidden");
  } catch (err) {
    renderErrorList([{ message: err.message || "Error al cargar archivo." }]);
  }
}

if (fileType) {
  fileType.addEventListener("change", async (e) => {
    await loadManualCatalogOptions(true);
    showFormat(e.target.value);
  });

  // Para cargar el estado inicial
  showFormat(fileType.value);
}

loadManualCatalogOptions();
window.addEventListener("focus", () => {
  loadManualCatalogOptions(true);
});

if (createFileButton) {
  createFileButton.addEventListener("click", async () => {
    if (!fileType || !fileType.value) {
      renderErrorList([{ message: "Selecciona un tipo de archivo." }]);
      return;
    }
    await loadManualCatalogOptions(true);
    if (!validateCatalogInputsForDocumentType(fileType.value)) {
      return;
    }
    if (fileType.value === "finishedProduct") {
      const name =
        adminFileNameInput && adminFileNameInput.value
          ? adminFileNameInput.value.trim()
          : "";
      createManualFile("finishedProduct", collectFinishedProductRows(), name);
      return;
    }
    if (fileType.value === "rawMaterial") {
      const name =
        adminFileNameInput && adminFileNameInput.value
          ? adminFileNameInput.value.trim()
          : "";
      createManualFile("rawMaterial", collectRawMaterialRows(), name);
      return;
    }
    if (fileType.value === "billOfMaterials") {
      const name =
        adminFileNameInput && adminFileNameInput.value
          ? adminFileNameInput.value.trim()
          : "";
      createManualFile("billOfMaterials", collectBillOfMaterialsRows(), name);
      return;
    }
      if (fileType.value === "splScrap") {
        const name =
          adminFileNameInput && adminFileNameInput.value
            ? adminFileNameInput.value.trim()
            : "";
        createManualFile("splScrap", collectSplScrapRows(), name);
        return;
      }
    renderErrorList([
      { message: "Este tipo a\u00fan no est\u00e1 disponible." },
    ]);
  });
}

if (updateFileButton) {
  updateFileButton.addEventListener("click", async () => {
    if (!editingFileId) return;
    if (!fileType) {
      renderErrorList([
        { message: "Tipo de archivo invalido para actualizar." },
      ]);
      return;
    }
    const targetType = fileType.value;
    await loadManualCatalogOptions(true);
      if (
        targetType !== "finishedProduct" &&
        targetType !== "rawMaterial" &&
        targetType !== "billOfMaterials" &&
        targetType !== "splScrap"
      ) {
        renderErrorList([
          { message: "Tipo de archivo invalido para actualizar." },
        ]);
        return;
      }
    if (!validateCatalogInputsForDocumentType(targetType)) {
      return;
    }

      const rows =
        targetType === "rawMaterial"
          ? collectRawMaterialRows()
          : targetType === "billOfMaterials"
            ? collectBillOfMaterialsRows()
            : targetType === "splScrap"
              ? collectSplScrapRows()
              : collectFinishedProductRows();
    if (!rows.length) {
      renderErrorList([{ message: "No hay filas con datos para actualizar." }]);
      return;
    }

    const btnText = updateFileButton.querySelector(".btn-text");
    const spinner = updateFileButton.querySelector(".spinner");
    updateFileButton.disabled = true;
    if (btnText) btnText.classList.add("hidden");
    if (spinner) spinner.classList.remove("hidden");

    try {
      const displayName =
        adminFileNameInput && adminFileNameInput.value
          ? adminFileNameInput.value.trim()
          : "";
      const response = await fetch(
        `/api/files/admin-files/${editingFileId}?type=${targetType}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows,
            displayName: displayName || undefined,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        const errors = data && data.errors ? data.errors : [];
        if (errors.length) {
          renderErrorList(errors, "Errores");
        } else {
          throw new Error(data.message || "No se pudo actualizar.");
        }
        return;
      }
      window.location.href = `/file-admin.html?type=${targetType}`;
    } catch (err) {
      renderErrorList([{ message: err.message || "Error al actualizar." }]);
    } finally {
      updateFileButton.disabled = false;
      if (btnText) btnText.classList.remove("hidden");
      if (spinner) spinner.classList.add("hidden");
    }
  });
}

const urlParams = new URLSearchParams(window.location.search);
const editId = urlParams.get("edit");
const editType = urlParams.get("type");
if (editId) {
  loadFileForEdit(editId, editType);
}
