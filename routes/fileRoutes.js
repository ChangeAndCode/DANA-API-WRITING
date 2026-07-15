// routes/fileRoutes.js
const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
// Importa el nuevo middleware unificado
const { authenticateRequest, ensureApiAccess } = require('../middleware/authMiddleware');

// Middleware para autenticar la solicitud y luego verificar acceso a la API
// authenticateRequest se encarga de probar JWT o Sesión.
const API_PROTECTED = [
  authenticateRequest, // <--- Único middleware para autenticación
  ensureApiAccess,
];

// Ruta para subir y convertir un archivo
router.post(
  '/upload',
  API_PROTECTED, // Usa el array de middlewares
  fileController.upload.single('file'),
  fileController.uploadAndConvertFile,
);

// Ruta para validar datos manuales (file creation)
router.post('/validate', API_PROTECTED, fileController.validateManualData);

// Catalogos dinamicos para creacion/edicion manual
router.get('/catalog-options', API_PROTECTED, fileController.getManualCatalogOptions);

// Ruta para crear archivo desde datos manuales (file creation)
router.post('/create-manual', API_PROTECTED, fileController.createManualFile);

// Ruta para listar archivos por tipo (admin UI)
router.get('/admin-files', API_PROTECTED, fileController.getAdminFilesByType);
router.get(
  '/admin-files/:id',
  API_PROTECTED,
  fileController.getAdminFileById,
);
router.get(
  '/admin-files/:id/download',
  API_PROTECTED,
  fileController.downloadAdminFileById,
);
router.put(
  '/admin-files/:id',
  API_PROTECTED,
  fileController.updateAdminFileById,
);
router.post(
  '/admin-files/:id/copy',
  API_PROTECTED,
  fileController.copyAdminFileById,
);
router.delete(
  '/admin-files/:id',
  API_PROTECTED,
  fileController.deleteAdminFileById,
);

// Ruta para descargar un archivo convertido
router.get('/:jobId/download', API_PROTECTED, fileController.getConvertedFile);

// Ruta para descargar el reporte de errores
router.get('/:jobId/errors', API_PROTECTED, fileController.getErrorReport);

module.exports = router;
