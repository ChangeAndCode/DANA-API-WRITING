const masterEditorMessage = document.getElementById("masterEditorMessage");

const masterEditorPanel = document.getElementById("masterEditorPanel");

const masterEditorType = document.getElementById("masterEditorType");

const masterEditorName = document.getElementById("masterEditorName");

const masterEditorSitesGroup = document.getElementById("masterEditorSitesGroup");

const masterEditorSiteCheckboxes = document.querySelectorAll('input[name="masterEditorSites"]');

const masterEditorScopeMessage = document.getElementById("masterEditorScopeMessage");

const masterEditorTableWrapper = document.getElementById("masterEditorTableWrapper");

const masterEditorTableHead = document.getElementById("masterEditorTableHead");

const masterEditorTableBody = document.getElementById("masterEditorTableBody");

const masterEditorPlaceholder = document.getElementById("masterEditorPlaceholder");

const masterEditorSaveButton = document.getElementById("masterEditorSaveButton");

const masterEditorAddRowButton = document.getElementById("masterEditorAddRowButton");

const masterEditorBackLink = document.getElementById("masterEditorBackLink");

const masterEditorExitModal = document.getElementById("masterEditorExitModal");

const masterEditorExitCancelButton = document.getElementById("masterEditorExitCancelButton");

const masterEditorExitConfirmButton = document.getElementById("masterEditorExitConfirmButton");

let currentEditorUser = null;
let editorHasChanges = false;
let currentMasterRevision = 0;
let editorIsSaving = false;
let orderedMasterHeaders = [];
const deletedMasterRecordIds =
  new Set();
let pendingEditorNavigation = "";
const masterCatalogState = {
  unitOfMeasure: {
    options: [],
    optionsSet: new Set(),
  },

  countryOfOrigin: {
    options: [],
    optionsSet: new Set(),
    nameToCode: new Map(),
  },
};

let activeMasterCatalogInput = null;

const MASTER_CATALOG_MAX_OPTIONS = 10;

const MASTER_COUNTRY_CODE_ALIASES =
  new Map([
    ["USA", "US"],
  ]);

const MASTER_TYPE_LABELS = {
  finishedProduct: "Finished Goods",
  rawMaterial: "Raw Material",
};

const normalizeMasterCatalogValue = (
  value,
) => {
  return String(value || "")
    .trim()
    .toUpperCase();
};

const normalizeMasterCountryName = (
  value,
) => {
  return String(value || "")
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toUpperCase()
    .trim();
};

const applyMasterCatalogOptions = (
  payload = {},
) => {
  Object.keys(
    masterCatalogState,
  ).forEach((catalogKey) => {
    const receivedOptions =
      Array.isArray(
        payload[catalogKey],
      )
        ? payload[catalogKey]
        : [];

    const normalizedOptions =
      receivedOptions
        .map(
          normalizeMasterCatalogValue,
        )
        .filter(Boolean);

    const uniqueOptions = Array.from(
      new Set(normalizedOptions),
    ).sort((left, right) =>
      left.localeCompare(right),
    );

    masterCatalogState[
      catalogKey
    ].options = uniqueOptions;

    masterCatalogState[
      catalogKey
    ].optionsSet = new Set(
      uniqueOptions,
    );
  });

  const receivedCountryNames =
    payload.countryNameToCode &&
    typeof payload.countryNameToCode ===
      "object" &&
    !Array.isArray(
      payload.countryNameToCode,
    )
      ? Object.entries(
          payload.countryNameToCode,
        )
      : [];

  const normalizedCountryNames =
    receivedCountryNames
      .map(([name, code]) => [
        normalizeMasterCountryName(
          name,
        ),
        normalizeMasterCatalogValue(
          code,
        ),
      ])
      .filter(
        ([name, code]) =>
          name && code,
      );

  masterCatalogState
    .countryOfOrigin
    .nameToCode = new Map(
      normalizedCountryNames,
    );
};

const loadMasterCatalogOptions =
  async () => {
    try {
      const response = await fetch(
        "/api/files/catalog-options",
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            "No fue posible cargar los catálogos.",
        );
      }

      applyMasterCatalogOptions(
        data,
      );

      return true;
    } catch (error) {
      console.warn(
        "No fue posible cargar los catálogos del editor:",
        error,
      );

      applyMasterCatalogOptions({});

      return false;
    }
  };

const canEditMasterContent = () => {
  return ["admin", "user"].includes(
    currentEditorUser?.role,
  );
};

const setEditorDirty = (hasChanges) => {
  editorHasChanges = hasChanges;

  masterEditorSaveButton.disabled =
    editorIsSaving ||
    !canEditMasterContent() ||
    !editorHasChanges;
};

const markEditorDirty = () => {
  if (!canEditMasterContent()) {
    return;
  }

  setEditorDirty(true);

  showEditorMessage(
    "Tienes cambios pendientes por guardar.",
    "warning",
  );
};

const closeEditorExitModal = () => {
  pendingEditorNavigation = "";

  masterEditorExitModal.classList.add(
    "hidden",
  );
};

const openEditorExitModal = (
  destination,
) => {
  pendingEditorNavigation =
    destination;

  masterEditorExitModal.classList.remove(
    "hidden",
  );

  masterEditorExitCancelButton.focus();
};

const confirmEditorExit = () => {
  const destination =
    pendingEditorNavigation;

  if (!destination) {
    closeEditorExitModal();
    return;
  }

  /*
   * El usuario confirmó que desea descartar
   * los cambios, por lo que desactivamos la
   * advertencia nativa antes de navegar.
   */
  setEditorDirty(false);

  pendingEditorNavigation = "";

  window.location.href =
    destination;
};

