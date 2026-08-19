const adminUploadSection = document.getElementById(
  "adminUploadSection",
);
const scopeMessage = document.getElementById(
  "scopeMessage",
);
const masterSiteColumnHeader = document.getElementById(
  "masterSiteColumnHeader",
);
const masterSiteFilterContainer = document.getElementById(
  "masterSiteFilterContainer",
);
const openMasterUploadModalButton = document.getElementById(
  "openMasterUploadModalButton",
);
const masterUploadModal = document.getElementById(
  "masterUploadModal",
);
const masterUploadCancelButton = document.getElementById(
  "masterUploadCancelButton",
);
const masterFileInput = document.getElementById(
  "masterFileInput",
);
const uploadMasterFileButton = document.getElementById(
  "uploadMasterFileButton",
);
const masterFilesMessage = document.getElementById(
  "masterFilesMessage",
);
const masterSiteCheckboxes = document.querySelectorAll(
  'input[name="masterFileSites"]',
);
const masterFilesEmptyState = document.getElementById(
    "masterFilesEmptyState",
  );
const masterFilesTableWrapper = document.getElementById(
    "masterFilesTableWrapper",
  );
const masterFilesTableBody = document.getElementById(
    "masterFilesTableBody",
  );
const masterFilterName = document.getElementById(
  "masterFilterName",
);
const masterFilterDate = document.getElementById(
  "masterFilterDate",
);
const masterFilterUser = document.getElementById(
  "masterFilterUser",
);
const masterFilterSite = document.getElementById(
  "masterFilterSite",
);
const masterResetFiltersButton = document.getElementById(
  "masterResetFiltersButton",
);
const masterSortNameButton = document.getElementById(
  "masterSortNameButton",
);
const masterSortNameIcon = document.getElementById(
  "masterSortNameIcon",
);
const masterDeleteModal = document.getElementById(
    "masterDeleteModal",
  );
const masterDeleteFileName = document.getElementById(
    "masterDeleteFileName",
  );
const masterDeleteCancelButton = document.getElementById(
    "masterDeleteCancelButton",
  );
const masterDeleteConfirmButton = document.getElementById(
    "masterDeleteConfirmButton",
  );
const masterCopyModal = document.getElementById(
    "masterCopyModal",
  );
const masterCopySourceFileName = document.getElementById(
    "masterCopySourceFileName",
  );
const masterCopyFileNameInput = document.getElementById(
    "masterCopyFileNameInput",
  );
const masterCopySiteCheckboxes = document.querySelectorAll(
  'input[name="masterCopySites"]',
);
const masterCopyModalError = document.getElementById(
    "masterCopyModalError",
  );
const masterCopyCancelButton = document.getElementById(
    "masterCopyCancelButton",
  );
const masterCopyConfirmButton = document.getElementById(
    "masterCopyConfirmButton",
  );

let currentUser = null;
let uploadInProgress = false;
let availableMasterFiles = [];
let masterSortMode = 0;
let pendingMasterFileDelete = null;
let pendingMasterFileCopy = null;

const MASTER_DOWNLOAD_ICON = `
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
    <path d="M10 4v8" />
    <path d="M10 12l-4-4" />
    <path d="M10 12l4-4" />
    <rect
      x="4"
      y="16"
      width="12"
      height="2"
      rx="1"
    />
  </svg>
`;

const MASTER_EDIT_ICON = `
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
    <path
      d="M3 14.5V17h2.5L16 6.5a1.5 1.5 0 0 0 0-2.1l-.4-.4a1.5 1.5 0 0 0-2.1 0L3 14.5z"
    />
    <path d="M12.5 5l2.5 2.5" />
  </svg>
`;

const MASTER_COPY_ICON = `
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
      x="7"
      y="3"
      width="9"
      height="11"
      rx="2"
    />
    <path
      d="M5 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1"
    />
  </svg>
`;

