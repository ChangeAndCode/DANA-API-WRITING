// controllers/masterFileController.js

const path = require("path");
const multer = require("multer");

const masterFileService = require(
  "../services/masterFileService"
);

const DEFAULT_MAX_FILE_SIZE_MB = 50;

const configuredMaxFileSizeMb = Number(
  process.env.MASTER_FILE_MAX_SIZE_MB,
);

const maxFileSizeMb =
  Number.isFinite(configuredMaxFileSizeMb) &&
  configuredMaxFileSizeMb > 0
    ? configuredMaxFileSizeMb
    : DEFAULT_MAX_FILE_SIZE_MB;

const maxFileSizeBytes =
  maxFileSizeMb * 1024 * 1024;

const VALID_MASTER_EXTENSIONS = new Set([
  ".xlsx",
  ".xlsm",
]);

/**
 * Verifica la extensión antes de cargar el archivo
 * completamente en memoria.
 */
const masterFileFilter = (
  req,
  file,
  callback,
) => {
  const extension = path
    .extname(file.originalname || "")
    .toLowerCase();

  if (!VALID_MASTER_EXTENSIONS.has(extension)) {
    const error = new Error(
      "Solo se permiten archivos Excel .xlsx o .xlsm.",
    );

    error.code =
      "MASTER_FILE_EXTENSION_INVALID";

    error.statusCode = 400;

    return callback(error);
  }

  return callback(null, true);
};

/**
 * Los archivos se guardan temporalmente en memoria.
 * El parser recibirá req.file.buffer.
 */
const multerUpload = multer({
  storage: multer.memoryStorage(),

  fileFilter: masterFileFilter,

  limits: {
    files: 1,
    fileSize: maxFileSizeBytes,
  },
});

const singleMasterFileUpload =
  multerUpload.single("file");

/**
 * Convierte los errores de Multer en respuestas HTTP.
 */
const uploadMasterFile = (
  req,
  res,
  next,
) => {
  singleMasterFileUpload(
    req,
    res,
    (error) => {
      if (!error) {
        return next();
      }

      if (
        error instanceof multer.MulterError
      ) {
        if (
          error.code === "LIMIT_FILE_SIZE"
        ) {
          return res.status(413).json({
            code:
              "MASTER_FILE_TOO_LARGE",

            message:
              `El archivo excede el límite de ${maxFileSizeMb} MB.`,
          });
        }

        if (
          error.code ===
          "LIMIT_UNEXPECTED_FILE"
        ) {
          return res.status(400).json({
            code:
              "MASTER_FILE_FIELD_INVALID",

            message:
              'El archivo debe enviarse en el campo "file".',
          });
        }

        return res.status(400).json({
          code:
            error.code ||
            "MASTER_UPLOAD_ERROR",

          message:
            "No fue posible recibir el archivo.",
        });
      }

      return res
        .status(error.statusCode || 400)
        .json({
          code:
            error.code ||
            "MASTER_UPLOAD_ERROR",

          message:
            error.message ||
            "No fue posible recibir el archivo.",
        });
    },
  );
};

/**
 * Permite recibir sites como:
 *
 * sites=gaiim
 * sites=gaiim,p1a
 * sites=["gaiim","p1a"]
 * varios campos sites
 */
const parseSitesField = (sites) => {
  if (Array.isArray(sites)) {
    return sites;
  }

  if (typeof sites !== "string") {
    return sites;
  }

  const trimmedSites = sites.trim();

  if (
    trimmedSites.startsWith("[") &&
    trimmedSites.endsWith("]")
  ) {
    try {
      const parsedSites =
        JSON.parse(trimmedSites);

      if (Array.isArray(parsedSites)) {
        return parsedSites;
      }
    } catch (error) {
      return sites;
    }
  }

  return sites;
};

/**
 * Devuelve los archivos madre visibles para el usuario.
 */
const listMasterFiles = async (
  req,
  res,
) => {
  try {
    const masterFiles =
      await masterFileService.listMasterFiles({
        user: req.user,
        requestedSite: req.query.site,
        limit: req.query.limit,
      });

    return res.status(200).json({
      masterFiles: masterFiles.map(
        (masterFile) => ({
          id: masterFile._id,
          name: masterFile.name,
          originalFileName:
            masterFile.originalFileName,
          masterType:
            masterFile.masterType,
          sites: masterFile.sites,
          status: masterFile.status,
          recordCount:
            masterFile.recordCount,
          imageCountIgnored:
            masterFile.imageCountIgnored,
          warningCount:
            masterFile.warningCount,
          uploadedBy:
            masterFile.uploadedBy
              ? {
                  id:
                    masterFile
                      .uploadedBy._id,
                  displayName:
                    masterFile
                      .uploadedBy
                      .displayName ||
                    masterFile
                      .uploadedBy.email,
                  email:
                    masterFile
                      .uploadedBy.email,
                }
              : null,
          updatedBy:
            masterFile.updatedBy
              ? {
                  id:
                    masterFile
                      .updatedBy._id,
                  displayName:
                    masterFile
                      .updatedBy
                      .displayName ||
                    masterFile
                      .updatedBy.email,
                  email:
                    masterFile
                      .updatedBy.email,
                }
              : null,
          lastImportedAt:
            masterFile.lastImportedAt,
          createdAt:
            masterFile.createdAt,
          updatedAt:
            masterFile.updatedAt,
        }),
      ),
    });
  } catch (error) {
    const statusCode =
      Number.isInteger(error.statusCode)
        ? error.statusCode
        : 500;

    if (statusCode >= 500) {
      console.error(
        "[MasterFiles] Error al listar:",
        error,
      );
    }

    return res.status(statusCode).json({
      code:
        error.code ||
        "MASTER_LIST_ERROR",
      message:
        statusCode < 500
          ? error.message
          : "Error interno al consultar los archivos madre.",
    });
  }
};

