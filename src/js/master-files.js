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

const formatSite = (site) => {
  const siteLabels = {
    gaiim: "GAIIM",
    p1a: "P1A",
  };

  return siteLabels[site] || site;
};

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

const renderMasterFiles = () => {
  masterFilesTableBody.innerHTML = "";

  if (availableMasterFiles.length === 0) {
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

  availableMasterFiles.forEach(
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
          masterFile.updatedAt,
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

  if (extension === ".xls") {
    return {
      isValid: false,
      message:
        "La compatibilidad con archivos .xls se habilitará posteriormente mediante LibreOffice.",
    };
  }

  if (
    extension !== ".xlsx" &&
    extension !== ".xlsm"
  ) {
    return {
      isValid: false,
      message:
        "Actualmente sólo se pueden cargar archivos .xlsx o .xlsm.",
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

    masterFileInput.value = "";

    masterSiteCheckboxes.forEach(
      (checkbox) => {
        checkbox.checked = false;
      },
    );
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