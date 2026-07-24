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

/**
 * POST /api/master-files
 *
 * Solo administradores activos pueden cargar
 * un archivo madre.
 */
router.post(
  "/",
  ADMIN_PROTECTED,
  masterFileController.uploadMasterFile,
  masterFileController.importMasterFile,
);

module.exports = router;