const configureEditorPermissions = () => {
  const isAdmin =
    currentEditorUser?.role === "admin";

  const contentDisabled =
    editorIsSaving ||
    !canEditMasterContent();

  masterEditorType.disabled = true;

  masterEditorName.disabled =
    editorIsSaving || !isAdmin;

  masterEditorSiteCheckboxes.forEach(
    (checkbox) => {
      checkbox.disabled =
        editorIsSaving || !isAdmin;
    },
  );

  masterEditorTableBody
    .querySelectorAll(
      "input.master-editor-cell",
    )
    .forEach((input) => {
      input.disabled =
        contentDisabled;
    });

  masterEditorTableBody
    .querySelectorAll(
      "button.master-editor-row-delete",
    )
    .forEach((button) => {
      button.disabled =
        contentDisabled;
    });

  masterEditorAddRowButton.disabled =
    contentDisabled;
};



const showEditorMessage = (message, type = "") => {
  masterEditorMessage.textContent = message;

  masterEditorMessage.classList.remove(
    "success",
    "error",
    "warning",
  );

  if (type) {
    masterEditorMessage.classList.add(type);
  }

  masterEditorMessage.style.display =
    message ? "block" : "none";
};

const getMasterFileId = () => {
  const urlParameters =
    new URLSearchParams(window.location.search);

  return String(
    urlParameters.get("edit") || "",
  ).trim();
};

const isValidObjectId = (value) =>
  /^[a-f0-9]{24}$/i.test(value);

const loadCurrentUser = async () => {
  const response = await fetch("/api/user/profile");

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok || !data.user) {
    throw new Error(
      data.message ||
        "No fue posible consultar el usuario.",
    );
  }

  return data.user;
};

const loadMasterEditorData = async (masterFileId) => {
  const response = await fetch(
    `/api/master-files/${encodeURIComponent(
      masterFileId,
    )}/editor`,
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
        "No fue posible cargar el archivo madre.",
    );
  }

  if (!data.masterFile) {
    throw new Error(
      "El servidor no devolvió la información del archivo madre.",
    );
  }

  return data;
};

const formatCellValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
};

const getOrderedHeaders = (headers) => {
  if (!Array.isArray(headers)) {
    return [];
  }

  return [...headers]
    .filter((header) => {
      const columnIndex =
        Number(header.columnIndex);

      return (
        Number.isInteger(columnIndex) &&
        columnIndex > 0
      );
    })
    .sort(
      (firstHeader, secondHeader) =>
        Number(firstHeader.columnIndex) -
        Number(secondHeader.columnIndex),
    );
};

const getMasterCatalogKey = (
  header,
) => {
  const mappedField =
    header?.mappedField || "";

  if (
    mappedField ===
    "unitOfMeasure"
  ) {
    return "unitOfMeasure";
  }

  if (
    mappedField ===
      "countryOfOrigin" ||
    mappedField ===
      "fdaCountryOfOrigin"
  ) {
    return "countryOfOrigin";
  }

  /*
   * La columna independiente "uom"
   * permanece como texto libre.
   */
  return "";
};

const renderMasterMetadata = (masterFile) => {
  masterEditorType.value =
    MASTER_TYPE_LABELS[masterFile.masterType] ||
    masterFile.masterType ||
    "";

  masterEditorName.value =
    masterFile.name || "";

  const selectedSites = Array.isArray(
    masterFile.sites,
  )
    ? masterFile.sites.map((site) =>
        String(site).trim().toLowerCase(),
      )
    : [];

  masterEditorSiteCheckboxes.forEach(
    (checkbox) => {
      checkbox.checked =
        selectedSites.includes(
          checkbox.value,
        );
    },
  );
};

const createHeaderRow = (headers) => {
  const tableRow =
    document.createElement("tr");

  headers.forEach((header) => {
    const tableHeader =
      document.createElement("th");

    tableHeader.textContent =
      header.originalName ||
      header.columnLetter ||
      `Columna ${header.columnIndex}`;

    const requiredMappedFields = [
      "partNumber",
      "description",
    ];

    if (
      requiredMappedFields.includes(
        header.mappedField,
      )
    ) {
      const asterisk =
        document.createElement("span");

      asterisk.className =
        "required-asterisk";

      asterisk.textContent = " *";

      tableHeader.appendChild(
        asterisk,
      );
    }

    tableRow.appendChild(tableHeader);
  });

  const actionsHeader =
    document.createElement("th");

  actionsHeader.textContent =
    "Acciones";

  actionsHeader.className =
    "master-editor-actions-column";

  tableRow.appendChild(
    actionsHeader,
  );

  return tableRow;
};

const getMasterCatalogUi = (
  input,
) => {
  if (
    input._masterCatalogUi
  ) {
    return input._masterCatalogUi;
  }

  const parent =
    input.parentNode;

  if (!parent) {
    return null;
  }

  const wrapper =
    document.createElement("div");

  wrapper.className =
    "catalog-autocomplete";

  const toggle =
    document.createElement("button");

  toggle.type = "button";

  toggle.className =
    "catalog-autocomplete-toggle";

  toggle.setAttribute(
    "aria-label",
    "Mostrar opciones",
  );

  toggle.innerHTML = "&#9662;";

  const menu =
    document.createElement("div");

  menu.className =
    "catalog-autocomplete-menu hidden";

  parent.insertBefore(
    wrapper,
    input,
  );

  wrapper.appendChild(input);
  wrapper.appendChild(toggle);
  wrapper.appendChild(menu);

  input.classList.add(
    "catalog-autocomplete-input",
  );

  input.autocomplete = "off";
  input.spellcheck = false;

  input._masterCatalogUi = {
    wrapper,
    toggle,
    menu,
  };

  return input._masterCatalogUi;
};

