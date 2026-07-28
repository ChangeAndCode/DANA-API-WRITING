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
 * Administradores: todas las sedes.
 * Usuarios: únicamente su sede asignada.
 */
router.get(
  "/",
  USER_PROTECTED,
  masterFileController.listMasterFiles,
);

router.post(
  "/",
  ADMIN_PROTECTED,
  masterFileController.uploadMasterFile,
  masterFileController.importMasterFile,
);

/**
 * GET /api/master-files/lookup
 *
 * Consulta exacta por Part Number respetando la sede del usuario.
 * Debe declararse antes de las rutas dinámicas /:masterFileId.
 */
router.get(
  "/lookup",
  USER_PROTECTED,
  masterFileController
    .lookupMasterRecordByPartNumber,
);

/**
 * GET /api/master-files/:masterFileId/editor
 *
 * Administradores: cualquier archivo.
 * Usuarios: solamente archivos correspondientes a su sede.
 */
router.get(
  "/:masterFileId/editor",
  USER_PROTECTED,
  masterFileController.getMasterFileEditorData,
);

/**
 * PUT /api/master-files/:masterFileId/editor
 *
 * Administradores:
 * nombre, sedes y contenido.
 *
 * Usuarios:
 * únicamente contenido de archivos
 * correspondientes a su sede.
 */
router.put(
  "/:masterFileId/editor",
  USER_PROTECTED,
  masterFileController
    .updateMasterFileFromEditor,
);

/**
 * GET /api/master-files/:masterFileId/download
 *
 * Administradores: cualquier archivo.
 * Usuarios: solamente archivos asignados a su sede.
 */
router.get(
  "/:masterFileId/download",
  USER_PROTECTED,
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
