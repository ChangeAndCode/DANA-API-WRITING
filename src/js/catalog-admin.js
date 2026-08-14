import { createTableFilter } from "./table-filter.js";

const configs = {
  uom: {
    title: "Unit of Measure",
    subtitle: "Unidades disponibles para validación y creación de archivos.",
    columns: [
      { key: "code", label: "Code" }, { key: "description", label: "Description" },
      { key: "origin", label: "Origin" }, { key: "allowsDecimals", label: "Decimals" },
      { key: "isActive", label: "Estado" }, { key: "aliases", label: "Alias" },
    ],
  },
  countries: {
    title: "Country of Origin",
    subtitle: "Países y nombres alternativos reconocidos por el sistema.",
    columns: [
      { key: "code", label: "CVE_PAIS" }, { key: "description", label: "Description" },
      { key: "isActive", label: "Estado" }, { key: "aliases", label: "Alias" },
    ],
  },
};

const $ = (id) => document.getElementById(id);
const state = { type: "uom", entries: [], editing: null, deleting: null, filter: null };
const elements = {
  title: $("catalogTitle"), subtitle: $("catalogSubtitle"), message: $("catalogMessage"),
  head: $("catalogTableHead"), body: $("catalogTableBody"), modal: $("catalogModal"),
  form: $("catalogForm"), modalTitle: $("catalogModalTitle"), code: $("catalogCode"),
  description: $("catalogDescription"), origin: $("catalogOrigin"), decimals: $("catalogDecimals"),
  aliases: $("catalogAliases"), originField: $("originField"), decimalsField: $("decimalsField"),
  formError: $("catalogFormError"), deleteModal: $("deleteCatalogModal"), deleteText: $("deleteCatalogText"),
};

const showMessage = (text, type = "success") => {
  elements.message.textContent = text;
  elements.message.className = `catalog-message ${type}`;
};
const hideMessage = () => elements.message.classList.add("hidden");
const showFormError = (text) => { elements.formError.textContent = text; elements.formError.classList.remove("hidden"); };
const closeForm = () => elements.modal.classList.add("hidden");
const closeDelete = () => elements.deleteModal.classList.add("hidden");
const api = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "No se pudo completar la operación.");
  return data;
};

const createCell = (value, className = "") => {
  const cell = document.createElement("td"); cell.textContent = value ?? ""; if (className) cell.className = className; return cell;
};

const render = () => {
  const config = configs[state.type];
  elements.title.textContent = config.title; elements.subtitle.textContent = config.subtitle;
  elements.head.replaceChildren(); elements.body.replaceChildren();
  const headerRow = document.createElement("tr");
  config.columns.forEach(({ label }) => { const th = document.createElement("th"); th.textContent = label; headerRow.appendChild(th); });
  const actionHeader = document.createElement("th"); actionHeader.textContent = "Acciones"; headerRow.appendChild(actionHeader); elements.head.appendChild(headerRow);

  if (!state.entries.length) {
    const row = document.createElement("tr"); const cell = createCell("No hay valores disponibles."); cell.colSpan = config.columns.length + 1; row.appendChild(cell); elements.body.appendChild(row);
  } else {
    state.entries.forEach((entry) => {
      const row = document.createElement("tr");
      row.classList.toggle("catalog-row-inactive", !entry.isActive);
      entry._row = row;
      config.columns.forEach(({ key }) => {
        let value = entry[key];
        if (key === "aliases") value = (value || []).join(", ");
        if (key === "allowsDecimals") value = value ? "Sí" : "No";
        if (key === "isActive") {
          const statusCell = createCell("");
          const badge = document.createElement("span");
          badge.className = `catalog-status ${entry.isActive ? "active" : "inactive"}`;
          badge.textContent = entry.isActive ? "Activo" : "Inactivo";
          statusCell.appendChild(badge);
          row.appendChild(statusCell);
          return;
        }
        row.appendChild(createCell(value, key === "aliases" ? "catalog-aliases" : ""));
      });
      const actions = createCell(""); actions.className = "catalog-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "catalog-action-btn catalog-edit-btn";
      edit.title = "Modificar";
      edit.setAttribute("aria-label", `Modificar ${entry.code}`);
      edit.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 25" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17.25V21h3.75l11.06-11.06a1.06 1.06 0 0 0 0-1.5l-2.25-2.25a1.06 1.06 0 0 0-1.5 0L3 17.25z"/></svg>`;
      edit.addEventListener("click", () => openForm(entry));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "catalog-action-btn catalog-delete-btn";
      remove.title = "Eliminar";
      remove.setAttribute("aria-label", `Eliminar ${entry.code}`);
      remove.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="14" height="11" rx="2"/><path d="M8 9v5m4-5v5M5 6V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/></svg>`;
      remove.addEventListener("click", () => openDelete(entry));
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = `catalog-action-btn ${entry.isActive ? "catalog-disable-btn" : "catalog-enable-btn"}`;
      toggle.title = entry.isActive ? "Desactivar" : "Activar";
      toggle.setAttribute("aria-label", `${entry.isActive ? "Desactivar" : "Activar"} ${entry.code}`);
      toggle.innerHTML = entry.isActive
        ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M10 3v7"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="m6.5 10 2.2 2.2 4.8-5"/></svg>`;
      toggle.addEventListener("click", () => toggleStatus(entry));
      actions.append(edit, toggle, remove); row.appendChild(actions); elements.body.appendChild(row);
    });
  }
  state.filter.setColumns(config.columns, { clearQuery: true });
};