const closeMasterCatalog = (
  input,
) => {
  const ui =
    input?._masterCatalogUi;

  if (!ui) {
    return;
  }

  ui.menu.classList.add(
    "hidden",
  );

  ui.wrapper.classList.remove(
    "catalog-autocomplete-open",
  );

  delete input.dataset
    .catalogActiveIndex;

  if (
    activeMasterCatalogInput ===
    input
  ) {
    activeMasterCatalogInput =
      null;
  }
};

const closeActiveMasterCatalog = (
  exceptInput = null,
) => {
  if (
    activeMasterCatalogInput &&
    activeMasterCatalogInput !==
      exceptInput
  ) {
    closeMasterCatalog(
      activeMasterCatalogInput,
    );
  }
};

const getFilteredMasterCatalogOptions = (
  input,
) => {
  const catalogKey =
    input.dataset.catalogKey;

  const catalog =
    masterCatalogState[
      catalogKey
    ];

  if (!catalog) {
    return [];
  }

  const query =
    normalizeMasterCatalogValue(
      input.value,
    );

  if (!query) {
    return catalog.options;
  }

  const startsWith = [];
  const includes = [];

  catalog.options.forEach(
    (option) => {
      if (
        option.startsWith(query)
      ) {
        startsWith.push(option);
      } else if (
        option.includes(query)
      ) {
        includes.push(option);
      }
    },
  );

  return [
    ...startsWith,
    ...includes,
  ];
};

const updateMasterCatalogActiveOption = (
  input,
  requestedIndex,
) => {
  const ui =
    input._masterCatalogUi;

  if (!ui) {
    return;
  }

  const optionButtons =
    Array.from(
      ui.menu.querySelectorAll(
        ".catalog-autocomplete-option",
      ),
    );

  if (
    optionButtons.length === 0
  ) {
    return;
  }

  const boundedIndex =
    Math.max(
      0,
      Math.min(
        requestedIndex,
        optionButtons.length - 1,
      ),
    );

  input.dataset.catalogActiveIndex =
    String(boundedIndex);

  optionButtons.forEach(
    (button, index) => {
      button.classList.toggle(
        "is-active",
        index === boundedIndex,
      );
    },
  );
  optionButtons[
    boundedIndex
  ]?.scrollIntoView({
    block: "nearest",
  });
};

const selectMasterCatalogOption = (
  input,
  option,
) => {
  input.value =
    normalizeMasterCatalogValue(
      option,
    );
  input.classList.remove(
    "master-editor-cell-warning",
  );
  input.setCustomValidity("");
  closeMasterCatalog(input);
  markEditorDirty();
  input.dispatchEvent(
    new Event(
      "change",
      {
        bubbles: true,
      },
    ),
  );
};

const renderMasterCatalog = (
  input,
) => {
  const ui =
    input._masterCatalogUi;
  if (!ui) {
    return;
  }
  closeActiveMasterCatalog(
    input,
  );

  const options =
    getFilteredMasterCatalogOptions(
      input,
    );

  ui.menu.innerHTML = "";

  if (options.length === 0) {
    closeMasterCatalog(input);
    return;
  }

  options.forEach(
    (option, index) => {
      const optionButton = document.createElement(
          "button",
        );
      optionButton.type = "button";
      optionButton.className = "catalog-autocomplete-option";
      optionButton.textContent = option;
      optionButton.addEventListener(
        "mousedown",
        (event) => {
          event.preventDefault();
          selectMasterCatalogOption(
            input,
            option,
          );
        },
      );

      if (index === 0) {
        optionButton.classList.add(
          "is-active",
        );
      }
      ui.menu.appendChild(
        optionButton,
      );
    },
  );

  ui.menu.style.maxHeight =
    `${
      MASTER_CATALOG_MAX_OPTIONS *
      36
    }px`;
  ui.menu.classList.remove(
    "hidden",
  );
  ui.wrapper.classList.add(
    "catalog-autocomplete-open",
  );
  activeMasterCatalogInput =
    input;
  updateMasterCatalogActiveOption(
    input,
    0,
  );
};

const validateMasterCatalogInput = (
  input,
) => {
  const catalogKey =
    input.dataset.catalogKey;
  const catalog =
    masterCatalogState[
      catalogKey
    ];
  if (!catalog) {
    return true;
  }

  const originalValue =
    String(input.value || "");
  const trimmedValue =
    originalValue.trim();
  if (!trimmedValue) {
    input.value = "";
    input.classList.remove(
      "master-editor-cell-warning",
    );
    input.setCustomValidity("");
    return true;
  }
  if (
    catalog.optionsSet.size === 0
  ) {
    input.classList.remove(
      "master-editor-cell-warning",
    );

    input.setCustomValidity("");

    return true;
  }

  if (
    catalogKey ===
    "countryOfOrigin"
  ) {
    const possibleCode =
      normalizeMasterCatalogValue(
        trimmedValue,
      );

    const aliasCode =
      MASTER_COUNTRY_CODE_ALIASES.get(
        possibleCode,
    );

    const codeByName =
      catalog.nameToCode.get(
        normalizeMasterCountryName(
          trimmedValue,
        ),
      );

    const resolvedCode =
      catalog.optionsSet.has(
        possibleCode,
      )
        ? possibleCode
        : aliasCode &&
            catalog.optionsSet.has(
              aliasCode,
            )
          ? aliasCode
          : codeByName;

    if (resolvedCode) {
      input.value =
        resolvedCode;

      input.classList.remove(
        "master-editor-cell-warning",
      );

      input.setCustomValidity("");

      return true;
    }

    /*
     * No modificamos el texto desconocido.
     * El usuario podrá corregirlo manualmente.
     */
    input.value =
      originalValue;

    input.classList.add(
      "master-editor-cell-warning",
    );

    input.setCustomValidity(
      "Selecciona un Country of Origin válido.",
    );

    return false;
  }

  const normalizedValue =
    normalizeMasterCatalogValue(
      trimmedValue,
    );

  input.value =
    normalizedValue;

  if (
    catalog.optionsSet.size > 0 &&
    !catalog.optionsSet.has(
      normalizedValue,
    )
  ) {
    input.setCustomValidity(
      "Selecciona un código válido de Unit of Measure.",
    );

    return false;
  }

  input.setCustomValidity("");

  return true;
};

