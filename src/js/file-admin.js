document.addEventListener("DOMContentLoaded", async () => {
  const typeSelect = document.getElementById("adminFileType");
  const panel = document.getElementById("adminFilesPanel");
  const tableBody = document.querySelector("#adminFilesTable tbody");
  const siteColumnHeader = document.getElementById("siteColumnHeader");
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
  const sftpModal = document.getElementById("sftpModal");
  const sftpSourceFileName = document.getElementById("sftpSourceFileName");
  const sftpSiteSelect = document.getElementById("sftpSiteSelect");
  const sftpSiteHelp = document.getElementById("sftpSiteHelp");
  const sftpDryRun = document.getElementById("sftpDryRun");
  const sftpModalStatusIndicator = document.getElementById("sftpModalStatusIndicator");
  const sftpModalStatusText = document.getElementById("sftpModalStatusText");
  const sftpAttempts = document.getElementById("sftpAttempts");
  const sftpLastAttempt = document.getElementById("sftpLastAttempt");
  const sftpLastUser = document.getElementById("sftpLastUser");
  const sftpLastErrorRow = document.getElementById("sftpLastErrorRow");
  const sftpLastError = document.getElementById("sftpLastError");
  const sftpModalMessage = document.getElementById("sftpModalMessage");
  const sftpCancelBtn = document.getElementById("sftpCancelBtn");
  const sftpConfirmBtn = document.getElementById("sftpConfirmBtn");

  // Filtros por columna
  const filterNombre = document.getElementById("filterNombre");
  const filterNomenclatura = document.getElementById("filterNomenclatura");
  const filterFecha = document.getElementById("filterFecha");
  const filterUsuario = document.getElementById("filterUsuario");

  let filesList = [];
  let allFilesList = [];
  let isAdminViewer = false;

  const SITE_LABELS = {
    gaiim: "GAIIM",
    p1a: "P1A",
  };

  const normalizeSite = (site) => {
    const normalized = String(site || "").trim().toLowerCase();
    return SITE_LABELS[normalized] ? normalized : "";
  };
  const SFTP_STATUS_META = {
    not_sent: {
      label: "Sin envio SFTP",
      className: "sftp-status-not-sent",
    },
    pending: {
      label: "Envio SFTP pendiente",
      className: "sftp-status-pending",
    },
    sending: {
      label: "Enviando por SFTP",
      className: "sftp-status-sending",
    },
    sent: {
      label: "Enviado por SFTP",
      className: "sftp-status-sent",
    },
    failed: {
      label: "Error en envio SFTP",
      className: "sftp-status-failed",
    },
  };

  const getSftpStatusKey = (doc) => {
    const status = String(
      doc?.sftpStatus || doc?.sftpDelivery?.status || "not_sent",
    )
      .trim()
      .toLowerCase();
    return SFTP_STATUS_META[status] ? status : "not_sent";
  };

  const getSftpStatusMeta = (doc) => {
    const status = getSftpStatusKey(doc);

    return SFTP_STATUS_META[status] || SFTP_STATUS_META.not_sent;
  };

  const getSftpDelivery = (doc) => {
    return doc?.sftpDelivery && typeof doc.sftpDelivery === "object"
      ? doc.sftpDelivery
      : {};
  };

  const getSftpLastUserLabel = (doc) => {
    const lastUser = getSftpDelivery(doc).lastAttemptBy;
    if (!lastUser) return "-";
    if (typeof lastUser === "object") {
      return lastUser.displayName || lastUser.email || lastUser._id || "-";
    }
    return userCache.get(String(lastUser)) || String(lastUser);
  };

  const getSftpStatusTitle = (doc) => {
    const delivery = getSftpDelivery(doc);
    const details = [getSftpStatusMeta(doc).label];
    const site = normalizeSite(delivery.site || doc?.site);

    if (site) details.push("Sede: " + getSiteLabel(site));
    if (Number.isFinite(Number(delivery.attempts))) {
      details.push("Intentos: " + Number(delivery.attempts));
    }
    if (delivery.lastAttemptAt) {
      details.push("Ultimo intento: " + formatDate(delivery.lastAttemptAt));
    }
    if (delivery.lastError) {
      details.push("Error: " + String(delivery.lastError));
    }

    return details.join("\n");
  };

    const getSiteLabel = (site) => {
    return SITE_LABELS[site] || "Sin sede";
  };

  const applySiteColumnVisibility = () => {
    if (!siteColumnHeader) return;
    siteColumnHeader.classList.toggle("hidden", !isAdminViewer);
  };

  const loadAdminStatus = async () => {
    try {
      const response = await fetch("/auth/check-admin");
      if (!response.ok) {
        isAdminViewer = false;
        applySiteColumnVisibility();
        return;
      }

      const data = await response.json();
      isAdminViewer = !!data.isAdmin;
      applySiteColumnVisibility();
    } catch (error) {
      isAdminViewer = false;
      applySiteColumnVisibility();
      console.warn("No se pudo verificar si el usuario es admin.", error);
    }
  };

  const loadCurrentUserProfile = async () => {
    try {
      const response = await fetch("/api/user/profile");
      if (!response.ok) {
        currentUserSite = "";
        return;
      }
      const data = await response.json();
      currentUserSite = normalizeSite(data?.user?.site);
    } catch (error) {
      currentUserSite = "";
      console.warn("No se pudo cargar la sede del usuario.", error);
    }
  };

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
      const user = doc.updatedBy || doc.createdBy;

      const userLabel =
        user?.displayName ||
        user?.email ||
        "N/A";

      userCell.textContent = userLabel;

      let siteCell = null;
      if (isAdminViewer) {
        siteCell = document.createElement("td");
        siteCell.textContent = getSiteLabel(doc.site);
      }

      const sftpStatusCell = document.createElement("td");
      sftpStatusCell.className = "sftp-status-cell";
      const sftpStatusMeta = getSftpStatusMeta(doc);
      const sftpStatusIndicator = document.createElement("span");
      sftpStatusIndicator.className =
        `sftp-status-indicator ${sftpStatusMeta.className}`;
      sftpStatusIndicator.title = getSftpStatusTitle(doc);
      sftpStatusIndicator.setAttribute("aria-label", sftpStatusMeta.label);
      sftpStatusIndicator.setAttribute("role", "img");
      sftpStatusCell.appendChild(sftpStatusIndicator);

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

      const sftpBtn = document.createElement("button");
      sftpBtn.type = "button";
      sftpBtn.className = "admin-action-btn sftp-btn";
      sftpBtn.title = "Enviar por SFTP";
      sftpBtn.setAttribute(
        "aria-label",
        `Enviar ${getAdminDocName(doc)} por SFTP`,
      );
      sftpBtn.dataset.documentId = doc._id;
      sftpBtn.dataset.documentType = currentDocType;
      sftpBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="3" width="15" height="5" rx="1.5"/><rect x="2.5" y="12" width="15" height="5" rx="1.5"/><circle cx="5.5" cy="5.5" r="0.7" fill="currentColor" stroke="none"/><circle cx="5.5" cy="14.5" r="0.7" fill="currentColor" stroke="none"/><path d="M10 14V7.5m0 0L7.8 9.7M10 7.5l2.2 2.2"/></svg>`;

      sftpBtn.addEventListener("click", () => {
        openSftpModal(doc);
      });
      actionsWrap.style.gap = "4px";
      actionsWrap.appendChild(downloadBtn);
      actionsWrap.appendChild(updateBtn);
      actionsWrap.appendChild(copyBtn);
      actionsWrap.appendChild(deleteBtn);
      actionsWrap.appendChild(sftpBtn);
      actionsCell.appendChild(actionsWrap);
      row.appendChild(nameCell);
      row.appendChild(nomenclatureCell);
      row.appendChild(updatedCell);
      row.appendChild(userCell);
      if (siteCell) row.appendChild(siteCell);
      row.appendChild(sftpStatusCell);
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
  let pendingSftpDoc = null;
  let currentUserSite = "";
  let isSftpSubmitting = false;

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

  const clearSftpModalMessage = () => {
    if (!sftpModalMessage) return;
    sftpModalMessage.textContent = "";
    sftpModalMessage.classList.add("hidden");
    sftpModalMessage.classList.remove("is-error", "is-success");
  };

  const showSftpModalMessage = (message, type = "error") => {
    if (!sftpModalMessage) return;
    sftpModalMessage.textContent = message;
    sftpModalMessage.classList.remove("hidden", "is-error", "is-success");
    sftpModalMessage.classList.add(
      type === "success" ? "is-success" : "is-error",
    );
  };

  const getSftpActionLabel = () => {
    const status = getSftpStatusKey(pendingSftpDoc);
    const isDryRun = !!sftpDryRun?.checked;

    if (status === "pending" || status === "sending") {
      return "Envio en curso";
    }
    if (status === "failed") {
      return isDryRun ? "Probar reintento" : "Reintentar";
    }
    if (status === "sent") {
      return isDryRun ? "Probar reenvio" : "Enviar nuevamente";
    }
    return isDryRun ? "Probar envio" : "Enviar";
  };

  const updateSftpControls = () => {
    const status = getSftpStatusKey(pendingSftpDoc);
    const isInProgress = status === "pending" || status === "sending";
    const hasSite = !!normalizeSite(sftpSiteSelect?.value);

    if (sftpSiteSelect) {
      sftpSiteSelect.disabled = isSftpSubmitting || !isAdminViewer;
    }
    if (sftpDryRun) {
      sftpDryRun.disabled = isSftpSubmitting || isInProgress;
    }
    if (sftpCancelBtn) {
      sftpCancelBtn.disabled = isSftpSubmitting;
    }
    if (sftpConfirmBtn) {
      sftpConfirmBtn.disabled =
        isSftpSubmitting || isInProgress || !hasSite;
      sftpConfirmBtn.textContent = isSftpSubmitting
        ? "Procesando..."
        : getSftpActionLabel();
    }
  };

  const renderSftpModalDetails = (doc) => {
    const delivery = getSftpDelivery(doc);
    const statusMeta = getSftpStatusMeta(doc);

    if (sftpModalStatusIndicator) {
      sftpModalStatusIndicator.className = [
        "sftp-status-indicator",
        statusMeta.className,
      ].join(" ");
    }
    if (sftpModalStatusText) {
      sftpModalStatusText.textContent = statusMeta.label;
    }
    if (sftpAttempts) {
      const attempts = Number(delivery.attempts);
      sftpAttempts.textContent = Number.isFinite(attempts) ? attempts : 0;
    }
    if (sftpLastAttempt) {
      sftpLastAttempt.textContent = delivery.lastAttemptAt
        ? formatDate(delivery.lastAttemptAt)
        : "-";
    }
    if (sftpLastUser) {
      sftpLastUser.textContent = getSftpLastUserLabel(doc);
    }

    const lastError = delivery.lastError || delivery.error || "";
    if (sftpLastError) {
      sftpLastError.textContent = lastError || "-";
    }
    if (sftpLastErrorRow) {
      sftpLastErrorRow.classList.toggle("hidden", !lastError);
    }
  };

  const closeSftpModal = () => {
    if (isSftpSubmitting) return;
    pendingSftpDoc = null;
    clearSftpModalMessage();
    if (sftpModal) sftpModal.classList.add("hidden");
  };

  const openSftpModal = (doc) => {
    pendingSftpDoc = doc || null;
    clearSftpModalMessage();

    if (sftpSourceFileName) {
      sftpSourceFileName.textContent = getAdminDocName(doc);
    }

    const delivery = getSftpDelivery(doc);
    const selectedSite = normalizeSite(
      delivery.site || doc?.site || currentUserSite,
    );
    if (sftpSiteSelect) {
      sftpSiteSelect.value = selectedSite;
    }
    if (sftpDryRun) {
      sftpDryRun.checked = true;
    }
    if (sftpSiteHelp) {
      sftpSiteHelp.textContent = isAdminViewer
        ? "Selecciona la configuracion SFTP de la sede destino."
        : selectedSite
          ? "La sede corresponde a tu archivo y no puede modificarse."
          : "No tienes una sede asignada para realizar el envio.";
    }

    renderSftpModalDetails(doc);
    updateSftpControls();
    if (sftpModal) sftpModal.classList.remove("hidden");

    window.setTimeout(() => {
      if (isAdminViewer && sftpSiteSelect) {
        sftpSiteSelect.focus();
      } else if (sftpDryRun) {
        sftpDryRun.focus();
      }
    }, 0);
  };

  const applySftpResponseToDocument = (data) => {
    if (!pendingSftpDoc || !data || typeof data !== "object") return;

    const responseDoc = data.document || data.adminFile;
    if (responseDoc && typeof responseDoc === "object") {
      Object.assign(pendingSftpDoc, responseDoc);
    }

    const responseDelivery =
      data.sftpDelivery || data.delivery || responseDoc?.sftpDelivery;
    if (responseDelivery && typeof responseDelivery === "object") {
      pendingSftpDoc.sftpDelivery = responseDelivery;
    }
    if (data.sftpStatus) {
      pendingSftpDoc.sftpStatus = data.sftpStatus;
    }

    const documentIndex = allFilesList.findIndex(
      (doc) => String(doc._id) === String(pendingSftpDoc._id),
    );
    if (documentIndex >= 0) {
      allFilesList[documentIndex] = pendingSftpDoc;
    }

    renderSortedDocuments();
    renderSftpModalDetails(pendingSftpDoc);
  };

  const submitSftp = async () => {
    if (!pendingSftpDoc || !currentDocType || isSftpSubmitting) return;

    const site = normalizeSite(sftpSiteSelect?.value);
    if (!site) {
      showSftpModalMessage("Selecciona una sede de destino.");
      if (isAdminViewer && sftpSiteSelect) sftpSiteSelect.focus();
      return;
    }

    clearSftpModalMessage();
    isSftpSubmitting = true;
    updateSftpControls();

    try {
      const response = await fetch(
        "/api/files/admin-files/" +
          encodeURIComponent(pendingSftpDoc._id) +
          "/sftp?type=" +
          encodeURIComponent(currentDocType),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            site,
            dryRun: !!sftpDryRun?.checked,
          }),
        },
      );

      const data = await response.json().catch(() => ({}));
      applySftpResponseToDocument(data);

      if (!response.ok) {
        throw new Error(data.message || "No se pudo procesar el envio SFTP.");
      }

      showSftpModalMessage(
        data.message ||
          (sftpDryRun?.checked
            ? "Simulacion SFTP completada correctamente."
            : "Archivo enviado por SFTP correctamente."),
        "success",
      );
    } catch (error) {
      showSftpModalMessage(
        error.message || "No se pudo procesar el envio SFTP.",
      );
    } finally {
      isSftpSubmitting = false;
      updateSftpControls();
    }
  };

  const renderEmpty = (message) => {
    tableBody.innerHTML = "";
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = isAdminViewer ? 7 : 6;
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

  await Promise.all([loadAdminStatus(), loadCurrentUserProfile()]);
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

  if (sftpCancelBtn) {
    sftpCancelBtn.addEventListener("click", closeSftpModal);
  }

  if (sftpSiteSelect) {
    sftpSiteSelect.addEventListener("change", () => {
      clearSftpModalMessage();
      updateSftpControls();
    });
  }

  if (sftpDryRun) {
    sftpDryRun.addEventListener("change", () => {
      clearSftpModalMessage();
      updateSftpControls();
    });
  }

  if (sftpConfirmBtn) {
    sftpConfirmBtn.addEventListener("click", submitSftp);
  }

  if (sftpModal) {
    sftpModal.addEventListener("click", (event) => {
      if (event.target === sftpModal) closeSftpModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (sftpModal && !sftpModal.classList.contains("hidden")) {
      closeSftpModal();
      return;
    }
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
