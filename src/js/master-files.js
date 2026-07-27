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

let currentUser = null;
let uploadInProgress = false;
let availableMasterFiles = [];

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

      actionsCell.textContent = "—";

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

    const userLoaded =
      await loadCurrentUser();

    if (userLoaded) {
      await loadMasterFiles();
    }
  },
);