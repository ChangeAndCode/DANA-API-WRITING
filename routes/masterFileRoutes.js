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

module.exports = router;