const MASTER_DELETE_ICON = `
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

const showMessage = (
  message,
  type = "",
) => {
  masterFilesMessage.textContent = message;

  masterFilesMessage.classList.remove(
    "success",
    "error",
  );

  masterFilesMessage.style.display =
    message ? "block" : "none";

  if (type) {
    masterFilesMessage.classList.add(type);
  }
};

const formatMasterType = (masterType) => {
  const typeLabels = {
    finishedProduct: "Finished Goods",
    rawMaterial: "Raw Material",
    billOfMaterials: "Bill of Materials",
  };

  return (
    typeLabels[masterType] ||
    masterType ||
    "Sin tipo"
  );
};

const formatDate = (value) => {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat(
    "es-MX",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
  ).format(date);
};

const closeMasterDeleteModal = () => {
    pendingMasterFileDelete = null;

    masterDeleteModal.classList.add(
      "hidden",
    );

    masterDeleteFileName.textContent =
      "seleccionado";

    masterDeleteConfirmButton.disabled =
      false;

    masterDeleteConfirmButton.textContent =
      "Eliminar";
  };

const openMasterDeleteModal = (
  masterFile,
) => {
  pendingMasterFileDelete =
    masterFile;

  masterDeleteFileName.textContent =
    masterFile.name ||
    masterFile.originalFileName ||
    "seleccionado";

  masterDeleteModal.classList.remove(
    "hidden",
  );

  masterDeleteConfirmButton.focus();
};

const clearMasterCopyModalError =
  () => {
    masterCopyModalError.textContent =
      "";

    masterCopyModalError.classList.add(
      "hidden",
    );
  };

const showMasterCopyModalError = (
  message,
) => {
  masterCopyModalError.textContent =
    message;

  masterCopyModalError.classList.remove(
    "hidden",
  );
};

const closeMasterCopyModal = () => {
  pendingMasterFileCopy = null;
  masterCopyModal.classList.add(
    "hidden",
  );
  masterCopySourceFileName.textContent =
    "este archivo";
  masterCopyFileNameInput.value = "";
  masterCopySiteCheckboxes.forEach(
    (checkbox) => {
      checkbox.checked = false;
    },
  );
  masterCopyConfirmButton.disabled =
    false;
  masterCopyConfirmButton.textContent =
    "Crear copia";
  clearMasterCopyModalError();
};

const openMasterCopyModal = (
  masterFile,
) => {
  pendingMasterFileCopy =
    masterFile;

  const sourceName =
    masterFile.name ||
    masterFile.originalFileName ||
    "archivo madre";

  masterCopySourceFileName.textContent =
    sourceName;

  const sourceNameWithoutExtension =
    sourceName.replace(
      /\.(xlsx|xlsm)$/i,
      "",
    );

  masterCopyFileNameInput.value =
    `Copia de ${sourceNameWithoutExtension}`;

  const sourceSites = Array.isArray(
    masterFile.sites,
  )
    ? masterFile.sites.map((site) =>
        String(site).toLowerCase(),
      )
    : [];

  masterCopySiteCheckboxes.forEach(
    (checkbox) => {
      checkbox.checked =
        sourceSites.includes(
          checkbox.value,
        );
    },
  );

  clearMasterCopyModalError();

  masterCopyModal.classList.remove(
    "hidden",
  );

  masterCopyFileNameInput.focus();
  masterCopyFileNameInput.select();
};

const normalizeMasterFilterText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const masterFilterIncludes = (
  value,
  searchValue,
) =>
  normalizeMasterFilterText(value).includes(
    normalizeMasterFilterText(searchValue),
  );

const getMasterFileName = (masterFile) =>
  masterFile.name ||
  masterFile.originalFileName ||
  "";

const getMasterFileDate = (masterFile) =>
  masterFile.lastImportedAt ||
  masterFile.updatedAt ||
  masterFile.createdAt ||
  null;

const getMasterFileDateSearchValues = (
  masterFile,
) => {
  const value = getMasterFileDate(masterFile);
  const date = new Date(value);

  if (
    !value ||
    Number.isNaN(date.getTime())
  ) {
    return [];
  }

  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return [
    formatDate(value),
    `${day}/${month}/${year}`,
    `${String(day).padStart("2", "0")}/${String(
      month,
    ).padStart("2", "0")}/${year}`,
    `${year}-${String(month).padStart(
      2,
      "0",
    )}-${String(day).padStart(2, "0")}`,
  ];
};

const getMasterFileUserSearchValues = (
  masterFile,
) => {
  const uploadedBy =
    masterFile.uploadedBy;

  if (
    uploadedBy &&
    typeof uploadedBy === "object"
  ) {
    return [
      uploadedBy.displayName,
      uploadedBy.email,
      uploadedBy._id,
      uploadedBy.id,
    ].filter(Boolean);
  }

  return [uploadedBy].filter(Boolean);
};

const getVisibleMasterFiles = () => {
  const nameFilter =
    masterFilterName?.value || "";
  const dateFilter =
    masterFilterDate?.value || "";
  const userFilter =
    masterFilterUser?.value || "";
  const siteFilter =
    masterFilterSite?.value || "";

  const filteredMasterFiles =
    availableMasterFiles.filter(
      (masterFile) => {
        const matchesName =
          !nameFilter ||
          masterFilterIncludes(
            getMasterFileName(masterFile),
            nameFilter,
          );

        const matchesDate =
          !dateFilter ||
          getMasterFileDateSearchValues(
            masterFile,
          ).some((dateValue) =>
            masterFilterIncludes(
              dateValue,
              dateFilter,
            ),
          );

        const matchesUser =
          !userFilter ||
          getMasterFileUserSearchValues(
            masterFile,
          ).some((userValue) =>
            masterFilterIncludes(
              userValue,
              userFilter,
            ),
          );

        const matchesSite =
          !siteFilter ||
          (Array.isArray(masterFile.sites) &&
            masterFile.sites.some(
              (site) =>
                normalizeMasterFilterText(
                  site,
                ) ===
                normalizeMasterFilterText(
                  siteFilter,
                ),
            ));

        return (
          matchesName &&
          matchesDate &&
          matchesUser &&
          matchesSite
        );
      },
    );

  filteredMasterFiles.sort((first, second) => {
    if (masterSortMode === 0) {
      return (
        new Date(
          getMasterFileDate(second) || 0,
        ).getTime() -
        new Date(
          getMasterFileDate(first) || 0,
        ).getTime()
      );
    }

    const comparison =
      getMasterFileName(first).localeCompare(
        getMasterFileName(second),
        "es",
        {
          sensitivity: "base",
        },
      );

    return masterSortMode === 1
      ? comparison
      : -comparison;
  });

  return filteredMasterFiles;
};

const updateMasterSortIcon = () => {
  if (!masterSortNameIcon) {
    return;
  }

  if (masterSortMode === 0) {
    masterSortNameIcon.src =
      "/src/icons/ordenar-flechas-par-apuntando-hacia-arriba-y-hacia-abajo.png";
  } else if (masterSortMode === 1) {
    masterSortNameIcon.src =
      "/src/icons/caret-flecha-hacia-arriba.png";
  } else {
    masterSortNameIcon.src =
      "/src/icons/caret-abajo.png";
  }
};

const renderMasterFiles = () => {
  masterFilesTableBody.innerHTML = "";
  const displayedMasterFiles =
    getVisibleMasterFiles();

  if (displayedMasterFiles.length === 0) {
    const emptyTitle =
      masterFilesEmptyState.querySelector("h3");
    const emptyDescription =
      masterFilesEmptyState.querySelector("p");

    if (emptyTitle) {
      emptyTitle.textContent =
        availableMasterFiles.length > 0
          ? "No hay coincidencias"
          : "Aun no hay archivos madre disponibles";
    }

    if (emptyDescription) {
      emptyDescription.textContent =
        availableMasterFiles.length > 0
          ? "Ajusta o limpia los filtros para ver los archivos disponibles."
          : "Aqui apareceran los archivos madre disponibles para tu sede.";
    }
    masterFilesEmptyState.classList.remove(
      "hidden",
    );

    masterFilesTableWrapper.classList.add(
      "hidden",
    );

    return;
  }

  masterFilesEmptyState.classList.add(
    "hidden",
  );

  masterFilesTableWrapper.classList.remove(
    "hidden",
  );

  const isAdmin =
    currentUser?.role === "admin";

  displayedMasterFiles.forEach(
    (masterFile) => {
      const row =
        document.createElement("tr");

      const nameCell =
        document.createElement("td");

      const nameElement =
        document.createElement("strong");

      nameElement.textContent =
        masterFile.name ||
        masterFile.originalFileName ||
        "Sin nombre";

      const typeElement =
        document.createElement("div");

      typeElement.textContent =
        formatMasterType(
          masterFile.masterType,
        );

      typeElement.style.fontSize =
        "0.85rem";

      typeElement.style.color =
        "#667085";

      nameCell.appendChild(
        nameElement,
      );

      nameCell.appendChild(
        typeElement,
      );

      row.appendChild(nameCell);

      const dateCell =
        document.createElement("td");

      dateCell.textContent =
        formatDate(
          masterFile.lastImportedAt ||
          masterFile.updatedAt ||
          masterFile.createdAt,
        );

      row.appendChild(dateCell);

      const userCell =
        document.createElement("td");

      userCell.textContent =
        masterFile.uploadedBy
          ?.displayName ||
        masterFile.uploadedBy?.email ||
        "Sin usuario";

      row.appendChild(userCell);

      if (isAdmin) {
        const siteCell =
          document.createElement("td");

        const sites = Array.isArray(
          masterFile.sites,
        )
          ? masterFile.sites
          : [];

        siteCell.textContent =
          sites.length > 0
            ? sites
                .map(formatSite)
                .join(", ")
            : "Sin sede";

        row.appendChild(siteCell);
      }

      const actionsCell =
        document.createElement("td");

      const actionsWrapper =
        document.createElement("div");

      actionsWrapper.className =
        "admin-actions";

      const downloadButton =
        document.createElement("button");

      downloadButton.type = "button";

      downloadButton.className =
        "admin-action-btn download-btn";

      downloadButton.title =
        "Descargar archivo madre";

      downloadButton.setAttribute(
        "aria-label",
        `Descargar ${
          masterFile.name ||
          masterFile.originalFileName ||
          "archivo madre"
        }`,
      );

      downloadButton.innerHTML =
        MASTER_DOWNLOAD_ICON;

      downloadButton.addEventListener(
        "click",
        () => {
          if (!masterFile.id) {
            showMessage(
              "El archivo madre no tiene un identificador válido.",
              "error",
            );

            return;
          }

          window.location.href =
            `/api/master-files/${encodeURIComponent(
              masterFile.id,
            )}/download`;
        },
      );

      actionsWrapper.appendChild(
        downloadButton,
      );

      const editButton =
        document.createElement("button");

      editButton.type = "button";

      editButton.className =
        "admin-action-btn update-btn";

      editButton.title =
        "Editar archivo madre";

      editButton.setAttribute(
        "aria-label",
        `Editar ${
          masterFile.name ||
          masterFile.originalFileName ||
          "archivo madre"
        }`,
      );

      editButton.innerHTML =
        MASTER_EDIT_ICON;

      editButton.addEventListener(
        "click",
        () => {
          if (!masterFile.id) {
            showMessage(
              "El archivo madre no tiene un identificador válido.",
              "error",
            );

            return;
          }

          window.location.href =
            `/master-file-editor?edit=${encodeURIComponent(
              masterFile.id,
            )}`;
        },
      );

      actionsWrapper.appendChild(
        editButton,
      );

      if (isAdmin) {
        const copyButton =
          document.createElement("button");

        copyButton.type = "button";

        copyButton.className =
          "admin-action-btn copy-btn";

        copyButton.title =
          "Copiar archivo madre";

        copyButton.setAttribute(
          "aria-label",
          `Copiar ${
            masterFile.name ||
            masterFile.originalFileName ||
            "archivo madre"
          }`,
        );

        copyButton.innerHTML =
          MASTER_COPY_ICON;

        copyButton.addEventListener(
          "click",
          () => {
            openMasterCopyModal(
              masterFile,
            );
          },
        );

        actionsWrapper.appendChild(
          copyButton,
        );
        const deleteButton =
          document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className =
          "admin-action-btn delete-btn";
        deleteButton.title =
          "Eliminar archivo madre";
        deleteButton.setAttribute(
          "aria-label",
          `Eliminar ${
            masterFile.name ||
            masterFile.originalFileName ||
            "archivo madre"
          }`,
        );
        deleteButton.innerHTML =
          MASTER_DELETE_ICON;
        deleteButton.addEventListener(
          "click",
          () => {
            openMasterDeleteModal(
              masterFile,
            );
          },
        );
        actionsWrapper.appendChild(
          deleteButton,
        );
      }
      actionsCell.appendChild(
        actionsWrapper,
      );
      row.appendChild(actionsCell);
      masterFilesTableBody.appendChild(
        row,
      );
    },
  );
};

const loadMasterFiles = async ({
  showErrors = true,
} = {}) => {
  try {
    const response = await fetch(
      "/api/master-files?limit=200",
    );

    const data = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message ||
          "No fue posible consultar los archivos madre.",
      );
    }

    availableMasterFiles =
      Array.isArray(data.masterFiles)
        ? data.masterFiles
        : [];

    renderMasterFiles();

    return true;
  } catch (error) {
    console.error(
      "Error al consultar archivos madre:",
      error,
    );

    availableMasterFiles = [];

    renderMasterFiles();

    if (showErrors) {
      showMessage(
        error.message ||
          "No fue posible consultar los archivos madre.",
        "error",
      );
    }

    return false;
  }
};

const getSelectedSites = () => {
  return Array.from(masterSiteCheckboxes)
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
};

const getFileExtension = (fileName) => {
  const normalizedName = String(
    fileName || "",
  ).toLowerCase();

  const lastDotPosition =
    normalizedName.lastIndexOf(".");

  if (lastDotPosition < 0) {
    return "";
  }

  return normalizedName.slice(
    lastDotPosition,
  );
};

const validateSelectedFile = (file) => {
  if (!file) {
    return {
      isValid: false,
      message: "Selecciona un archivo madre.",
    };
  }

  const extension = getFileExtension(
    file.name,
  );

  if (
    extension !== ".xlsx" &&
    extension !== ".xlsm" &&
    extension !== ".xls"
  ) {
    return {
      isValid: false,
      message:
        "Sólo se pueden cargar archivos .xlsx, .xlsm o .xls.",
    };
  }

  return {
    isValid: true,
    message: "",
  };
};

const updateUploadButtonState = () => {
  const isAdmin =
    currentUser?.role === "admin";

  const selectedFile =
    masterFileInput.files?.[0];

  const fileValidation =
    validateSelectedFile(selectedFile);

  const selectedSites =
    getSelectedSites();

  uploadMasterFileButton.disabled =
    !isAdmin ||
    uploadInProgress ||
    !fileValidation.isValid ||
    selectedSites.length === 0;
};

const loadCurrentUser = async () => {
  try {
    const response = await fetch(
      "/api/user/profile",
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          "No fue posible consultar el usuario.",
      );
    }

    currentUser = data.user;

    const isAdmin =
      currentUser.role === "admin";

    if (isAdmin) {
      adminUploadSection.classList.remove(
        "hidden",
      );

      masterSiteColumnHeader.classList.remove(
        "hidden",
      );

      masterSiteFilterContainer.classList.remove(
        "hidden",
      );

      scopeMessage.textContent =
        "Como administrador podrás consultar archivos de todas las sedes.";
    } else {
      adminUploadSection.classList.add(
        "hidden",
      );

      masterSiteColumnHeader.classList.add(
        "hidden",
      );

      masterSiteFilterContainer.classList.add(
        "hidden",
      );

      scopeMessage.textContent =
        currentUser.site
          ? `Mostrando archivos disponibles para la sede: ${formatSite(
              currentUser.site,
            )}.`
          : "No tienes una sede asignada.";
    }

    updateUploadButtonState();
    return true;
  } catch (error) {
    console.error(
      "Error al cargar el perfil:",
      error,
    );

    window.location.href =
      "/auth/login";
      return false;
  }

};

const resetMasterUploadForm = () => {
  masterFileInput.value = "";
  masterSiteCheckboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });
  updateUploadButtonState();
};
const openMasterUploadModal = () => {
  if (currentUser?.role !== "admin") {
    return;
  }
  masterUploadModal.classList.remove("hidden");
  masterFileInput.focus();
};
const closeMasterUploadModal = ({ reset = false } = {}) => {
  if (uploadInProgress) {
    return;
  }
  masterUploadModal.classList.add("hidden");
  if (reset) {
    resetMasterUploadForm();
  }
};

const handleFileSelection = () => {
  const selectedFile =
    masterFileInput.files?.[0];

  if (!selectedFile) {
    showMessage("");
    updateUploadButtonState();
    return;
  }

  const validation =
    validateSelectedFile(selectedFile);

  if (!validation.isValid) {
    showMessage(
      validation.message,
      "error",
    );

    updateUploadButtonState();
    return;
  }

  showMessage(
    `Archivo seleccionado: ${selectedFile.name}`,
  );

  updateUploadButtonState();
};

const uploadMasterFile = async () => {
  if (currentUser?.role !== "admin") {
    showMessage(
      "Sólo los administradores pueden cargar archivos madre.",
      "error",
    );

    return;
  }

  const selectedFile =
    masterFileInput.files?.[0];

  const fileValidation =
    validateSelectedFile(selectedFile);

  if (!fileValidation.isValid) {
    showMessage(
      fileValidation.message,
      "error",
    );

    updateUploadButtonState();
    return;
  }

  const selectedSites =
    getSelectedSites();

  if (selectedSites.length === 0) {
    showMessage(
      "Selecciona al menos una sede.",
      "error",
    );

    updateUploadButtonState();
    return;
  }

  const formData = new FormData();
  formData.append(
    "file",
    selectedFile,
  );

  formData.append(
    "sites",
    JSON.stringify(selectedSites),
  );

  uploadInProgress = true;

  uploadMasterFileButton.textContent =
    "Cargando...";

  updateUploadButtonState();

  showMessage(
    "Procesando el archivo madre...",
  );

  try {
    const response = await fetch(
      "/api/master-files",
      {
        method: "POST",
        body: formData,
      },
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

    const importedFile =
      data.masterFile || {};

    const importedSites = Array.isArray(
      importedFile.sites,
    )
      ? importedFile.sites
          .map(formatSite)
          .join(", ")
      : "";

    showMessage(
      [
        "Archivo madre cargado correctamente.",
        `Registros: ${importedFile.recordCount || 0}.`,
        `Sedes: ${importedSites || "Sin sede"}.`,
        `Imágenes ignoradas: ${
          importedFile.imageCountIgnored || 0
        }.`,
        `Advertencias generales: ${
          importedFile.warningCount || 0
        }.`,
      ].join(" "),
      "success",
    );

    resetMasterUploadForm();
    masterUploadModal.classList.add("hidden");
    await loadMasterFiles({
      showErrors: false,
    });
  } catch (error) {
    console.error(
      "Error al cargar archivo madre:",
      error,
    );

    showMessage(
      error.message ||
        "Ocurrió un error durante la carga.",
      "error",
    );
  } finally {
    uploadInProgress = false;

    uploadMasterFileButton.textContent =
      "Cargar archivo";

    updateUploadButtonState();
  }
};

const confirmMasterFileCopy =
  async () => {
    if (
      !pendingMasterFileCopy ||
      currentUser?.role !== "admin" ||
      masterCopyConfirmButton.disabled
    ) {
      return;
    }

    const sourceMasterFile = {
      ...pendingMasterFileCopy,
    };

    const copyName =
      masterCopyFileNameInput.value
        .trim();

    clearMasterCopyModalError();

    if (!copyName) {
      showMasterCopyModalError(
        "Debes escribir un nombre para la copia.",
      );

      masterCopyFileNameInput.focus();
      return;
    }

    const selectedCopySites = [
      ...masterCopySiteCheckboxes,
    ]
      .filter((checkbox) =>
        checkbox.checked
      )
      .map((checkbox) =>
        checkbox.value
      );

    if (selectedCopySites.length === 0) {
      showMasterCopyModalError(
        "Debes seleccionar al menos una sede.",
      );

      return;
    }

    if (!sourceMasterFile.id) {
      showMasterCopyModalError(
        "El archivo original no tiene un identificador válido.",
      );

      return;
    }

    masterCopyConfirmButton.disabled =
      true;

    masterCopyConfirmButton.textContent =
      "Copiando...";

    try {
      const response = await fetch(
        `/api/master-files/${encodeURIComponent(
          sourceMasterFile.id,
        )}/copy`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            name: copyName,
            sites: selectedCopySites,
          }),
        },
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            "No fue posible copiar el archivo madre.",
        );
      }

      closeMasterCopyModal();

      await loadMasterFiles({
        showErrors: false,
      });

      showMessage(
        [
          data.message ||
            "Archivo madre copiado correctamente.",
          `Registros copiados: ${
            data.copiedRecordCount || 0
          }.`,
        ].join(" "),
        "success",
      );
    } catch (error) {
      console.error(
        "Error al copiar archivo madre:",
        error,
      );

      showMasterCopyModalError(
        error.message ||
          "No fue posible copiar el archivo madre.",
      );
    } finally {
      masterCopyConfirmButton.disabled =
        false;

      masterCopyConfirmButton.textContent =
        "Crear copia";
    }
  };

const confirmMasterFileDelete =
  async () => {
    if (
      !pendingMasterFileDelete ||
      currentUser?.role !== "admin"
    ) {
      return;
    }

    const masterFileToDelete = {
      ...pendingMasterFileDelete,
    };

    masterDeleteConfirmButton.disabled =
      true;

    masterDeleteConfirmButton.textContent =
      "Eliminando...";

    try {
      const response = await fetch(
        `/api/master-files/${encodeURIComponent(
          masterFileToDelete.id,
        )}`,
        {
          method: "DELETE",
        },
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            "No fue posible eliminar el archivo madre.",
        );
      }

      closeMasterDeleteModal();

      await loadMasterFiles({
        showErrors: false,
      });

      showMessage(
        [
          data.message ||
            "Archivo madre eliminado correctamente.",
          `Registros eliminados: ${
            data.deletedMasterFile
              ?.deletedRecordCount || 0
          }.`,
        ].join(" "),
        "success",
      );
    } catch (error) {
      console.error(
        "Error al eliminar archivo madre:",
        error,
      );

      closeMasterDeleteModal();

      showMessage(
        error.message ||
          "No fue posible eliminar el archivo madre.",
        "error",
      );
    }
  };

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    [
      masterFilterName,
      masterFilterDate,
      masterFilterUser,
    ].forEach((filterInput) => {
      filterInput?.addEventListener(
        "input",
        renderMasterFiles,
      );
    });

    masterFilterSite?.addEventListener(
      "change",
      renderMasterFiles,
    );

    masterResetFiltersButton?.addEventListener(
      "click",
      () => {
        [
          masterFilterName,
          masterFilterDate,
          masterFilterUser,
        ].forEach((filterInput) => {
          if (filterInput) {
            filterInput.value = "";
          }
        });

        if (masterFilterSite) {
          masterFilterSite.value = "";
        }

        renderMasterFiles();
      },
    );

    masterSortNameButton?.addEventListener(
      "click",
      () => {
        masterSortMode =
          (masterSortMode + 1) % 3;
        updateMasterSortIcon();
        renderMasterFiles();
      },
    );

    updateMasterSortIcon();

    openMasterUploadModalButton.addEventListener(
      "click",
      openMasterUploadModal,
    );
    masterUploadCancelButton.addEventListener(
      "click",
      () => closeMasterUploadModal({ reset: true }),
    );
    masterUploadModal.addEventListener(
      "click",
      (event) => {
        if (event.target === masterUploadModal) {
          closeMasterUploadModal({ reset: true });
        }
      },
    );
    masterFileInput.addEventListener(
      "change",
      handleFileSelection,
    );
    masterSiteCheckboxes.forEach(
      (checkbox) => {
        checkbox.addEventListener(
          "change",
          updateUploadButtonState,
        );
      },
    );
    uploadMasterFileButton.addEventListener(
      "click",
      uploadMasterFile,
    );
    masterCopyCancelButton.addEventListener(
      "click",
      closeMasterCopyModal,
    );
    masterCopyConfirmButton.addEventListener(
      "click",
      confirmMasterFileCopy,
    );
    masterCopyFileNameInput.addEventListener(
      "input",
      clearMasterCopyModalError,
    );

    masterCopySiteCheckboxes.forEach(
      (checkbox) => {
        checkbox.addEventListener(
          "change",
          clearMasterCopyModalError,
        );
      },
    );
    masterCopyFileNameInput.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        confirmMasterFileCopy();
      },
    );
    masterCopyModal.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          masterCopyModal
        ) {
          closeMasterCopyModal();
        }
      },
    );
    masterDeleteCancelButton.addEventListener(
      "click",
      closeMasterDeleteModal,
    );
    masterDeleteConfirmButton.addEventListener(
      "click",
      confirmMasterFileDelete,
    );
    masterDeleteModal.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          masterDeleteModal
        ) {
          closeMasterDeleteModal();
        }
      },
    );
    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape" &&
          !masterUploadModal.classList.contains("hidden")
        ) {
          closeMasterUploadModal({ reset: true });
        }
        if (
          event.key === "Escape" &&
          !masterDeleteModal.classList
            .contains("hidden")
        ) {
          closeMasterDeleteModal();
        }
        if (
          event.key === "Escape" &&
          !masterCopyModal.classList
            .contains("hidden")
        ) {
          closeMasterCopyModal();
        }
      },
    );

    const userLoaded =
      await loadCurrentUser();
    if (userLoaded) {
      await loadMasterFiles();
    }
  },
);
import { formatSite } from "./site-config.js";