/**
 * Descarga una reconstrucción del archivo madre
 * sin imágenes.
 */
const downloadMasterFile = async (
  req,
  res,
) => {
  try {
    const result =
      await masterFileService
        .downloadMasterFile({
          masterFileId:
            req.params.masterFileId,
          user: req.user,
        });

    res.attachment(
      result.fileName,
    );

    res.setHeader(
      "X-Exported-Record-Count",
      String(
        result.exportedRecordCount,
      ),
    );

    return res.send(
      result.buffer,
    );
  } catch (error) {
    const statusCode =
      Number.isInteger(error.statusCode)
        ? error.statusCode
        : 500;

    if (statusCode >= 500) {
      console.error(
        "[MasterFiles] Error al descargar:",
        error,
      );
    }

    return res.status(statusCode).json({
      code:
        error.code ||
        "MASTER_DOWNLOAD_ERROR",
      message:
        statusCode < 500
          ? error.message
          : "Error interno al descargar el archivo madre.",
    });
  }
};

/**
 * Crea una copia de un archivo madre.
 */
const copyMasterFile = async (
  req,
  res,
) => {
  try {
    const result =
      await masterFileService
        .copyMasterFile({
          sourceMasterFileId:
            req.params.masterFileId,

          name:
            req.body?.name,

          sites:
            req.body?.sites,

          user:
            req.user,
        });

    const masterFile =
      result.masterFile;

    return res.status(201).json({
      message:
        "Archivo madre copiado correctamente.",

      masterFile: {
        id:
          masterFile._id,

        name:
          masterFile.name,

        originalFileName:
          masterFile.originalFileName,

        masterType:
          masterFile.masterType,

        sites:
          masterFile.sites,

        status:
          masterFile.status,

        recordCount:
          masterFile.recordCount,

        uploadedBy:
          masterFile.uploadedBy,

        createdAt:
          masterFile.createdAt,

        lastImportedAt:
          masterFile.lastImportedAt,
      },

      copiedRecordCount:
        result.copiedRecordCount,

      sourceMasterFileId:
        result.sourceMasterFileId,
    });
  } catch (error) {
    const statusCode =
      Number.isInteger(error.statusCode)
        ? error.statusCode
        : 500;

    if (statusCode >= 500) {
      console.error(
        "[MasterFiles] Error al copiar:",
        error,
      );
    }

    return res.status(statusCode).json({
      code:
        error.code ||
        "MASTER_COPY_ERROR",

      message:
        statusCode < 500
          ? error.message
          : "Error interno al copiar el archivo madre.",
    });
  }
};

/**
 * Elimina un archivo madre completo.
 */
const deleteMasterFile = async (
  req,
  res,
) => {
  try {
    const result =
      await masterFileService
        .deleteMasterFile({
          masterFileId:
            req.params.masterFileId,
          user: req.user,
        });

    return res.status(200).json({
      message:
        "Archivo madre eliminado correctamente.",
      deletedMasterFile: {
        id: result.id,
        name: result.name,
        deletedRecordCount:
          result.deletedRecordCount,
      },
    });
  } catch (error) {
    const statusCode =
      Number.isInteger(error.statusCode)
        ? error.statusCode
        : 500;

    if (statusCode >= 500) {
      console.error(
        "[MasterFiles] Error al eliminar:",
        error,
      );
    }

    return res.status(statusCode).json({
      code:
        error.code ||
        "MASTER_DELETE_ERROR",
      message:
        statusCode < 500
          ? error.message
          : "Error interno al eliminar el archivo madre.",
    });
  }
};

/**
 * Controlador que inicia la importación.
 *
 * Requiere que uploadMasterFile se ejecute antes.
 */
const importMasterFile = async (
  req,
  res,
) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({
      code: "MASTER_FILE_REQUIRED",

      message:
        "Debes seleccionar un archivo madre.",
    });
  }

  try {
    const result =
      await masterFileService
        .importMasterFile({
          fileBuffer:
            req.file.buffer,

          originalFileName:
            req.file.originalname,

          name:
            req.body.name,

          expectedMasterType:
            req.body.masterType ||
            req.body.type,

          sites:
            parseSitesField(
              req.body.sites,
            ),

          user:
            req.user,
        });

    const masterFile =
      result.masterFile;

    return res.status(201).json({
      message:
        "Archivo madre importado correctamente.",

      masterFile: {
        id:
          masterFile._id,

        name:
          masterFile.name,

        originalFileName:
          masterFile.originalFileName,

        masterType:
          masterFile.masterType,

        sites:
          masterFile.sites,

        status:
          masterFile.status,

        recordCount:
          masterFile.recordCount,

        imageCountIgnored:
          masterFile.imageCountIgnored,

        warningCount:
          masterFile.warningCount,

        createdAt:
          masterFile.createdAt,

        lastImportedAt:
          masterFile.lastImportedAt,
      },

      insertedRecordCount:
        result.insertedRecordCount,

      warnings:
        result.warnings,
    });
  } catch (error) {
    const statusCode =
      Number.isInteger(error.statusCode)
        ? error.statusCode
        : 500;

    if (statusCode >= 500) {
      console.error(
        "[MasterFiles] Error al importar:",
        error,
      );
    }

    return res.status(statusCode).json({
      code:
        error.code ||
        "MASTER_IMPORT_ERROR",

      message:
        statusCode < 500
          ? error.message
          : "Error interno al importar el archivo madre.",
    });
  }
};

module.exports = {
  uploadMasterFile,
  importMasterFile,
  parseSitesField,
  listMasterFiles,
  downloadMasterFile,
  copyMasterFile,
  deleteMasterFile,

};