// routes/masterFileRoutes.js

const express = require("express");

const masterFileController = require(
  "../controllers/masterFileController"
);

const {
  authenticateRequest,
  ensureApiAccess,
  ensureAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

const ADMIN_PROTECTED = [
  authenticateRequest,
  ensureApiAccess,
  ensureAdmin,
];

const USER_PROTECTED = [
  authenticateRequest,
  ensureApiAccess,
];

/**
 * GET /api/master-files
 *
 * Solamente administradores.
 */
router.get(
  "/",
  ADMIN_PROTECTED,
  masterFileController.listMasterFiles,
);

/**
 * GET /api/master-files/lookup/part-number
 *
 * Query:
 * partNumber=...
 * site=gaiim (obligatorio para administradores)
 */
router.get(
  "/lookup/part-number",
  USER_PROTECTED,
  masterFileController.lookupMasterRecordByPartNumber,
);

router.post(
  "/",
  ADMIN_PROTECTED,
  masterFileController.uploadMasterFile,
  masterFileController.importMasterFile,
);

/**
 * GET /api/master-files/:masterFileId/editor
 *
 * Solamente administradores.
 */
router.get(
  "/:masterFileId/editor",
  ADMIN_PROTECTED,
  masterFileController.getMasterFileEditorData,
);

/**
 * PUT /api/master-files/:masterFileId/editor
 *
 * Solamente administradores.
 */
router.put(
  "/:masterFileId/editor",
  ADMIN_PROTECTED,
  masterFileController
    .updateMasterFileFromEditor,
);

/**
 * GET /api/master-files/:masterFileId/download
 *
 * Solamente administradores.
 */
router.get(
  "/:masterFileId/download",
  ADMIN_PROTECTED,
  masterFileController.downloadMasterFile,
);

/**
 * POST /api/master-files/:masterFileId/copy
 *
 * Sólo administradores activos pueden copiar
 * archivos madre completos.
 */
router.post(
  "/:masterFileId/copy",
  ADMIN_PROTECTED,
  masterFileController.copyMasterFile,
);

/**
 * DELETE /api/master-files/:masterFileId
 *
 * Solamente un administrador activo puede eliminar
 * un archivo madre completo.
 */
router.delete(
  "/:masterFileId",
  ADMIN_PROTECTED,
  masterFileController.deleteMasterFile,
);

module.exports = router;
