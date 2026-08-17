const catalogService = require("../services/catalogService");
const catalogExportService = require("../services/catalogExportService");

const getUserId = (req) => req.user?._id || req.user?.id;
const handleError = (res, error) => {
  console.error("Error administrando catalogos:", error);
  return res.status(error.status || (error.code === 11000 ? 409 : 500)).json({
    message: error.code === 11000 ? "El codigo ya existe." : error.message || "Error interno del servidor.",
  });
};

const listCatalog = async (req, res) => {
  try {
    const entries = await catalogService.list(req.params.type);
    return res.status(200).json(entries);
  } catch (error) { return handleError(res, error); }
};

const listCatalogAudits = async (req, res) => {
  try {
    const audits = await catalogService.listAudits(req.params.type, req.query.limit);
    return res.status(200).json(audits);
  } catch (error) { return handleError(res, error); }
};

const exportCatalogs = async (req, res) => {
  try {
    const workbook = await catalogExportService.buildCatalogWorkbook();
    const date = new Date().toISOString().slice(0, 10);
    const body = Buffer.from(workbook);
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="catalogs-${date}.xlsx"`,
      "Content-Length": body.length,
    });
    return res.status(200).send(body);
  } catch (error) { return handleError(res, error); }
};

const createCatalogEntry = async (req, res) => {
  try {
    const entry = await catalogService.create(req.params.type, req.body, getUserId(req));
    return res.status(201).json({ message: "Valor creado exitosamente.", entry });
  } catch (error) { return handleError(res, error); }
};

const updateCatalogEntry = async (req, res) => {
  try {
    const entry = await catalogService.update(req.params.type, req.params.id, req.body, getUserId(req));
    return res.status(200).json({ message: "Valor actualizado exitosamente.", entry });
  } catch (error) { return handleError(res, error); }
};

const updateCatalogStatus = async (req, res) => {
  try {
    const entry = await catalogService.setActive(req.params.type, req.params.id, req.body?.isActive, getUserId(req));
    return res.status(200).json({
      message: entry.isActive ? "Valor activado exitosamente." : "Valor desactivado exitosamente.",
      entry,
    });
  } catch (error) { return handleError(res, error); }
};
const deleteCatalogEntry = async (req, res) => {
  try {
    await catalogService.remove(req.params.type, req.params.id, getUserId(req));
    return res.status(200).json({ message: "Valor eliminado permanentemente." });
  } catch (error) { return handleError(res, error); }
};

module.exports = { listCatalog, listCatalogAudits, exportCatalogs, createCatalogEntry, updateCatalogEntry, updateCatalogStatus, deleteCatalogEntry };
