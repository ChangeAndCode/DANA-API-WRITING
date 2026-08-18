document.addEventListener("DOMContentLoaded", async () => {
  const typeSelect = document.getElementById("adminFileType");
  const panel = document.getElementById("adminFilesPanel");
  const tableBody = document.querySelector("#adminFilesTable tbody");
  const siteColumnHeader = document.getElementById("siteColumnHeader");
  const catalogAdminButton = document.getElementById("catalogAdminButton");
  const deleteModal = document.getElementById("deleteModal");
  const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");
  const deleteModalMessage = document.getElementById("deleteModalMessage");
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
  const mfModal = document.getElementById("mfModal");
  const mfSourceFileName = document.getElementById("mfSourceFileName");
  const mfModalStatusIcon = document.getElementById("mfModalStatusIcon");
  const mfModalStatusText = document.getElementById("mfModalStatusText");
  const mfAttempts = document.getElementById("mfAttempts");
  const mfLastAttempt = document.getElementById("mfLastAttempt");
  const mfLastUser = document.getElementById("mfLastUser");
  const mfAppliedAt = document.getElementById("mfAppliedAt");
  const mfAdded = document.getElementById("mfAdded");
  const mfUpdated = document.getElementById("mfUpdated");
  const mfUnchanged = document.getElementById("mfUnchanged");
  const mfLastErrorRow = document.getElementById("mfLastErrorRow");
  const mfLastError = document.getElementById("mfLastError");
  const mfAuditSelectorGroup = document.getElementById("mfAuditSelectorGroup");
  const mfAuditSelect = document.getElementById("mfAuditSelect");
  const mfAuditDetails = document.getElementById("mfAuditDetails");
  const mfAuditMeta = document.getElementById("mfAuditMeta");
  const mfChangeTableBody = document.getElementById("mfChangeTableBody");
  const mfModalMessage = document.getElementById("mfModalMessage");
  const mfCancelBtn = document.getElementById("mfCancelBtn");
  const mfRetryBtn = document.getElementById("mfRetryBtn");

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

  const MF_STATUS_META = {
    not_applicable: {
      label: "No aplica para Packing List",
      className: "mf-status-not-applicable",
    },
    pending: {
      label: "Actualizacion pendiente",
      className: "mf-status-pending",
    },
    applying: {
      label: "Actualizando archivo madre",
      className: "mf-status-applying",
    },
    applied: {
      label: "Archivo madre actualizado",
      className: "mf-status-applied",
    },
    failed: {
      label: "Error al actualizar archivo madre",
      className: "mf-status-failed",
    },
  };

  const MF_STATUS_ICONS = {
    not_applicable: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M7 12h10"/></svg>`,
    pending: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>`,
    applying: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 0 0-14-5l-2 2"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 5l2-2"/><path d="M20 20v-4h-4"/></svg>`,
    applied: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="10" cy="6" rx="6" ry="3"/><path d="M4 6v8c0 1.7 2.7 3 6 3"/><path d="M4 10c0 1.7 2.7 3 6 3"/><path d="m14 17 2 2 4-5"/></svg>`,
    failed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 3 20h18L12 4Z"/><path d="M12 9v5"/><path d="M12 17h.01"/></svg>`,
  };

  const getMasterFileSync = (doc) =>
    doc?.masterFileSync && typeof doc.masterFileSync === "object"
      ? doc.masterFileSync
      : {};

  const getMfStatusKey = (doc) => {
    const fallback = currentDocType === "splScrap"
      ? "not_applicable"
      : "pending";
    const status = String(getMasterFileSync(doc).status || fallback)
      .trim()
      .toLowerCase();
    return MF_STATUS_META[status] ? status : fallback;
  };

  const getMfStatusMeta = (doc) =>
    MF_STATUS_META[getMfStatusKey(doc)] || MF_STATUS_META.pending;

  const getMfLastUserLabel = (doc) => {
    const lastUser = getMasterFileSync(doc).lastAttemptBy;
    if (!lastUser) return "-";
    if (typeof lastUser === "object") {
      return lastUser.displayName || lastUser.email || lastUser._id || "-";
    }
    return userCache.get(String(lastUser)) || String(lastUser);
  };

  const getMfStatusTitle = (doc) => {
    const sync = getMasterFileSync(doc);
    const summary = sync.summary || {};
    const details = [getMfStatusMeta(doc).label];
    if (sync.masterFileName) details.push("Master File: " + sync.masterFileName);
    if (sync.lastAttemptAt) {
      details.push("Ultimo intento: " + formatDate(sync.lastAttemptAt));
    }
    if (getMfStatusKey(doc) === "applied") {
      details.push(
        `Agregados: ${Number(summary.added) || 0}; actualizados: ${Number(summary.updated) || 0}; sin cambios: ${Number(summary.unchanged) || 0}`,
      );
    }
    if (sync.lastError) details.push("Error: " + sync.lastError);
    return details.join("\n");
  };

  const getSftpStatusKey = (doc) => {
    const status = String(
      doc?.sftpDelivery?.status || doc?.sftpStatus || "not_sent",
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
    if (siteColumnHeader) {
      siteColumnHeader.classList.toggle("hidden", !isAdminViewer);
    }
    if (catalogAdminButton) {
      catalogAdminButton.classList.toggle("hidden", !isAdminViewer);
    }
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

      const mfStatusCell = document.createElement("td");
      mfStatusCell.className = "mf-status-cell";
      const mfStatus = getMfStatusKey(doc);
      const mfStatusMeta = getMfStatusMeta(doc);
      const mfStatusButton = document.createElement("button");
      mfStatusButton.type = "button";
      mfStatusButton.className = "mf-status-button";
      mfStatusButton.title = getMfStatusTitle(doc);
      mfStatusButton.setAttribute("aria-label", mfStatusMeta.label);
      const mfStatusIcon = document.createElement("span");
      mfStatusIcon.className =
        `mf-status-icon ${mfStatusMeta.className}`;
      mfStatusIcon.innerHTML = MF_STATUS_ICONS[mfStatus];
      mfStatusButton.appendChild(mfStatusIcon);
      mfStatusButton.addEventListener("click", () => {
        openMfModal(doc);
      });
      mfStatusCell.appendChild(mfStatusButton);

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
        if (deleteModalMessage) {
          deleteModalMessage.textContent = "Esta accion elimina el archivo, Desea continuar?";
          deleteModalMessage.classList.remove("is-error");
        }
        if (deleteModal) deleteModal.classList.remove("hidden");
      });
      actionsWrap.style.display = "flex";

      const sftpBtn = document.createElement("button");
      sftpBtn.type = "button";
      sftpBtn.className = "admin-action-btn sftp-btn";
      const sftpAlreadySent = getSftpStatusKey(doc) === "sent";
      sftpBtn.disabled = sftpAlreadySent;
      sftpBtn.title = sftpAlreadySent
        ? "Edita el archivo para volver a enviarlo"
        : "Enviar por SFTP";
      sftpBtn.setAttribute(
        "aria-label",
        sftpAlreadySent
          ? `Archivo ${getAdminDocName(doc)} ya enviado; edita para reenviar`
          : `Enviar ${getAdminDocName(doc)} por SFTP`,
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
      row.appendChild(mfStatusCell);
      row.appendChild(actionsCell);
      tableBody.appendChild(row);
    });
  }

  function applyColumnFilters() {
    let filtered = allFilesList.slice();
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
        const dateValue = file.updatedAt || file.createdAt;
        if (!dateValue) return false;
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return false;
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = String(date.getFullYear());
        const searchableDates = [
          formatDate(dateValue),
          `${day}/${month}/${year}`,
          `${date.getDate()}/${date.getMonth() + 1}/${year}`,
          `${year}-${month}-${day}`,
        ];
        return searchableDates.some((candidate) =>
          candidate.toLowerCase().includes(val),
        );
      });
    }
    if (filterUsuario && filterUsuario.value.trim() !== "") {
      const val = filterUsuario.value.trim().toLowerCase();
      filtered = filtered.filter((file) => {
        const user = file.updatedBy || file.createdBy || file.userId || "";
        const userValues = typeof user === "object"
          ? [
              user.displayName,
              user.email,
              user._id,
              user.id,
            ]
          : [
              userCache.get(String(user)),
              user,
            ];
        return userValues.filter(Boolean).some((candidate) =>
          String(candidate).toLowerCase().includes(val),
        );
      });
    }
    if (sortMode === 0) {
      filtered.sort((a, b) => {
        const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bDate - aDate;
      });
    } else if (sortMode === 1) {
      filtered.sort((a, b) => {
        const aName = (a.adminFileName || a.fileName || "").toLowerCase();
        const bName = (b.adminFileName || b.fileName || "").toLowerCase();
        return aName.localeCompare(bName);
      });
    } else {
      filtered.sort((a, b) => {
        const aName = (a.adminFileName || a.fileName || "").toLowerCase();
        const bName = (b.adminFileName || b.fileName || "").toLowerCase();
        return bName.localeCompare(aName);
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
    const hasActiveFilters = [
      filterNombre,
      filterNomenclatura,
      filterFecha,
      filterUsuario,
    ].some((input) => input && input.value.trim() !== "");
    if (hasActiveFilters) {
      applyColumnFilters();
      return;
    }

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
  let pendingMfDoc = null;
  let currentUserSite = "";
  let isSftpSubmitting = false;
  let isMfSubmitting = false;
  let mfAudits = [];

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

    if (status === "pending" || status === "sending") {
      return "Env\u00edo en curso";
    }
    if (status === "failed") {
      return "Reintentar";
    }
    if (status === "sent") {
      return "Ya enviado";
    }
    return "Env\u00edo";
  };

  const updateSftpControls = () => {
    const status = getSftpStatusKey(pendingSftpDoc);
    const isInProgress = status === "pending" || status === "sending";
    const isAlreadySent = status === "sent";
    const hasSite = !!normalizeSite(sftpSiteSelect?.value);

    if (sftpSiteSelect) {
      sftpSiteSelect.disabled =
        isSftpSubmitting || isAlreadySent || !isAdminViewer;
    }
    if (sftpCancelBtn) {
      sftpCancelBtn.disabled = isSftpSubmitting;
    }
    if (sftpConfirmBtn) {
      sftpConfirmBtn.disabled =
        isSftpSubmitting || isInProgress || isAlreadySent || !hasSite;
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
    const status = getSftpStatusKey(doc);
    const selectedSite = normalizeSite(
      status === "not_sent"
        ? doc?.site || currentUserSite || delivery.site
        : delivery.site || doc?.site || currentUserSite,
    );
    if (sftpSiteSelect) {
      sftpSiteSelect.value = selectedSite;
    }
    renderSftpModalDetails(doc);
    updateSftpControls();
    if (sftpModal) sftpModal.classList.remove("hidden");

    window.setTimeout(() => {
      if (isAdminViewer && sftpSiteSelect) {
        sftpSiteSelect.focus();
      } else if (sftpConfirmBtn && !sftpConfirmBtn.disabled) {
        sftpConfirmBtn.focus();
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

    const requestController = new AbortController();
    const requestTimeout = window.setTimeout(
      () => requestController.abort(),
      60000,
    );

    try {
      const response = await fetch(
        "/api/files/admin-files/" +
          encodeURIComponent(pendingSftpDoc._id) +
          "/sftp?type=" +
          encodeURIComponent(currentDocType),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: requestController.signal,
          body: JSON.stringify({
            site,
            dryRun: false,
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
          "Archivo enviado por SFTP correctamente.",
        "success",
      );
    } catch (error) {
      const errorMessage = error.name === "AbortError"
        ? "El envio SFTP excedio el tiempo maximo permitido."
        : error.message === "Failed to fetch"
          ? "Se perdio la conexion con el servidor durante el envio SFTP."
          : error.message || "No se pudo procesar el envio SFTP.";

      if (pendingSftpDoc) {
        pendingSftpDoc.sftpDelivery = {
          ...getSftpDelivery(pendingSftpDoc),
          status: "failed",
          lastError: errorMessage,
        };
        pendingSftpDoc.sftpStatus = "failed";
        applySftpResponseToDocument({
          sftpDelivery: pendingSftpDoc.sftpDelivery,
          sftpStatus: "failed",
        });
      }

      showSftpModalMessage(errorMessage);
    } finally {
      window.clearTimeout(requestTimeout);
      isSftpSubmitting = false;
      updateSftpControls();
    }
  };

  const clearMfModalMessage = () => {
    if (!mfModalMessage) return;
    mfModalMessage.textContent = "";
    mfModalMessage.classList.add("hidden");
    mfModalMessage.classList.remove("is-error", "is-success");
  };

  const showMfModalMessage = (message, type = "error") => {
    if (!mfModalMessage) return;
    mfModalMessage.textContent = message;
    mfModalMessage.classList.remove("hidden", "is-error", "is-success");
    mfModalMessage.classList.add(
      type === "success" ? "is-success" : "is-error",
    );
  };

  const renderMfModalDetails = (doc) => {
    const sync = getMasterFileSync(doc);
    const status = getMfStatusKey(doc);
    const statusMeta = getMfStatusMeta(doc);
    const summary = sync.summary || {};

    if (mfModalStatusIcon) {
      mfModalStatusIcon.className =
        `mf-status-icon ${statusMeta.className}`;
      mfModalStatusIcon.innerHTML = MF_STATUS_ICONS[status];
    }
    if (mfModalStatusText) {
      mfModalStatusText.textContent = statusMeta.label;
    }
    if (mfAttempts) mfAttempts.textContent = Number(sync.attempts) || 0;
    if (mfLastAttempt) {
      mfLastAttempt.textContent = sync.lastAttemptAt
        ? formatDate(sync.lastAttemptAt)
        : "-";
    }
    if (mfLastUser) mfLastUser.textContent = getMfLastUserLabel(doc);
    if (mfAppliedAt) {
      mfAppliedAt.textContent = sync.appliedAt
        ? formatDate(sync.appliedAt)
        : "-";
    }
    if (mfAdded) mfAdded.textContent = Number(summary.added) || 0;
    if (mfUpdated) mfUpdated.textContent = Number(summary.updated) || 0;
    if (mfUnchanged) {
      mfUnchanged.textContent = Number(summary.unchanged) || 0;
    }
    if (mfLastError) mfLastError.textContent = sync.lastError || "-";
    if (mfLastErrorRow) {
      mfLastErrorRow.classList.toggle("hidden", !sync.lastError);
    }

    const sftpSent = getSftpStatusKey(doc) === "sent";
    const canRetry =
      currentDocType !== "splScrap" &&
      sftpSent &&
      ["pending", "failed"].includes(status);
    if (mfRetryBtn) {
      mfRetryBtn.classList.toggle("hidden", !canRetry);
      mfRetryBtn.disabled = isMfSubmitting || status === "applying";
      mfRetryBtn.textContent = isMfSubmitting
        ? "Actualizando..."
        : "Reintentar actualizacion";
    }
    if (mfCancelBtn) mfCancelBtn.disabled = isMfSubmitting;
  };

  const resetMfAuditDetails = () => {
    mfAudits = [];
    if (mfAuditSelect) mfAuditSelect.innerHTML = "";
    if (mfAuditSelectorGroup) {
      mfAuditSelectorGroup.classList.add("hidden");
    }
    if (mfAuditDetails) mfAuditDetails.classList.add("hidden");
    if (mfAuditMeta) mfAuditMeta.textContent = "";
    if (mfChangeTableBody) mfChangeTableBody.innerHTML = "";
  };

  const formatAuditValue = (value) => {
    if (value === null || value === undefined || value === "") {
      return "(vacio)";
    }
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const renderMfAuditDetails = ({ audit, changes }) => {
    if (!audit) {
      if (mfAuditDetails) mfAuditDetails.classList.add("hidden");
      return;
    }

    const appliedBy = audit.appliedBy;
    const userLabel = typeof appliedBy === "object"
      ? appliedBy?.displayName || appliedBy?.email || "-"
      : userCache.get(String(appliedBy || "")) || String(appliedBy || "-");
    if (mfAuditMeta) {
      mfAuditMeta.textContent = [
        formatDate(audit.createdAt),
        userLabel,
        audit.masterFileName || "Master File",
      ].join(" | ");
    }

    if (mfChangeTableBody) {
      mfChangeTableBody.innerHTML = "";
      const safeChanges = Array.isArray(changes) ? changes : [];

      if (!safeChanges.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 3;
        cell.textContent = "No hubo registros agregados ni modificados.";
        row.appendChild(cell);
        mfChangeTableBody.appendChild(row);
      }

      safeChanges.forEach((change) => {
        const row = document.createElement("tr");
        const actionCell = document.createElement("td");
        actionCell.textContent = change.action === "added"
          ? "Agregado"
          : "Actualizado";
        const keyCell = document.createElement("td");
        const recordLabel = change.recordKey || change.partNumber || "-";
        const sourceRow = Number(change.sourceRow);
        keyCell.textContent = Number.isFinite(sourceRow)
          ? `${recordLabel} (fila ${sourceRow})`
          : recordLabel;
        const fieldsCell = document.createElement("td");
        const fields = Array.isArray(change.changedFields)
          ? change.changedFields
          : [];

        fields.forEach((fieldChange) => {
          const item = document.createElement("div");
          item.className = "mf-change-field";
          const fieldName = document.createElement("strong");
          fieldName.textContent = `${fieldChange.field}: `;
          item.appendChild(fieldName);

          if (change.action === "updated") {
            const before = document.createElement("span");
            before.className = "mf-change-before";
            before.textContent = formatAuditValue(fieldChange.before);
            const separator = document.createTextNode(" -> ");
            const after = document.createElement("span");
            after.className = "mf-change-after";
            after.textContent = formatAuditValue(fieldChange.after);
            item.append(before, separator, after);
          } else {
            const after = document.createElement("span");
            after.className = "mf-change-after";
            after.textContent = formatAuditValue(fieldChange.after);
            item.appendChild(after);
          }

          fieldsCell.appendChild(item);
        });

        row.append(actionCell, keyCell, fieldsCell);
        mfChangeTableBody.appendChild(row);
      });
    }

    if (mfAuditDetails) mfAuditDetails.classList.remove("hidden");
  };

  const loadMfAuditDetails = async (auditId) => {
    if (!pendingMfDoc || !auditId || !currentDocType) return;
    const documentId = String(pendingMfDoc._id);

    try {
      const response = await fetch(
        `/api/files/admin-files/${encodeURIComponent(pendingMfDoc._id)}/master-sync/audits/${encodeURIComponent(auditId)}?type=${encodeURIComponent(currentDocType)}`,
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "No se pudo cargar el detalle MF.");
      }
      if (!pendingMfDoc || String(pendingMfDoc._id) !== documentId) {
        return;
      }
      renderMfAuditDetails(data);
    } catch (error) {
      showMfModalMessage(error.message || "No se pudo cargar el detalle MF.");
    }
  };

  const loadMfAudits = async () => {
    if (!pendingMfDoc || !currentDocType) return;
    const documentId = String(pendingMfDoc._id);
    resetMfAuditDetails();

    try {
      const response = await fetch(
        `/api/files/admin-files/${encodeURIComponent(pendingMfDoc._id)}/master-sync/audits?type=${encodeURIComponent(currentDocType)}&limit=20`,
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "No se pudo cargar la auditoria MF.");
      }
      if (!pendingMfDoc || String(pendingMfDoc._id) !== documentId) {
        return;
      }

      if (data.masterFileSync) {
        pendingMfDoc.masterFileSync = data.masterFileSync;
        renderMfModalDetails(pendingMfDoc);
      }
      mfAudits = Array.isArray(data.audits) ? data.audits : [];
      if (!mfAudits.length) return;

      if (mfAuditSelectorGroup) {
        mfAuditSelectorGroup.classList.remove("hidden");
      }
      if (mfAuditSelect) {
        mfAudits.forEach((audit) => {
          const option = document.createElement("option");
          option.value = audit._id;
          const summary = audit.summary || {};
          option.textContent =
            `${formatDate(audit.createdAt)} | +${Number(summary.added) || 0} / ~${Number(summary.updated) || 0}`;
          mfAuditSelect.appendChild(option);
        });
      }

      const preferredAuditId = String(
        getMasterFileSync(pendingMfDoc).auditId || "",
      );
      const selectedAudit = mfAudits.find(
        (audit) => String(audit._id) === preferredAuditId,
      ) || mfAudits[0];
      if (mfAuditSelect) mfAuditSelect.value = selectedAudit._id;
      await loadMfAuditDetails(selectedAudit._id);
    } catch (error) {
      showMfModalMessage(error.message || "No se pudo cargar la auditoria MF.");
    }
  };

  const closeMfModal = () => {
    if (isMfSubmitting) return;
    pendingMfDoc = null;
    resetMfAuditDetails();
    clearMfModalMessage();
    if (mfModal) mfModal.classList.add("hidden");
  };

  const openMfModal = async (doc) => {
    pendingMfDoc = doc || null;
    clearMfModalMessage();
    resetMfAuditDetails();
    if (mfSourceFileName) {
      mfSourceFileName.textContent = getAdminDocName(doc);
    }
    renderMfModalDetails(doc);
    if (mfModal) mfModal.classList.remove("hidden");
    await loadMfAudits();
  };

  const applyMfResponseToDocument = (data) => {
    if (!pendingMfDoc || !data || typeof data !== "object") return;
    const responseDoc = data.document;
    if (responseDoc && typeof responseDoc === "object") {
      Object.assign(pendingMfDoc, responseDoc);
    }
    const index = allFilesList.findIndex(
      (doc) => String(doc._id) === String(pendingMfDoc._id),
    );
    if (index >= 0) allFilesList[index] = pendingMfDoc;
    renderSortedDocuments();
    renderMfModalDetails(pendingMfDoc);
  };

  const retryMfSync = async () => {
    if (!pendingMfDoc || !currentDocType || isMfSubmitting) return;
    clearMfModalMessage();
    isMfSubmitting = true;
    renderMfModalDetails(pendingMfDoc);

    try {
      const response = await fetch(
        `/api/files/admin-files/${encodeURIComponent(pendingMfDoc._id)}/master-sync/retry?type=${encodeURIComponent(currentDocType)}`,
        { method: "POST" },
      );
      const data = await response.json().catch(() => ({}));
      applyMfResponseToDocument(data);
      if (!response.ok) {
        throw new Error(data.message || "No se pudo actualizar el archivo madre.");
      }
      showMfModalMessage(
        data.message || "Archivo madre actualizado correctamente.",
        "success",
      );
      await loadMfAudits();
    } catch (error) {
      showMfModalMessage(
        error.message || "No se pudo actualizar el archivo madre.",
      );
    } finally {
      isMfSubmitting = false;
      renderMfModalDetails(pendingMfDoc);
    }
  };

  const renderEmpty = (message) => {
    tableBody.innerHTML = "";
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = isAdminViewer ? 8 : 7;
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
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data.message || "No se pudo borrar el archivo.");
          }
          return data;
        })
        .then(() => {
          if (deleteModal) deleteModal.classList.add("hidden");
          pendingDeleteId = "";
          loadJobsForType(currentDocType || "finishedProduct");
        })
        .catch((error) => {
          console.error("Error deleting doc:", error);
          if (deleteModalMessage) {
            deleteModalMessage.textContent = error.message || "No se pudo borrar el archivo.";
            deleteModalMessage.classList.add("is-error");
          }
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

  if (sftpConfirmBtn) {
    sftpConfirmBtn.addEventListener("click", submitSftp);
  }

  if (sftpModal) {
    sftpModal.addEventListener("click", (event) => {
      if (event.target === sftpModal) closeSftpModal();
    });
  }

  if (mfCancelBtn) {
    mfCancelBtn.addEventListener("click", closeMfModal);
  }

  if (mfRetryBtn) {
    mfRetryBtn.addEventListener("click", retryMfSync);
  }

  if (mfAuditSelect) {
    mfAuditSelect.addEventListener("change", () => {
      clearMfModalMessage();
      loadMfAuditDetails(mfAuditSelect.value);
    });
  }

  if (mfModal) {
    mfModal.addEventListener("click", (event) => {
      if (event.target === mfModal) closeMfModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (mfModal && !mfModal.classList.contains("hidden")) {
      closeMfModal();
      return;
    }
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
