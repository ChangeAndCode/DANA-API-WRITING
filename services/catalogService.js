const mongoose = require("mongoose");
const catalogRepository = require("../repositories/catalogRepository");
const catalogAuditRepository = require("../repositories/catalogAuditRepository");
const uomCatalog = require("../data/uomCatalog");
const countryCatalog = require("../data/countryCatalog");
const { normalizeCatalogLookup, normalizeAliases } = require("../utils/catalogNormalization");

const TYPES = new Set(["uom", "countries"]);
const ensureType = (type) => {
  if (!TYPES.has(type)) {
    const error = new Error("Tipo de catalogo no valido.");
    error.status = 400;
    throw error;
  }
};

const snapshot = (type, entry) => {
  if (!entry) return null;
  const value = {
    code: entry.code,
    description: entry.description,
    aliases: Array.from(entry.aliases || []),
    isActive: entry.isActive,
  };
  if (type === "uom") {
    value.origin = entry.origin || "";
    value.allowsDecimals = Boolean(entry.allowsDecimals);
  }
  return value;
};

const audit = (type, entry, action, before, after, performedBy) =>
  catalogAuditRepository.create({
    catalogType: type,
    entryId: entry._id,
    code: entry.code,
    action,
    before,
    after,
    performedBy,
  });

const sanitize = (type, input = {}) => {
  ensureType(type);
  const code = String(input.code ?? input.CVE_PAIS ?? "").trim().toUpperCase();
  const description = String(input.description ?? "").trim();
  const aliases = normalizeAliases(input.aliases ?? input.alias);
  const maxCode = type === "uom" ? 3 : 2;

  if (!code || code.length > maxCode || (type === "countries" && code.length !== 2) || !/^[A-Z0-9]+$/.test(code)) {
    const error = new Error(type === "uom" ? "El codigo debe tener entre 1 y 3 caracteres alfanumericos." : "CVE_PAIS debe tener exactamente 2 caracteres alfanumericos.");
    error.status = 400;
    throw error;
  }
  if (!description) {
    const error = new Error("La descripcion es obligatoria.");
    error.status = 400;
    throw error;
  }

  const result = { code, description, aliases };
  if (type === "uom") {
    const origin = String(input.origin ?? "").trim().toUpperCase();
    if (origin.length > 3) {
      const error = new Error("Origin debe tener como maximo 3 caracteres.");
      error.status = 400;
      throw error;
    }
    result.origin = origin;
    result.allowsDecimals = input.allowsDecimals === true || input.decimals === true;
  }
  return result;
};

const refreshCache = async () => {
  const [uom, countries] = await Promise.all([
    catalogRepository.list("uom"),
    catalogRepository.list("countries"),
  ]);
  uomCatalog.setDatabaseCatalog(uom);
  countryCatalog.setDatabaseCatalog(countries);
};

const seedIfEmpty = async () => {
  const [uomCount, countryCount] = await Promise.all([
    catalogRepository.count("uom"),
    catalogRepository.count("countries"),
  ]);

  if (uomCount === 0) {
    const seed = uomCatalog.getUOMOptions().map((item) => ({
      code: item.code,
      description: item.description,
      origin: item.origin || "",
      allowsDecimals: Number(item.decimals) > 0,
      aliases: [],
      isActive: true,
    }));
    if (seed.length) await catalogRepository.insertMany("uom", seed);
  }
  if (countryCount === 0) {
    const snapshot = countryCatalog.loadCatalogOnce();
    const aliases = { US: ["USA", "United States", "United States of America", "Estados Unidos de America", "America"], DE: ["Germany"], RO: ["Romania"], TR: ["Turkey"], MX: ["Develop locally in Mexico"] };
    const seed = Array.from(snapshot.codeToName.entries()).map(([code, description]) => ({
      code,
      description,
      aliases: aliases[code] || [],
      isActive: true,
    }));
    if (seed.length) await catalogRepository.insertMany("countries", seed);
  }
};