const bindMasterCatalogInput = (
  input,
  catalogKey,
) => {
  if (
    !input ||
    !catalogKey
  ) {
    return;
  }

  input.dataset.catalogKey = catalogKey;
  const ui = getMasterCatalogUi(input);
  if (
    catalogKey ===
    "countryOfOrigin"
  ) {
    validateMasterCatalogInput(
      input,
    );
  }
  if (
    !ui ||
    input.dataset
      .masterCatalogBound ===
      "true"
  ) {
    return;
  }
  input.addEventListener(
    "input",
    (event) => {
      if (
        catalogKey !==
        "countryOfOrigin"
      ) {
        input.value =
          normalizeMasterCatalogValue(
            input.value,
          );
      }

      input.classList.remove(
        "master-editor-cell-warning",
      );

      input.setCustomValidity("");

      /*
      * El pegado múltiple produce eventos
      * sintéticos. Validamos cada país pegado.
      */
      if (
        !event.isTrusted &&
        catalogKey ===
          "countryOfOrigin"
      ) {
        validateMasterCatalogInput(
          input,
        );

        return;
      }

      if (event.isTrusted) {
        renderMasterCatalog(
          input,
        );
      }
    },
  );

  input.addEventListener(
    "focus",
    () => {
      renderMasterCatalog(input);
    },
  );

  input.addEventListener(
    "click",
    () => {
      renderMasterCatalog(input);
    },
  );

  input.addEventListener(
    "blur",
    () => {
      window.setTimeout(
        () => {
          closeMasterCatalog(
            input,
          );

          validateMasterCatalogInput(
            input,
          );
        },
        120,
      );
    },
  );

  input.addEventListener(
    "keydown",
    (event) => {
      if (
        ui.menu.classList.contains(
          "hidden",
        )
      ) {
        return;
      }

      const optionButtons =
        Array.from(
          ui.menu.querySelectorAll(
            ".catalog-autocomplete-option",
          ),
        );

      if (
        optionButtons.length === 0
      ) {
        return;
      }

      const currentIndex =
        Number.parseInt(
          input.dataset
            .catalogActiveIndex ||
            "0",
          10,
        );

      if (
        event.key ===
        "ArrowDown"
      ) {
        event.preventDefault();
        event.stopPropagation();

        updateMasterCatalogActiveOption(
          input,
          currentIndex + 1,
        );

        return;
      }

      if (
        event.key ===
        "ArrowUp"
      ) {
        event.preventDefault();
        event.stopPropagation();

        updateMasterCatalogActiveOption(
          input,
          currentIndex - 1,
        );

        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();

        const activeOption =
          optionButtons[
            currentIndex
          ] ||
          optionButtons[0];

        if (activeOption) {
          selectMasterCatalogOption(
            input,
            activeOption.textContent,
          );
        }

        return;
      }

      if (
        event.key === "Escape"
      ) {
        event.preventDefault();
        event.stopPropagation();

        closeMasterCatalog(input);
      }
    },
    true,
  );

  ui.toggle.addEventListener(
    "mousedown",
    (event) => {
      event.preventDefault();
    },
  );

  ui.toggle.addEventListener(
    "click",
    () => {
      const wasHidden =
        ui.menu.classList.contains(
          "hidden",
        );

      input.focus();

      if (wasHidden) {
        renderMasterCatalog(
          input,
        );
      } else {
        closeMasterCatalog(
          input,
        );
      }
    },
  );

  input.dataset.masterCatalogBound =
    "true";
};

