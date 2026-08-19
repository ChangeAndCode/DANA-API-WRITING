// controllers/masterFileController.js

const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const fsPromises = require("fs/promises");
const multer = require("multer");

const masterFileService = require(
  "../services/masterFileService"
);
const {
  filterIgnoredMasterHeaders,
} = require(
  "../data/masterFileRegistry",
);

const getUserLogName = (user) =>
  String(user?.displayName || user?.email || "Usuario").trim();

const getMasterFileLog = (
  masterFile,
  user,
  summary = undefined,
) => ({
  fileName: String(
    masterFile?.name ||
      masterFile?.originalFileName ||
      "Archivo madre",
  ).trim(),
  type: String(masterFile?.masterType || "").trim(),
  user: getUserLogName(user),
  ...(summary ? { summary } : {}),
});

const {
  convertXlsToXlsx,
} = require(
  "../utils/xlsConverter",
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
  ".xls",
]);

const masterUploadTempDir = path.resolve(
  process.env.MASTER_IMPORT_TEMP_DIR ||
    path.join(__dirname, "..", "temp_master_imports"),
);

fs.mkdirSync(masterUploadTempDir, { recursive: true });

let activeMasterImports = 0;
const configuredImportConcurrency = Number.parseInt(
  process.env.MASTER_IMPORT_CONCURRENCY,
  10,
);
const masterImportConcurrency = Number.isInteger(configuredImportConcurrency) &&
  configuredImportConcurrency > 0
  ? configuredImportConcurrency
  : 1;

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
      "Solo se permiten archivos Excel .xlsx, .xlsm o .xls.",
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
  storage: multer.diskStorage({
    destination: masterUploadTempDir,
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname || "").toLowerCase();
      callback(null, `${crypto.randomUUID()}${extension}`);
    },
  }),

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
 * Busca un Part Number dentro de los archivos madre disponibles para
 * la sede del usuario o la sede seleccionada por un administrador.
 */
const lookupMasterRecordByPartNumber =
  async (
    req,
    res,
  ) => {
    try {
      const result =
        await masterFileService
          .lookupMasterRecordByPartNumber({
            user:
              req.user,
            requestedSite:
              req.query.site,
            partNumber:
              req.query.partNumber,
            componentPartNumber:
              req.query.componentPartNumber,
            masterTypes:
              req.query.masterTypes,
          });

      return res
        .status(200)
        .json(result);
    } catch (error) {
      const statusCode =
        Number.isInteger(
          error.statusCode,
        )
          ? error.statusCode
          : 500;

      if (statusCode >= 500) {
        console.error(
          "[MasterFiles] Error al buscar Part Number:",
          error,
        );
      }

      return res
        .status(statusCode)
        .json({
          code:
            error.code ||
            "MASTER_LOOKUP_ERROR",
          message:
            statusCode < 500
              ? error.message
              : "Error interno al consultar el Part Number.",
        });
    }
  };

/**
 * Devuelve el contenido de un archivo madre
 * para mostrarlo en el editor.
 */
const getMasterFileEditorData = async (req, res) => {
  try {
    const result =
      await masterFileService.getMasterFileEditorData({
        masterFileId: req.params.masterFileId,
        user: req.user,
        page: req.query.page,
        pageSize: req.query.pageSize,
        search: req.query.search,
        columnIndexes: req.query.columns,
      });

    const masterFile = result.masterFile;

    const visibleHeaders =
      filterIgnoredMasterHeaders(
        masterFile.masterType,
        masterFile.headers,
      );

    const visibleColumnIndexes =
      new Set(
        visibleHeaders.map((header) =>
          Number(header.columnIndex),
        ),
      );

    return res.status(200).json({
      masterFile: {
        id: masterFile._id,
        name: masterFile.name,
        originalFileName: masterFile.originalFileName,
        masterType: masterFile.masterType,
        sites: masterFile.sites,
        sourceSheet: masterFile.sourceSheet,
        headerRow: masterFile.headerRow,
        partNumberColumn: masterFile.partNumberColumn,
        recordCount: masterFile.recordCount,
        revision: masterFile.revision,
        updatedAt: masterFile.updatedAt,

        headers: visibleHeaders.map((header) => ({
          originalName: header.originalName,
          normalizedName: header.normalizedName,
          columnIndex: header.columnIndex,
          columnLetter: header.columnLetter,
          mappedField: header.mappedField,
          ignored: header.ignored,
        })),
      },

      records: result.records.map((record) => ({
        id: record._id,
        partNumber: record.partNumber,
        sourceRow: record.sourceRow,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,

        rawCells: (record.rawCells || [])
          .filter(
            (cell) =>
              visibleColumnIndexes.has(
                Number(cell.columnIndex),
              ),
          )
          .map((cell) => ({
            header: cell.header,
            columnIndex: cell.columnIndex,
            columnLetter: cell.columnLetter,
            value: cell.value,
          })),

        validationWarnings:
          record.validationWarnings || [],
      })),

      loadedRecordCount: result.records.length,
      pagination: result.pagination,
    });
  } catch (error) {
    const statusCode =
      Number.isInteger(error.statusCode)
        ? error.statusCode
        : 500;

    if (statusCode >= 500) {
      console.error(
        "[MasterFiles] Error al cargar editor:",
        error,
      );
    }

    return res.status(statusCode).json({
      code:
        error.code ||
        "MASTER_EDITOR_LOAD_ERROR",

      message:
        statusCode < 500
          ? error.message
          : "Error interno al cargar el editor del archivo madre.",
    });
  }
};

