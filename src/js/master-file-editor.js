const masterEditorMessage =
  document.getElementById("masterEditorMessage");

const masterEditorPanel =
  document.getElementById("masterEditorPanel");

const masterEditorType =
  document.getElementById("masterEditorType");

const masterEditorName =
  document.getElementById("masterEditorName");

const masterEditorSitesGroup =
  document.getElementById("masterEditorSitesGroup");

const masterEditorSiteCheckboxes =
  document.querySelectorAll(
    'input[name="masterEditorSites"]',
  );

const masterEditorScopeMessage =
  document.getElementById("masterEditorScopeMessage");

const masterEditorTableWrapper =
  document.getElementById("masterEditorTableWrapper");

const masterEditorTableHead =
  document.getElementById("masterEditorTableHead");

const masterEditorTableBody =
  document.getElementById("masterEditorTableBody");

const masterEditorPlaceholder =
  document.getElementById("masterEditorPlaceholder");

const MASTER_TYPE_LABELS = {
  finishedProduct: "Finished Goods",
  rawMaterial: "Raw Material",
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
      `Columna ${header.columnIndex}`;4
    
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

  return tableRow;
};

const createRecordRow = (record, headers) => {
  const tableRow =
    document.createElement("tr");

  const rawCells = Array.isArray(
    record.rawCells,
  )
    ? record.rawCells
    : [];

  const valuesByColumn = new Map();

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

    input.disabled = true;

    tableCell.appendChild(input);
    tableRow.appendChild(tableCell);
  });

  return tableRow;
};

const renderMasterTable = (
  headers,
  records,
) => {
  masterEditorTableHead.innerHTML = "";
  masterEditorTableBody.innerHTML = "";

  const orderedHeaders =
    getOrderedHeaders(headers);

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
    const currentUser =
      await loadCurrentUser();

    const isAdmin =
      currentUser.role === "admin";

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

    renderMasterMetadata(
      editorData.masterFile,
    );

    renderMasterTable(
      editorData.masterFile.headers,
      editorData.records,
    );

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

document.addEventListener(
  "DOMContentLoaded",
  initializeMasterEditor,
);