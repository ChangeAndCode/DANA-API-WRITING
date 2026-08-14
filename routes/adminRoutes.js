// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const catalogController = require('../controllers/catalogController');
// Importa el nuevo middleware unificado
const { authenticateRequest, ensureApiAccess, ensureAdmin } = require('../middleware/authMiddleware');

// Middleware para autenticar la solicitud y luego verificar rol de admin
const ADMIN_PROTECTED = [
  authenticateRequest, // <--- Único middleware para autenticación
  ensureApiAccess,
  ensureAdmin,
];

// Todas las rutas de administración requieren que el usuario sea admin
router.get('/users', ADMIN_PROTECTED, adminController.getAllUsers);
router.put('/users/:userId/access', ADMIN_PROTECTED, adminController.updateUserAccess);
router.delete('/users/:userId', ADMIN_PROTECTED, adminController.deleteUser);
router.get('/catalogs/:type', ADMIN_PROTECTED, catalogController.listCatalog);
router.post('/catalogs/:type', ADMIN_PROTECTED, catalogController.createCatalogEntry);
router.put('/catalogs/:type/:id', ADMIN_PROTECTED, catalogController.updateCatalogEntry);
router.patch('/catalogs/:type/:id/status', ADMIN_PROTECTED, catalogController.updateCatalogStatus);
router.delete('/catalogs/:type/:id', ADMIN_PROTECTED, catalogController.deleteCatalogEntry);

module.exports = router;