const initializeCatalogs = async () => {
  await seedIfEmpty();
  await refreshCache();
  console.log("[Catalogs] Catalogos cargados desde MongoDB.");
};

const assertNoLookupConflict = async (type, candidate, ignoredId = null) => {
  const rows = await catalogRepository.list(type, { includeInactive: true });
  const candidateKeys = new Set([candidate.code, candidate.description, ...candidate.aliases].map(normalizeCatalogLookup));
  for (const row of rows) {
    if (ignoredId && String(row._id) === String(ignoredId)) continue;
    const rowKeys = [row.code, row.description, ...(row.aliases || [])].map(normalizeCatalogLookup);
    const collision = rowKeys.find((key) => candidateKeys.has(key));
    if (collision) {
      const error = new Error(`La descripcion o alias "${collision}" ya pertenece al codigo ${row.code}.`);
      error.status = 409;
      throw error;
    }
  }
};

const list = async (type) => {
  ensureType(type);
  return catalogRepository.list(type, { includeInactive: true });
};

const listInactive = async (type) => {
  ensureType(type);
  const entries = await catalogRepository.list(type, { includeInactive: true });
  return entries.filter((entry) => entry.isActive === false);
};

const listAudits = async (type, limit) => {
  ensureType(type);
  return catalogAuditRepository.list({ catalogType: type, limit });
};

const create = async (type, input, userId) => {
  const data = sanitize(type, input);
  const existing = await catalogRepository.findByCode(type, data.code);
  if (existing) {
    const error = new Error(`El codigo ${data.code} ya existe${existing.isActive ? "" : " y esta inactivo"}.`);
    error.status = 409;
    throw error;
  }
  await assertNoLookupConflict(type, data);
  const created = await catalogRepository.create(type, { ...data, createdBy: userId, updatedBy: userId });
  await audit(type, created, "created", null, snapshot(type, created), userId);
  await refreshCache();
  return created;
};

const update = async (type, id, input, userId) => {
  ensureType(type);
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("ID de catalogo no valido."); error.status = 400; throw error;
  }
  const current = await catalogRepository.findById(type, id);
  if (!current) { const error = new Error("Valor de catalogo no encontrado."); error.status = 404; throw error; }
  const data = sanitize(type, { ...input, code: current.code });
  await assertNoLookupConflict(type, data, id);
  const updated = await catalogRepository.update(type, id, { ...data, code: current.code, updatedBy: userId });
  await audit(type, updated, "updated", snapshot(type, current), snapshot(type, updated), userId);
  await refreshCache();
  return updated;
};

const setActive = async (type, id, isActive, userId) => {
  ensureType(type);
  if (!mongoose.Types.ObjectId.isValid(id)) { const error = new Error("ID de catalogo no valido."); error.status = 400; throw error; }
  if (typeof isActive !== "boolean") { const error = new Error("isActive debe ser booleano."); error.status = 400; throw error; }
  const current = await catalogRepository.findById(type, id);
  if (!current) { const error = new Error("Valor de catalogo no encontrado."); error.status = 404; throw error; }
  if (isActive) {
    await assertNoLookupConflict(type, { code: current.code, description: current.description, aliases: current.aliases || [] }, id);
  }
  const updated = await catalogRepository.update(type, id, { isActive, updatedBy: userId });
  await audit(type, updated, isActive ? "activated" : "deactivated", snapshot(type, current), snapshot(type, updated), userId);
  await refreshCache();
  return updated;
};

const remove = async (type, id, userId) => {
  ensureType(type);
  if (!mongoose.Types.ObjectId.isValid(id)) { const error = new Error("ID de catalogo no valido."); error.status = 400; throw error; }
  const removed = await catalogRepository.deleteById(type, id);
  if (!removed) { const error = new Error("Valor de catalogo no encontrado."); error.status = 404; throw error; }
  await audit(type, removed, "deleted", snapshot(type, removed), null, userId);
  await refreshCache();
  return removed;
};

module.exports = { initializeCatalogs, refreshCache, list, listInactive, listAudits, create, update, setActive, remove, sanitize };