const load = async (successMessage = "") => {
  hideMessage();
  try {
    state.entries = await api(`/api/admin/catalogs/${state.type}`);
    render();
    if (successMessage) showMessage(successMessage);
  } catch (error) { showMessage(error.message, "error"); }
};

const openForm = (entry = null) => {
  state.editing = entry; elements.form.reset(); elements.formError.classList.add("hidden");
  elements.modalTitle.textContent = entry ? "Modificar valor" : "Crear valor";
  elements.code.value = entry?.code || ""; elements.code.disabled = Boolean(entry);
  elements.code.maxLength = state.type === "uom" ? 3 : 2;
  elements.description.value = entry?.description || ""; elements.origin.value = entry?.origin || "";
  elements.decimals.checked = Boolean(entry?.allowsDecimals); elements.aliases.value = (entry?.aliases || []).join("\n");
  const isUom = state.type === "uom"; elements.originField.classList.toggle("hidden", !isUom); elements.decimalsField.classList.toggle("hidden", !isUom);
  elements.modal.classList.remove("hidden");
  (entry ? elements.description : elements.code).focus();
};

const toggleStatus = async (entry) => {
  try {
    const result = await api(`/api/admin/catalogs/${state.type}/${entry._id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !entry.isActive }),
    });
    await load(result.message);
  } catch (error) {
    showMessage(error.message, "error");
  }
};
const openDelete = (entry) => {
  state.deleting = entry; elements.deleteText.textContent = `¿Deseas eliminar ${entry.code} - ${entry.description}?`;
  elements.deleteModal.classList.remove("hidden");
};

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault(); elements.formError.classList.add("hidden");
  const payload = { code: elements.code.value, description: elements.description.value, aliases: elements.aliases.value, origin: elements.origin.value, allowsDecimals: elements.decimals.checked };
  const url = state.editing ? `/api/admin/catalogs/${state.type}/${state.editing._id}` : `/api/admin/catalogs/${state.type}`;
  try {
    const result = await api(url, { method: state.editing ? "PUT" : "POST", body: JSON.stringify(payload) });
    closeForm(); await load(result.message);
  } catch (error) { showFormError(error.message); }
});

$("confirmDeleteCatalogBtn").addEventListener("click", async () => {
  if (!state.deleting) return;
  try { const result = await api(`/api/admin/catalogs/${state.type}/${state.deleting._id}`, { method: "DELETE" }); closeDelete(); await load(result.message); }
  catch (error) { closeDelete(); showMessage(error.message, "error"); }
});

document.querySelectorAll(".catalog-tab").forEach((tab) => tab.addEventListener("click", async () => {
  document.querySelectorAll(".catalog-tab").forEach((item) => item.classList.toggle("active", item === tab));
  state.type = tab.dataset.type; await load();
}));
$("createCatalogBtn").addEventListener("click", () => openForm());
$("cancelCatalogBtn").addEventListener("click", closeForm);
$("cancelDeleteCatalogBtn").addEventListener("click", closeDelete);


elements.modal.addEventListener("click", (event) => {
  if (event.target === elements.modal) closeForm();
});
elements.deleteModal.addEventListener("click", (event) => {
  if (event.target === elements.deleteModal) closeDelete();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!elements.modal.classList.contains("hidden")) closeForm();
  if (!elements.deleteModal.classList.contains("hidden")) closeDelete();
});
state.filter = createTableFilter({
  container: $("catalogFilter"), columns: configs.uom.columns, getItems: () => state.entries,
  getValue: (entry, key) => key === "allowsDecimals" ? (entry[key] ? "sí yes decimals" : "no integers") : key === "isActive" ? (entry.isActive ? "activo active" : "inactivo inactive") : entry[key],
  setItemVisibility: (entry, visible) => entry._row?.classList.toggle("table-filter-row-hidden", !visible),
});
load();