const createRecordRow = (
  record = {},
  headers,
) => {
  const tableRow =
    document.createElement("tr");

  const recordId = String(
    record.id || "",
  );

  tableRow.dataset.recordId =
    recordId;

  tableRow.dataset.sourceRow =
    record.sourceRow
      ? String(record.sourceRow)
      : "";

  tableRow.dataset.isNew =
    recordId ? "false" : "true";

  const rawCells = Array.isArray(
    record.rawCells,
  )
    ? record.rawCells
    : [];

  const valuesByColumn =
    new Map();

  rawCells.forEach((cell) => {
    const columnIndex =
      Number(cell.columnIndex);

    if (
      Number.isInteger(columnIndex) &&
      columnIndex > 0
    ) {
      valuesByColumn.set(
        columnIndex,
        cell.value,
      );
    }
  });

  headers.forEach((header) => {
    const tableCell =
      document.createElement("td");

    const input =
      document.createElement("input");

    input.type = "text";

    input.className =
      "master-editor-cell";

    input.value = formatCellValue(
      valuesByColumn.get(
        Number(header.columnIndex),
      ),
    );

    input.disabled =
      !canEditMasterContent();

    input.dataset.columnIndex =
      String(header.columnIndex);

    input.dataset.columnLetter =
      header.columnLetter || "";

    input.dataset.header =
      header.originalName || "";

    input.dataset.mappedField =
      header.mappedField || "";

    input.addEventListener(
      "input",
      markEditorDirty,
    );

    tableCell.appendChild(input);

    const catalogKey =
      getMasterCatalogKey(
        header,
      );

    if (catalogKey) {
      bindMasterCatalogInput(
        input,
        catalogKey,
      );
    }

    tableRow.appendChild(tableCell);
  });

  const actionsCell =
    document.createElement("td");

  actionsCell.className =
    "master-editor-actions-cell";

  const deleteButton =
    document.createElement("button");

  deleteButton.type = "button";

  deleteButton.className =
    "master-editor-row-delete";

  deleteButton.title =
    "Eliminar fila";

  deleteButton.setAttribute(
    "aria-label",
    "Eliminar fila",
  );

  deleteButton.innerHTML = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="6"
        width="14"
        height="11"
        rx="2"
      />
      <path
        d="M8 9v5m4-5v5M5 6V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"
      />
    </svg>
  `;

  deleteButton.disabled =
    !canEditMasterContent();

  deleteButton.addEventListener(
    "click",
    () => {
      /*
       * Si tiene ID, la fila ya existe en
       * MongoDB y deberá eliminarse al guardar.
       */
      if (recordId) {
        deletedMasterRecordIds.add(
          recordId,
        );
      }

      /*
       * Si es una fila nueva, solamente se
       * elimina del HTML porque todavía no existe
       * en MongoDB.
       */
      tableRow.remove();

      markEditorDirty();
    },
  );

  actionsCell.appendChild(
    deleteButton,
  );

  tableRow.appendChild(
    actionsCell,
  );

  return tableRow;
};

const renderMasterTable = (
  headers,
  records,
) => {
  masterEditorTableHead.innerHTML = "";
  masterEditorTableBody.innerHTML = "";

  deletedMasterRecordIds.clear();

  orderedMasterHeaders =
    getOrderedHeaders(headers);

  const orderedHeaders =
    orderedMasterHeaders;

  if (orderedHeaders.length === 0) {
    throw new Error(
      "El archivo madre no tiene encabezados disponibles.",
    );
  }

  masterEditorTableHead.appendChild(
    createHeaderRow(orderedHeaders),
  );

  const tableFragment =
    document.createDocumentFragment();

  const activeRecords = Array.isArray(
    records,
  )
    ? records
    : [];

  activeRecords.forEach((record) => {
    tableFragment.appendChild(
      createRecordRow(
        record,
        orderedHeaders,
      ),
    );
  });

  masterEditorTableBody.appendChild(
    tableFragment,
  );

  masterEditorPlaceholder.classList.add(
    "hidden",
  );

  masterEditorTableWrapper.classList.remove(
    "hidden",
  );
};

const addMasterEditorRow = (
  {
    focusFirstCell = true,
    notifyChanges = true,
  } = {},
) => {
  if (
    !canEditMasterContent() ||
    orderedMasterHeaders.length === 0
  ) {
    return null;
  }

  const newRow =
    createRecordRow(
      {},
      orderedMasterHeaders,
    );

  masterEditorTableBody.appendChild(
    newRow,
  );

  if (notifyChanges) {
    markEditorDirty();
  }

  if (focusFirstCell) {
    window.requestAnimationFrame(
      () => {
        masterEditorTableWrapper.scrollTop =
          masterEditorTableWrapper.scrollHeight;

        const firstInput =
          newRow.querySelector(
            "input.master-editor-cell",
          );

        firstInput?.focus();
      },
    );
  }

  return newRow;
};

const getMasterRowInputs = (
  row,
) => {
  if (!row) {
    return [];
  }

  return Array.from(
    row.querySelectorAll(
      "input.master-editor-cell:not(:disabled)",
    ),
  );
};

const focusMasterCell = (
  rows,
  rowIndex,
  columnIndex,
) => {
  const targetRow =
    rows[rowIndex];

  if (!targetRow) {
    return false;
  }

  const targetInputs =
    getMasterRowInputs(targetRow);

  const targetInput =
    targetInputs[columnIndex];

  if (!targetInput) {
    return false;
  }

  targetInput.focus();

  return true;
};

const isCaretAtStart = (
  input,
) => {
  if (
    typeof input.selectionStart !==
    "number"
  ) {
    return true;
  }

  return (
    input.selectionStart === 0 &&
    input.selectionEnd === 0
  );
};

const isCaretAtEnd = (
  input,
) => {
  if (
    typeof input.selectionEnd !==
    "number"
  ) {
    return true;
  }

  const valueLength =
    input.value.length;

  return (
    input.selectionStart ===
      valueLength &&
    input.selectionEnd ===
      valueLength
  );
};

const handleMasterTableNavigation = (
  event,
) => {
  /*
   * No intervenir si otro componente, como
   * un catálogo abierto, ya procesó el evento.
   */
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey
  ) {
    return;
  }

  const currentInput =
    event.target.closest(
      "input.master-editor-cell",
    );

  if (
    !currentInput ||
    currentInput.disabled
  ) {
    return;
  }

  /*
   * En la siguiente etapa los catálogos usarán
   * esta clase cuando su menú esté abierto.
   */
  if (
    currentInput.closest(
      ".catalog-autocomplete-open",
    )
  ) {
    return;
  }

  const currentRow =
    currentInput.closest("tr");

  const rows = Array.from(
    masterEditorTableBody.querySelectorAll(
      "tr",
    ),
  );

  const rowIndex =
    rows.indexOf(currentRow);

  const rowInputs =
    getMasterRowInputs(currentRow);

  const columnIndex =
    rowInputs.indexOf(currentInput);

  if (
    rowIndex < 0 ||
    columnIndex < 0
  ) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();

    /*
     * Primero intenta avanzar dentro
     * de la misma fila.
     */
    if (
      focusMasterCell(
        rows,
        rowIndex,
        columnIndex + 1,
      )
    ) {
      return;
    }

    /*
     * Si terminó la fila, intenta la primera
     * celda de la siguiente.
     */
    if (
      focusMasterCell(
        rows,
        rowIndex + 1,
        0,
      )
    ) {
      return;
    }

    /*
     * Si está en la última celda de la última
     * fila, crea una nueva.
     */
    addMasterEditorRow();

    return;
  }

  if (event.key === "ArrowRight") {
    if (!isCaretAtEnd(currentInput)) {
      return;
    }

    const movedInsideRow =
      focusMasterCell(
        rows,
        rowIndex,
        columnIndex + 1,
      );

    const movedToNextRow =
      movedInsideRow
        ? false
        : focusMasterCell(
            rows,
            rowIndex + 1,
            0,
          );

    if (
      movedInsideRow ||
      movedToNextRow
    ) {
      event.preventDefault();
    }

    return;
  }

  if (event.key === "ArrowLeft") {
    if (!isCaretAtStart(currentInput)) {
      return;
    }

    const movedInsideRow =
      focusMasterCell(
        rows,
        rowIndex,
        columnIndex - 1,
      );

    if (movedInsideRow) {
      event.preventDefault();
      return;
    }

    const previousRow =
      rows[rowIndex - 1];

    const previousInputs =
      getMasterRowInputs(
        previousRow,
      );

    if (previousInputs.length === 0) {
      return;
    }

    const previousLastInput =
      previousInputs[
        previousInputs.length - 1
      ];

    previousLastInput.focus();
    event.preventDefault();

    return;
  }

  if (event.key === "ArrowDown") {
    if (
      focusMasterCell(
        rows,
        rowIndex + 1,
        columnIndex,
      )
    ) {
      event.preventDefault();
    }

    return;
  }

  if (event.key === "ArrowUp") {
    if (
      focusMasterCell(
        rows,
        rowIndex - 1,
        columnIndex,
      )
    ) {
      event.preventDefault();
    }
  }
};

const parseMasterClipboardGrid = (
  clipboardText,
) => {
  const normalizedText = String(
    clipboardText || "",
  )
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const rows =
    normalizedText
      .split("\n")
      .map((row) =>
        row.split("\t")
      );

  /*
   * Excel normalmente agrega un salto de línea
   * al final. Lo eliminamos sin borrar celdas
   * vacías internas.
   */
  while (
    rows.length > 0 &&
    rows[rows.length - 1].every(
      (cell) => cell === "",
    )
  ) {
    rows.pop();
  }

  return rows;
};

const ensureMasterRowsForPaste = (
  requiredRowIndex,
) => {
  let rows = Array.from(
    masterEditorTableBody.querySelectorAll(
      "tr",
    ),
  );

  while (
    rows.length <= requiredRowIndex
  ) {
    addMasterEditorRow({
      focusFirstCell: false,
      notifyChanges: false,
    });

    rows = Array.from(
      masterEditorTableBody.querySelectorAll(
        "tr",
      ),
    );
  }

  return rows;
};

const setMasterCellValue = (
  input,
  value,
) => {
  if (!input || input.disabled) {
    return;
  }

  input.value =
    value === null ||
    value === undefined
      ? ""
      : String(value);

  /*
   * Los eventos permiten que la celda active
   * el estado de cambios pendientes y, después,
   * las validaciones o catálogos.
   */
  input.dispatchEvent(
    new Event(
      "input",
      {
        bubbles: true,
      },
    ),
  );

  input.dispatchEvent(
    new Event(
      "change",
      {
        bubbles: true,
      },
    ),
  );
};

const handleMasterTablePaste = (
  event,
) => {
  const currentInput =
    event.target.closest(
      "input.master-editor-cell",
    );

  if (
    !currentInput ||
    currentInput.disabled
  ) {
    return;
  }

  const clipboardText =
    event.clipboardData?.getData(
      "text/plain",
    ) || "";

  /*
   * Si sólo es un valor sin filas ni columnas,
   * dejamos que el navegador haga el pegado
   * normal dentro del texto.
   */
  const isMultipleCellPaste =
    clipboardText.includes("\t") ||
    clipboardText.includes("\n") ||
    clipboardText.includes("\r");

  if (!isMultipleCellPaste) {
    return;
  }

  const clipboardGrid =
    parseMasterClipboardGrid(
      clipboardText,
    );

  if (clipboardGrid.length === 0) {
    return;
  }

  const currentRow =
    currentInput.closest("tr");

  const currentRows = Array.from(
    masterEditorTableBody.querySelectorAll(
      "tr",
    ),
  );

  const startRowIndex =
    currentRows.indexOf(
      currentRow,
    );

  const currentRowInputs =
    getMasterRowInputs(
      currentRow,
    );

  const startColumnIndex =
    currentRowInputs.indexOf(
      currentInput,
    );

  if (
    startRowIndex < 0 ||
    startColumnIndex < 0
  ) {
    return;
  }

  event.preventDefault();

  let lastUpdatedInput = null;

  clipboardGrid.forEach(
    (
      clipboardRow,
      rowOffset,
    ) => {
      const targetRowIndex =
        startRowIndex + rowOffset;

      const rows =
        ensureMasterRowsForPaste(
          targetRowIndex,
        );

      const targetRow =
        rows[targetRowIndex];

      const targetInputs =
        getMasterRowInputs(
          targetRow,
        );

      clipboardRow.forEach(
        (
          cellValue,
          columnOffset,
        ) => {
          const targetColumnIndex =
            startColumnIndex +
            columnOffset;

          const targetInput =
            targetInputs[
              targetColumnIndex
            ];

          /*
           * Si Excel contiene más columnas que
           * el archivo madre, se ignoran.
           */
          if (!targetInput) {
            return;
          }

          setMasterCellValue(
            targetInput,
            cellValue,
          );

          lastUpdatedInput =
            targetInput;
        },
      );
    },
  );

  /*
   * El evento input ya marca cambios, pero esta
   * llamada asegura el estado incluso si alguna
   * fila copiada sólo tenía valores vacíos.
   */
  markEditorDirty();

  if (lastUpdatedInput) {
    window.requestAnimationFrame(
      () => {
        lastUpdatedInput.focus({
          preventScroll: true,
        });

        lastUpdatedInput.scrollIntoView({
          behavior: "auto",
          block: "nearest",
          inline: "nearest",
        });
      },
    );
  }
};

const getSelectedMasterSites = () => {
  return Array.from(
    masterEditorSiteCheckboxes,
  )
    .filter(
      (checkbox) =>
        checkbox.checked,
    )
    .map(
      (checkbox) =>
        checkbox.value,
    );
};

const collectMasterEditorRows = () => {
  return Array.from(
    masterEditorTableBody.querySelectorAll(
      "tr",
    ),
  ).map((row) => {
    const cells = Array.from(
      row.querySelectorAll(
        "input.master-editor-cell",
      ),
    ).map((input) => ({
      columnIndex:
        Number(
          input.dataset.columnIndex,
        ),

      value:
        input.value,
    }));

    return {
      id:
        row.dataset.recordId || "",

      cells,
    };
  });
};

const validateMasterEditorBeforeSave = (
  rows,
) => {
  if (rows.length === 0) {
    showEditorMessage(
      "El archivo madre debe conservar al menos una fila.",
      "error",
    );

    return false;
  }

  const isAdmin =
    currentEditorUser?.role === "admin";

  if (
    isAdmin &&
    !masterEditorName.value.trim()
  ) {
    showEditorMessage(
      "El nombre para administración es obligatorio.",
      "error",
    );

    masterEditorName.focus();
    return false;
  }

  if (
    isAdmin &&
    getSelectedMasterSites().length === 0
  ) {
    showEditorMessage(
      "Debes seleccionar al menos una sede.",
      "error",
    );

    return false;
  }

  const tableRows = Array.from(
    masterEditorTableBody.querySelectorAll(
      "tr",
    ),
  );

  let firstInvalidInput = null;
  let invalidRowNumber = 0;

  tableRows.forEach(
    (row, rowIndex) => {
      const inputs = Array.from(
        row.querySelectorAll(
          "input.master-editor-cell",
        ),
      );

      inputs.forEach((input) => {
        const mappedField =
          input.dataset.mappedField || "";

        const isRequired = [
          "partNumber",
          "description",
        ].includes(mappedField);

        if (isRequired) {
          input.setCustomValidity(
            input.value.trim()
              ? ""
              : "Este campo es obligatorio.",
          );
        }

        if (input.dataset.catalogKey) {
          validateMasterCatalogInput(
            input,
          );
        }

        if (
          !firstInvalidInput &&
          !input.checkValidity()
        ) {
          firstInvalidInput =
            input;

          invalidRowNumber =
            rowIndex + 1;
        }
      });
    },
  );

  if (firstInvalidInput) {
    showEditorMessage(
      `Corrige los campos inválidos de la fila ${invalidRowNumber}.`,
      "error",
    );

    firstInvalidInput.focus();
    firstInvalidInput.reportValidity();

    return false;
  }

  return true;
};

const saveMasterEditorChanges =
  async () => {
    if (
      editorIsSaving ||
      !editorHasChanges
    ) {
      return;
    }

    const masterFileId =
      getMasterFileId();

    let rows =
      collectMasterEditorRows();

    if (
      !validateMasterEditorBeforeSave(
        rows,
      )
    ) {
      return;
    }

    /*
    * La validación puede normalizar valores,
    * por ejemplo México a MX. Volvemos a leer
    * la tabla para enviar los valores corregidos.
    */
    rows =
      collectMasterEditorRows();

    const payload = {
      revision:
        currentMasterRevision,

      name:
        masterEditorName.value.trim(),

      sites:
        getSelectedMasterSites(),

      rows,

      deletedRecordIds:
        Array.from(
          deletedMasterRecordIds,
        ),
    };

    editorIsSaving = true;

    configureEditorPermissions();
    setEditorDirty(true);

    showEditorMessage(
      "Guardando cambios...",
      "warning",
    );

    let changesWereSaved = false;

    try {
      const response = await fetch(
        `/api/master-files/${encodeURIComponent(
          masterFileId,
        )}/editor`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(payload),
        },
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        const requestError =
          new Error(
            data.message ||
              "No fue posible guardar los cambios.",
          );

        requestError.code =
          data.code || "";

        requestError.status =
          response.status;

        throw requestError;
      }

      changesWereSaved = true;

      currentMasterRevision =
        Number(
          data.masterFile?.revision,
        ) || currentMasterRevision;

      deletedMasterRecordIds.clear();
      setEditorDirty(false);

      /*
       * Volvemos a consultar el archivo para que
       * las filas nuevas reciban el ID generado
       * por MongoDB.
       */
      const refreshedData =
        await loadMasterEditorData(
          masterFileId,
        );

      currentMasterRevision =
        Number(
          refreshedData
            .masterFile
            .revision,
        );

      renderMasterMetadata(
        refreshedData.masterFile,
      );

      renderMasterTable(
        refreshedData
          .masterFile
          .headers,

        refreshedData.records,
      );

      showEditorMessage(
        `${data.message} Nuevas: ${
          data.insertedRecordCount || 0
        }. Actualizadas: ${
          data.updatedRecordCount || 0
        }. Eliminadas: ${
          data.deletedRecordCount || 0
        }.`,
        "success",
      );
    } catch (error) {
      console.error(
        "Error al guardar archivo madre:",
        error,
      );

      if (changesWereSaved) {
        showEditorMessage(
          "Los cambios se guardaron, pero no fue posible recargar la tabla. La página se actualizará automáticamente.",
          "warning",
        );

        window.setTimeout(
          () => {
            window.location.reload();
          },
          1500,
        );
      } else {
        setEditorDirty(true);

        showEditorMessage(
          error.message ||
            "No fue posible guardar los cambios.",
          "error",
        );
      }
    } finally {
      editorIsSaving = false;

      configureEditorPermissions();

      setEditorDirty(
        editorHasChanges,
      );
    }
  };

const initializeMasterEditor = async () => {
  const masterFileId =
    getMasterFileId();

  if (!isValidObjectId(masterFileId)) {
    showEditorMessage(
      "El identificador del archivo madre no es válido.",
      "error",
    );

    return;
  }

  showEditorMessage(
    "Cargando archivo madre...",
    "warning",
  );

  try {
    currentEditorUser =
      await loadCurrentUser();

    const isAdmin =
      currentEditorUser.role === "admin";

    if (isAdmin) {
      masterEditorSitesGroup.classList.remove(
        "hidden",
      );

      masterEditorScopeMessage.textContent =
        "Como administrador podrás modificar el nombre, las sedes y el contenido.";
    } else {
      masterEditorScopeMessage.textContent =
        "Podrás modificar el contenido de los archivos disponibles para tu sede.";
    }

    masterEditorPanel.classList.remove(
      "hidden",
    );

    const editorData =
      await loadMasterEditorData(
        masterFileId,
      );

    const loadedRevision =
      Number(
        editorData.masterFile.revision,
      );

    if (
      !Number.isInteger(
        loadedRevision,
      ) ||
      loadedRevision < 1
    ) {
      throw new Error(
        "El archivo madre no tiene una revisión válida.",
      );
    }

    currentMasterRevision =
      loadedRevision;

    await loadMasterCatalogOptions();

    renderMasterMetadata(
      editorData.masterFile,
    );

    renderMasterTable(
      editorData.masterFile.headers,
      editorData.records,
    );

    configureEditorPermissions();
    setEditorDirty(false);

    const loadedRecordCount =
      Number(
        editorData.loadedRecordCount,
      ) || 0;

    showEditorMessage(
      `Archivo madre cargado correctamente. Registros: ${loadedRecordCount}.`,
      "success",
    );
  } catch (error) {
    console.error(
      "Error al cargar editor de archivo madre:",
      error,
    );

    showEditorMessage(
      error.message ||
        "No fue posible cargar el editor.",
      "error",
    );
  }
};

document.addEventListener("DOMContentLoaded",() => {

    masterEditorName.addEventListener(
      "input",
      markEditorDirty,
    );

    masterEditorSiteCheckboxes.forEach(
      (checkbox) => {
        checkbox.addEventListener(
          "change",
          markEditorDirty,
        );
      },
    );

    masterEditorAddRowButton.addEventListener("click",() => {addMasterEditorRow();});

    masterEditorTableBody.addEventListener("keydown",handleMasterTableNavigation);

    masterEditorTableBody.addEventListener("paste",handleMasterTablePaste);

    masterEditorBackLink.addEventListener(
      "click",
      (event) => {
        if (!editorHasChanges) {
          return;
        }

        event.preventDefault();

        openEditorExitModal(
          masterEditorBackLink.href,
        );
      },
    );

    masterEditorSaveButton.addEventListener(
      "click",
      saveMasterEditorChanges,
    );

    masterEditorExitCancelButton.addEventListener(
      "click",
      closeEditorExitModal,
    );

    masterEditorExitConfirmButton.addEventListener(
      "click",
      confirmEditorExit,
    );

    masterEditorExitModal.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          masterEditorExitModal
        ) {
          closeEditorExitModal();
        }
      },
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape" &&
          !masterEditorExitModal.classList
            .contains("hidden")
        ) {
          closeEditorExitModal();
        }
      },
    );

    initializeMasterEditor();
  },
);

window.addEventListener(
  "beforeunload",
  (event) => {
    if (!editorHasChanges) {
      return;
    }

    event.preventDefault();

    /*
     * Los navegadores modernos muestran su propio
     * texto de confirmación por seguridad.
     */
    event.returnValue = "";
  },
);