/**
 * Guarda los cambios enviados desde el editor.
 */
const updateMasterFileFromEditor =
  async (
    req,
    res,
  ) => {
    try {
      const result =
        await masterFileService
          .updateMasterFileFromEditor({
            masterFileId:
              req.params.masterFileId,

            revision:
              req.body?.revision,

            name:
              req.body?.name,

            sites:
              parseSitesField(
                req.body?.sites,
              ),

            rows:
              req.body?.rows,

            deletedRecordIds:
              req.body
                ?.deletedRecordIds,

            user:
              req.user,
          });

      const masterFile =
        result.masterFile;

      console.info(
        "[MasterFile] Updated.",
        getMasterFileLog(
          masterFile,
          req.user,
          {
            inserted:
              result.insertedRecordCount,
            updated:
              result.updatedRecordCount,
            deleted:
              result.deletedRecordCount,
          },
        ),
      );

      return res.status(200).json({
        message:
          "Los cambios del archivo madre se guardaron correctamente.",

        masterFile: {
          id:
            masterFile._id,

          name:
            masterFile.name,

          masterType:
            masterFile.masterType,

          sites:
            masterFile.sites,

          revision:
            masterFile.revision,

          recordCount:
            masterFile.recordCount,

          warningCount:
            masterFile.warningCount,

          updatedBy:
            masterFile.updatedBy,

          updatedAt:
            masterFile.updatedAt,
        },

        insertedRecordCount:
          result.insertedRecordCount,

        updatedRecordCount:
          result.updatedRecordCount,

        deletedRecordCount:
          result.deletedRecordCount,

        warningCount:
          result.warningCount,
      });
    } catch (error) {
      const statusCode =
        Number.isInteger(
          error.statusCode,
        )
          ? error.statusCode
          : 500;

      if (statusCode >= 500) {
        console.error(
          "[MasterFiles] Error al guardar editor:",
          error,
        );
      }

      return res
        .status(statusCode)
        .json({
          code:
            error.code ||
            "MASTER_EDITOR_UPDATE_ERROR",

          message:
            statusCode < 500
              ? error.message
              : "Error interno al guardar el archivo madre.",
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

    console.info(
      "[MasterFile] Downloaded.",
      {
        fileName:
          result.fileName,
        user:
          getUserLogName(
            req.user,
          ),
      },
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

    console.info(
      "[MasterFile] Copied.",
      getMasterFileLog(
        masterFile,
        req.user,
        {
          copied:
            result.copiedRecordCount,
        },
      ),
    );

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

    console.info(
      "[MasterFile] Deleted.",
      {
        fileName:
          result.name,
        user:
          getUserLogName(
            req.user,
          ),
      },
    );

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
  if (!req.file || !req.file.path) {
    return res.status(400).json({
      code: "MASTER_FILE_REQUIRED",

      message:
        "Debes seleccionar un archivo madre.",
    });
  }

  let importPath = req.file.path;
  let convertedPath = "";

  if (activeMasterImports >= masterImportConcurrency) {
    await fsPromises.unlink(req.file.path).catch(() => {});
    return res.status(429).json({
      code: "MASTER_IMPORT_BUSY",
      message:
        "Ya existe una importación de archivo madre en proceso. Intenta nuevamente cuando termine.",
    });
  }

  activeMasterImports += 1;

  try {
    const originalFileName =
      req.file.originalname ||
      "archivo-madre";

    const originalExtension =
      path
        .extname(
          originalFileName,
        )
        .toLowerCase();

    if (
      originalExtension === ".xls"
    ) {
      convertedPath = await convertXlsToXlsx(req.file.path);
      importPath = convertedPath;
    }
    const result =
      await masterFileService
        .importMasterFileFromPath({
          filePath:
            importPath,
          originalFileName,
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

    console.info(
      "[MasterFile] Imported.",
      getMasterFileLog(
        masterFile,
        req.user,
        {
          inserted:
            result.insertedRecordCount,
          warnings:
            Array.isArray(
              result.warnings,
            )
              ? result.warnings.length
              : 0,
        },
      ),
    );

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
  } finally {
    activeMasterImports = Math.max(0, activeMasterImports - 1);
    await fsPromises.unlink(req.file.path).catch(() => {});

    if (convertedPath && convertedPath !== req.file.path) {
      await fsPromises.unlink(convertedPath).catch(() => {});
    }
  }
};

module.exports = {
  uploadMasterFile,
  importMasterFile,
  parseSitesField,
  listMasterFiles,
  lookupMasterRecordByPartNumber,
  getMasterFileEditorData,
  updateMasterFileFromEditor,
  downloadMasterFile,
  copyMasterFile,
  deleteMasterFile,

};
