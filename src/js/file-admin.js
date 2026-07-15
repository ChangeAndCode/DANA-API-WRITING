document.addEventListener("DOMContentLoaded", () => {
  const typeSelect = document.getElementById("adminFileType");
  const panel = document.getElementById("adminFilesPanel");
  const tableBody = document.querySelector("#adminFilesTable tbody");
  const deleteModal = document.getElementById("deleteModal");
  const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");
  const deleteCancelBtn = document.getElementById("deleteCancelBtn");
  const copyModal = document.getElementById("copyModal");
  const copySourceFileName = document.getElementById("copySourceFileName");
  const copyFileNameInput = document.getElementById("copyFileNameInput");
  const copyModalError = document.getElementById("copyModalError");
  const copyCancelBtn = document.getElementById("copyCancelBtn");
  const copyConfirmBtn = document.getElementById("copyConfirmBtn");
  const copyConfirmBtnDefaultText = copyConfirmBtn
    ? copyConfirmBtn.textContent
    : "Crear copia";

  // Filtros por columna
  const filterNombre = document.getElementById("filterNombre");
  const filterNomenclatura = document.getElementById("filterNomenclatura");
  const filterFecha = document.getElementById("filterFecha");
  const filterUsuario = document.getElementById("filterUsuario");

  let filesList = [];
  let allFilesList = [];

  function renderFilteredDocuments(docs) {
    tableBody.innerHTML = "";
    if (!docs.length) {
      renderEmpty("No hay informacion para este tipo.");
      return;
    }
    docs.forEach((doc) => {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.textContent = getAdminDocName(doc);
      const nomenclatureCell = document.createElement("td");
      nomenclatureCell.textContent = doc.lastDownloadedName || "-";
      const updatedCell = document.createElement("td");
      updatedCell.textContent = formatDate(doc.updatedAt || doc.createdAt);
      const userCell = document.createElement("td");
      const userId = doc.updatedBy
        ? String(doc.updatedBy)
        : doc.createdBy
          ? String(doc.createdBy)
          : "";
      const userLabel = userCache.get(userId) || userId || "N/A";
      userCell.textContent = userLabel;
      const actionsCell = document.createElement("td");
      const actionsWrap = document.createElement("div");
      actionsWrap.className = "admin-actions";
      const downloadBtn = document.createElement("button");
      downloadBtn.type = "button";
      downloadBtn.className = "admin-action-btn download-btn";
      downloadBtn.title = "Descargar";
      downloadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4v8m0 0l-4-4m4 4l4-4"/><rect x="4" y="16" width="12" height="2" rx="1"/></svg>`;
      downloadBtn.addEventListener("click", () => {
        window.location.href = `/api/files/admin-files/${doc._id}/download?type=${currentDocType}`;
      });
      const updateBtn = document.createElement("button");
      updateBtn.type = "button";
      updateBtn.className = "admin-action-btn update-btn";
      updateBtn.title = "Actualizar";
      updateBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 25" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17.25V21h3.75l11.06-11.06a1.06 1.06 0 0 0 0-1.5l-2.25-2.25a1.06 1.06 0 0 0-1.5 0L3 17.25z"/></svg>`;
      updateBtn.addEventListener("click", () => {
        window.location.href = `/file-creation?edit=${doc._id}&type=${currentDocType}`;
      });
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "admin-action-btn copy-btn";
      copyBtn.title = "Copiar";
      copyBtn.setAttribute("aria-label", `Copiar ${getAdminDocName(doc)}`);
      copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="9" height="11" rx="2"/><path d="M5 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1"/></svg>`;
      copyBtn.addEventListener("click", () => {
        openCopyModal(doc);
      });
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "admin-action-btn delete-btn";
      deleteBtn.title = "Borrar";
      deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="14" height="11" rx="2"/><path d="M8 9v5m4-5v5M5 6V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/></svg>`;
      deleteBtn.addEventListener("click", () => {
        pendingDeleteId = doc._id;
        if (deleteModal) deleteModal.classList.remove("hidden");
      });
      actionsWrap.style.display = "flex";
      actionsWrap.style.gap = "4px";
      actionsWrap.appendChild(downloadBtn);
      actionsWrap.appendChild(updateBtn);
      actionsWrap.appendChild(copyBtn);
      actionsWrap.appendChild(deleteBtn);
      actionsCell.appendChild(actionsWrap);
      row.appendChild(nameCell);
      row.appendChild(nomenclatureCell);
      row.appendChild(updatedCell);
      row.appendChild(userCell);
      row.appendChild(actionsCell);
      tableBody.appendChild(row);
    });
  }

  function applyColumnFilters() {
    let filtered = allFilesList;
    if (filterNombre && filterNombre.value.trim() !== "") {
      const val = filterNombre.value.trim().toLowerCase();
      filtered = filtered.filter((file) => {
        return (
          (file.adminFileName &&
            String(file.adminFileName).toLowerCase().includes(val)) ||
          (file.fileName && String(file.fileName).toLowerCase().includes(val))
        );
      });
    }
    if (filterNomenclatura && filterNomenclatura.value.trim() !== "") {
      const val = filterNomenclatura.value.trim().toLowerCase();
      filtered = filtered.filter((file) => {
        return (
          (file.lastDownloadedName &&
            String(file.lastDownloadedName).toLowerCase().includes(val)) ||
          (file.nomenclature &&
            String(file.nomenclature).toLowerCase().includes(val))
        );
      });
    }
    if (filterFecha && filterFecha.value.trim() !== "") {
      const val = filterFecha.value.trim().toLowerCase();
      filtered = filtered.filter((file) => {
        const created = file.createdAt
          ? formatDate(file.createdAt).toLowerCase()
          : "";
        const updated = file.updatedAt
          ? formatDate(file.updatedAt).toLowerCase()
          : "";
        return created.includes(val) || updated.includes(val);
      });
    }
    if (filterUsuario && filterUsuario.value.trim() !== "") {
      const val = filterUsuario.value.trim().toLowerCase();
      filtered = filtered.filter((file) => {
        const user = file.createdBy || file.userId || "";
        const userLabel = userCache.get(user) || user;
        return String(userLabel).toLowerCase().includes(val);
      });
    }
    renderFilteredDocuments(filtered);
  }

  [filterNombre, filterNomenclatura, filterFecha, filterUsuario].forEach(
    (input) => {
      if (input) {
        input.addEventListener("input", applyColumnFilters);
      }
    },
  );

  // Ordenar por abecedario con botón de flechas
  // 0: por fecha (desc, flechas juntas), 1: alfabético asc (flecha arriba), 2: alfabético desc (flecha abajo)
  let sortMode = 0;
  const sortNombreBtn = document.getElementById("sortNombreBtn");
  const sortNombreIcon = document.getElementById("sortNombreIcon");
  if (sortNombreBtn && sortNombreIcon) {
    sortNombreBtn.addEventListener("click", () => {
      sortMode = (sortMode + 1) % 3;
      if (sortMode === 0) {
        sortNombreIcon.src =
          "/src/icons/ordenar-flechas-par-apuntando-hacia-arriba-y-hacia-abajo.png";
      } else if (sortMode === 1) {
        sortNombreIcon.src = "/src/icons/caret-flecha-hacia-arriba.png";
      } else {
        sortNombreIcon.src = "/src/icons/caret-abajo.png";
      }
      renderSortedDocuments();
    });
  }

  function renderSortedDocuments() {
    let docs = allFilesList.slice();
    if (sortMode === 0) {
      // Por fecha descendente (más reciente arriba)
      docs.sort((a, b) => {
        const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bDate - aDate;
      });
    } else if (sortMode === 1) {
      // Alfabético ascendente
      docs.sort((a, b) => {
        const aName = (a.adminFileName || a.fileName || "").toLowerCase();
        const bName = (b.adminFileName || b.fileName || "").toLowerCase();
        return aName.localeCompare(bName);
      });
    } else {
      // Alfabético descendente
      docs.sort((a, b) => {
        const aName = (a.adminFileName || a.fileName || "").toLowerCase();
        const bName = (b.adminFileName || b.fileName || "").toLowerCase();
        return bName.localeCompare(aName);
      });
    }
    renderFilteredDocuments(docs);
  }

  // Resetear Filtros
  const resetFiltersBtn = document.getElementById("resetFiltersBtn");
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", () => {
      [filterNombre, filterNomenclatura, filterFecha, filterUsuario].forEach(
        (input) => {
          if (input) input.value = "";
        },
      );
      applyColumnFilters();
    });
  }

  if (!typeSelect || !panel || !tableBody) return;
  let currentDocType = "";
  let pendingDeleteId = "";
  let pendingCopyDoc = null;
  let usersLoaded = false;

  const userCache = new Map();

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  };

  const getFileName = (job) => {
    const customName =
      job &&
      job.conversionOptions &&
      typeof job.conversionOptions.displayName === "string"
        ? job.conversionOptions.displayName.trim()
        : "";
    if (customName) return customName;
    if (job && job.convertedFilePath) {
      const parts = String(job.convertedFilePath).split(/[/\\]/);
      return parts[parts.length - 1] || "-";
    }
    return job && job.fileName ? job.fileName : "-";
  };

  const getAdminDocName = (doc) => {
    if (doc && doc.adminFileName) return doc.adminFileName;
    return doc && doc._id ? String(doc._id) : "-";
  };

  const showCopyModalError = (message) => {
    if (!copyModalError) return;
    copyModalError.textContent = message || "No se pudo crear la copia.";
    copyModalError.classList.remove("hidden");
  };

  const clearCopyModalError = () => {
    if (!copyModalError) return;
    copyModalError.textContent = "";
    copyModalError.classList.add("hidden");
  };

  const setCopySubmitting = (isSubmitting) => {
    if (!copyConfirmBtn) return;
    copyConfirmBtn.disabled = isSubmitting;
    copyConfirmBtn.textContent = isSubmitting
      ? "Creando..."
      : copyConfirmBtnDefaultText;
  };

  const resetCopyModalState = () => {
    pendingCopyDoc = null;
    if (copyFileNameInput) copyFileNameInput.value = "";
    clearCopyModalError();
    setCopySubmitting(false);
  };

  const closeCopyModal = () => {
    resetCopyModalState();
    if (copyModal) copyModal.classList.add("hidden");
  };

  const openCopyModal = (doc) => {
    pendingCopyDoc = doc || null;
    if (copySourceFileName) {
      copySourceFileName.textContent = getAdminDocName(doc);
    }
    if (copyFileNameInput) {
      copyFileNameInput.value = "";
    }
    clearCopyModalError();
    setCopySubmitting(false);
    if (copyModal) copyModal.classList.remove("hidden");
    if (copyFileNameInput) {
      window.setTimeout(() => copyFileNameInput.focus(), 0);
    }
  };

  const submitCopy = async () => {
    if (!pendingCopyDoc || !currentDocType) return;

    const nextName = copyFileNameInput ? copyFileNameInput.value.trim() : "";
    if (!nextName) {
      showCopyModalError("Debes capturar un nombre para crear la copia.");
      if (copyFileNameInput) copyFileNameInput.focus();
      return;
    }

    clearCopyModalError();
    setCopySubmitting(true);

    try {
      const response = await fetch(
        `/api/files/admin-files/${pendingCopyDoc._id}/copy?type=${currentDocType}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: nextName }),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "No se pudo crear la copia.");
      }

      closeCopyModal();
      await loadJobsForType(currentDocType || "finishedProduct");
    } catch (error) {
      showCopyModalError(error.message || "No se pudo crear la copia.");
      if (copyFileNameInput) copyFileNameInput.focus();
    } finally {
      if (copyModal && !copyModal.classList.contains("hidden")) {
        setCopySubmitting(false);
      }
    }
  };

  const renderEmpty = (message) => {
    tableBody.innerHTML = "";
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "no-jobs";
    cell.textContent = message;
    row.appendChild(cell);
    tableBody.appendChild(row);
  };

  const renderRows = (jobs) => {
    tableBody.innerHTML = "";

    if (!jobs.length) {
      renderEmpty("No hay informacion para este tipo.");
      return;
    }

    jobs.forEach((job) => {
      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = getFileName(job);

      const updatedCell = document.createElement("td");
      updatedCell.textContent = formatDate(job.completedAt || job.createdAt);

      const userCell = document.createElement("td");
      const userLabel = userCache.get(job.userId) || job.userId || "N/A";
      userCell.textContent = userLabel;

      const actionsCell = document.createElement("td");
      const actionsWrap = document.createElement("div");
      actionsWrap.className = "admin-actions";

      const updateBtn = document.createElement("button");
      updateBtn.type = "button";
      updateBtn.textContent = "Actualizar";
      updateBtn.addEventListener("click", () => {
        console.log("Actualizar no implementado", job);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "row-remove-btn";
      deleteBtn.textContent = "Borrar";
      deleteBtn.addEventListener("click", () => {
        console.log("Borrar no implementado", job);
      });

      actionsWrap.appendChild(updateBtn);
      actionsWrap.appendChild(deleteBtn);
      actionsCell.appendChild(actionsWrap);

      row.appendChild(nameCell);
      row.appendChild(updatedCell);
      row.appendChild(userCell);
      row.appendChild(actionsCell);

      tableBody.appendChild(row);
    });
  };

  const renderDocuments = (docs, docType) => {
    allFilesList = docs;
    // Por defecto: modo 0 (fecha descendente, flechas dobles)
    sortMode = 0;
    if (sortNombreIcon)
      sortNombreIcon.src =
        "/src/icons/ordenar-flechas-par-apuntando-hacia-arriba-y-hacia-abajo.png";
    renderSortedDocuments();
  };

  const loadUsers = async () => {
    if (usersLoaded) return;
    try {
      const response = await fetch("/api/admin/users");
      if (!response.ok) {
        usersLoaded = false;
        return;
      }
      const users = await response.json();
      if (!Array.isArray(users)) {
        usersLoaded = false;
        return;
      }
      users.forEach((user) => {
        if (!user || !user.id) return;
        const label = user.displayName || user.email || user.id;
        userCache.set(user.id, label);
      });
      usersLoaded = true;
    } catch (error) {
      usersLoaded = false;
      console.warn("No se pudo cargar el catalogo de usuarios", error);
    }
  };

  const loadJobsForType = async (docType) => {
    panel.classList.remove("hidden");
    currentDocType = docType || "";
    if (!docType) {
      renderEmpty("Seleccione un tipo de archivo.");
      return;
    }

    renderEmpty("Cargando...");

    if (docType === "finishedProduct") {
      try {
        await loadUsers();
        const response = await fetch(
          "/api/files/admin-files?type=finishedProduct&limit=200",
        );
        if (!response.ok) {
          renderEmpty("Error al cargar los archivos.");
          return;
        }
        const data = await response.json();
        const docs = Array.isArray(data.documents) ? data.documents : [];
        renderDocuments(docs, docType);
      } catch (error) {
        console.error("Error loading docs:", error);
        renderEmpty("Error al cargar los archivos.");
      }
      return;
    }

    if (docType === "billOfMaterials") {
      try {
        await loadUsers();
        const response = await fetch(
          "/api/files/admin-files?type=billOfMaterials&limit=200",
        );
        if (!response.ok) {
          renderEmpty("Error al cargar los archivos.");
          return;
        }
        const data = await response.json();
        const docs = Array.isArray(data.documents) ? data.documents : [];
        renderDocuments(docs, docType);
      } catch (error) {
        console.error("Error loading docs:", error);
        renderEmpty("Error al cargar los archivos.");
      }
      return;
    }

    if (docType === "rawMaterial") {
      try {
        await loadUsers();
        const response = await fetch(
          "/api/files/admin-files?type=rawMaterial&limit=200",
        );
        if (!response.ok) {
          renderEmpty("Error al cargar los archivos.");
          return;
        }
        const data = await response.json();
        const docs = Array.isArray(data.documents) ? data.documents : [];
        renderDocuments(docs, docType);
      } catch (error) {
        console.error("Error loading docs:", error);
        renderEmpty("Error al cargar los archivos.");
      }
      return;
    }

    if (docType === "splScrap") {
      try {
        await loadUsers();
        const response = await fetch(
          "/api/files/admin-files?type=splScrap&limit=200",
        );
        if (!response.ok) {
          renderEmpty("Error al cargar los archivos.");
          return;
        }
        const data = await response.json();
        const docs = Array.isArray(data.documents) ? data.documents : [];
        renderDocuments(docs, docType);
      } catch (error) {
        console.error("Error loading docs:", error);
        renderEmpty("Error al cargar los archivos.");
      }
      return;
    }

    renderEmpty("Este tipo aun no esta habilitado.");
  };

  panel.classList.remove("hidden");
  renderEmpty("Seleccione un tipo de archivo.");
  loadUsers();

  typeSelect.addEventListener("change", (e) => {
    loadJobsForType(e.target.value);
  });

  const urlParams = new URLSearchParams(window.location.search);
  const preselectedType = urlParams.get("type");
  if (
    preselectedType &&
    typeSelect.querySelector(`option[value="${preselectedType}"]`)
  ) {
    typeSelect.value = preselectedType;
  }

  if (typeSelect.value) {
    loadJobsForType(typeSelect.value);
  }

  if (deleteCancelBtn) {
    deleteCancelBtn.addEventListener("click", () => {
      pendingDeleteId = "";
      if (deleteModal) deleteModal.classList.add("hidden");
    });
  }

  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener("click", () => {
      if (!pendingDeleteId) return;
      deleteConfirmBtn.disabled = true;
      fetch(
        `/api/files/admin-files/${pendingDeleteId}?type=${currentDocType}`,
        {
          method: "DELETE",
        },
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error("No se pudo borrar el archivo.");
          }
          return response.json();
        })
        .then(() => {
          if (deleteModal) deleteModal.classList.add("hidden");
          pendingDeleteId = "";
          loadJobsForType(currentDocType || "finishedProduct");
        })
        .catch((error) => {
          console.error("Error deleting doc:", error);
        })
        .finally(() => {
          deleteConfirmBtn.disabled = false;
        });
    });
  }

  if (deleteModal) {
    deleteModal.addEventListener("click", (e) => {
      if (e.target === deleteModal) {
        pendingDeleteId = "";
        deleteModal.classList.add("hidden");
      }
    });
  }

  if (copyCancelBtn) {
    copyCancelBtn.addEventListener("click", () => {
      closeCopyModal();
    });
  }

  if (copyFileNameInput) {
    copyFileNameInput.addEventListener("input", () => {
      clearCopyModalError();
    });
    copyFileNameInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      submitCopy();
    });
  }

  if (copyConfirmBtn) {
    copyConfirmBtn.addEventListener("click", () => {
      submitCopy();
    });
  }

  if (copyModal) {
    copyModal.addEventListener("click", (e) => {
      if (e.target === copyModal) {
        closeCopyModal();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (copyModal && !copyModal.classList.contains("hidden")) {
      closeCopyModal();
      return;
    }
    if (deleteModal && !deleteModal.classList.contains("hidden")) {
      pendingDeleteId = "";
      deleteModal.classList.add("hidden");
    }
  });
});
