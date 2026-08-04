// controllers/fileController.js
const fileConversionService = require("../services/fileConversionService");
const conversionJobRepository = require("../repositories/conversionJobRepository");
const path = require("path");
const fs = require("fs/promises");
const mongoose = require("mongoose");
const { detectDocumentType } = require("../utils/documentDetector");
const {
  validateFormatCompatibility,
  getDefaultFormat,
} = require("../utils/documentFormatRules");
const FinishedProduct = require("../models/FinishedProduct");
const BillOfMaterials = require("../models/BOM");
const RawMaterial = require("../models/RawMaterial");
const SPLScrap = require("../models/SPLScrap");
const { getUOMOptions } = require("../data/uomCatalog");
const {
  getCountryOptions,
  getCountryNameToCode,
} = require("../data/countryCatalog");
const { convertXlsToXlsx } = require("../utils/xlsConverter");
const masterFileService = require(
  "../services/masterFileService",
);
const { VALID_SITES } = require("../data/siteConfig");

// Middleware de Multer (configúralo una vez)
const multer = require("multer");
const upload = multer({ dest: "temp_uploads/" });

const ADMIN_FILE_MODELS = {
  finishedProduct: FinishedProduct,
  rawMaterial: RawMaterial,
  billOfMaterials: BillOfMaterials,
  splScrap: SPLScrap,
};

const VALID_ADMIN_FILE_TYPES = Object.keys(ADMIN_FILE_MODELS);
const ADMIN_FILE_TYPES_ERROR_MESSAGE =
  "Solo finishedProduct, rawMaterial, billOfMaterials y splScrap estan habilitados.";

const createHttpError = (statusCode, message, extra = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
};

const isSupportedAdminFileType = (type) => VALID_ADMIN_FILE_TYPES.includes(type);

const getAdminFileModelByType = (type) => ADMIN_FILE_MODELS[type] || null;

const requireAdminFileModelByType = (type) => {
  const model = getAdminFileModelByType(type);
  if (!model) {
    throw createHttpError(400, ADMIN_FILE_TYPES_ERROR_MESSAGE, {
      code: "ADMIN_FILE_TYPE_INVALID",
    });
  }
  return model;
};

const normalizeAdminFileName = (value) =>
  typeof value === "string" ? value.trim() : "";

const VALID_USER_SITES = VALID_SITES;

const normalizeUserSite = (value) =>
  typeof value === "string" ? value.trim() : "";

const isAdminUser = (user) =>
  !!(user && (user.isAdmin || user.role === "admin"));

const getScopedUserSite = (user) => {
  const normalizedSite = normalizeUserSite(user?.site);
  return VALID_USER_SITES.includes(normalizedSite) ? normalizedSite : "";
};

const buildAdminFileQueryForUser = (user) => {
  if (isAdminUser(user)) return {};

  const userSite = getScopedUserSite(user);
  if (userSite) {
    return { site: userSite };
  }

  return { createdBy: user?.id };
};

const resolveDocumentSiteForWrite = (user, fallbackSite = "") => {
  const userSite = getScopedUserSite(user);
  if (userSite) return userSite;

  const normalizedFallbackSite = normalizeUserSite(fallbackSite);
  return VALID_USER_SITES.includes(normalizedFallbackSite)
    ? normalizedFallbackSite
    : "";
};

const assertUserCanAccessConversionJob = (
  job,
  user,
  automatedMessage = "Acceso denegado."
) => {
  if (!job.userId && job.isAutomated) {
    if (!isAdminUser(user)) {
      throw createHttpError(403, automatedMessage);
    }
    return;
  }

  if (isAdminUser(user)) return;

  const userSite = getScopedUserSite(user);
  const jobSite = normalizeUserSite(job?.site);

  if (userSite && jobSite) {
    if (userSite !== jobSite) {
      throw createHttpError(403, "Acceso denegado.");
    }
    return;
  }

  if (job.userId && job.userId.toString() !== user.id.toString()) {
    throw createHttpError(403, "Acceso denegado.");
  }
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findExistingAdminFileByName = async (name, options = {}) => {
  const normalizedName = normalizeAdminFileName(name);
  const scopedSite = normalizeUserSite(options.site);
  if (!normalizedName) return null;

  const checks = VALID_ADMIN_FILE_TYPES.map(async (type) => {
    const model = getAdminFileModelByType(type);
    const query = {
      adminFileName: {
        $regex: `^${escapeRegex(normalizedName)}$`,
        $options: "i",
      },
    };

    if (scopedSite) {
      query.site = scopedSite;
    }

    if (
      options.exclude &&
      options.exclude.type === type &&
      options.exclude.id &&
      mongoose.Types.ObjectId.isValid(options.exclude.id)
    ) {
      query._id = { $ne: options.exclude.id };
    }

    const document = await model
      .findOne(query)
      .select("_id adminFileName site")
      .lean();

    return document ? { type, document } : null;
  });

  const results = await Promise.all(checks);
  return results.find(Boolean) || null;
};

const assertAdminFileNameAvailable = async (name, options = {}) => {
  const normalizedName = normalizeAdminFileName(name);
  if (!normalizedName) return "";

  const existing = await findExistingAdminFileByName(normalizedName, options);
  if (!existing) return normalizedName;

  throw createHttpError(
    409,
    `Ya existe un archivo con el nombre "${normalizedName}". Usa un nombre distinto.`,
    {
      code: "ADMIN_FILE_NAME_DUPLICATE",
      existingType: existing.type,
      existingId: existing.document._id,
    }
  );
};

const assertUserCanAccessAdminFile = (doc, user) => {
  if (isAdminUser(user)) return;

  const userSite = getScopedUserSite(user);
  const documentSite = normalizeUserSite(doc?.site);

  if (userSite && documentSite) {
    if (userSite !== documentSite) {
      throw createHttpError(403, "Acceso denegado.");
    }
    return;
  }

  if (String(doc.createdBy || "") !== String(user?.id || "")) {
    throw createHttpError(403, "Acceso denegado.");
  }
};

const getAdminFileDocumentOrThrow = async ({
  id,
  type,
  user,
  lean = false,
}) => {
  if (!id) {
    throw createHttpError(400, "id es requerido.");
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createHttpError(400, "id invalido.");
  }

  const model = requireAdminFileModelByType(type);
  const query = model.findById(id);
  const doc = lean ? await query.lean() : await query;
  if (!doc) {
    throw createHttpError(404, "Archivo no encontrado.");
  }

  assertUserCanAccessAdminFile(doc, user);
  return { model, doc };
};

const cloneAdminFileRows = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    if (typeof row.toObject === "function") {
      return row.toObject();
    }
    return { ...row };
  });
};

const generateAdminFileNomenclature = (documentType, rows) =>
  fileConversionService.generateOutputFileNameForDocument(
    documentType,
    cloneAdminFileRows(rows),
    getDefaultFormat(documentType),
  );

const createAdminFileDocument = async ({
  documentType,
  adminFileName,
  lastDownloadedName,
  site,
  userId,
  sourceJobId,
  rows,
}) => {
  const model = requireAdminFileModelByType(documentType);
  const resolvedSite = normalizeUserSite(site);

  const savedDoc = await model.create({
    adminFileName: normalizeAdminFileName(adminFileName) || undefined,
    lastDownloadedName: normalizeAdminFileName(lastDownloadedName) || undefined,
    site: resolvedSite || undefined,
    createdBy: userId,
    updatedBy: userId,
    sourceJobId: sourceJobId || undefined,
    rows: cloneAdminFileRows(rows),
  });

  return {
    savedDoc,
    savedDb: model.db.name,
    savedCollection: model.collection.name,
  };
};

// Helper function for checking file existence asynchronously
const fileExists = async (filePath) => {
  try {
    await fs.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const uploadAndConvertFile = async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ message: "No se ha proporcionado ningún archivo." });
  }

  const { path: tempFilePath, originalname } = req.file;
  const { outputFormat, ...conversionOptions } = req.body;
  const requestUserSite = getScopedUserSite(req.user);
  let fileBuffer;

  try {
    // Read the buffer once for potential detection and for processing
    fileBuffer = await fs.readFile(tempFilePath);
  } catch (readError) {
    // If the file can't be read, delete the temp file and return an error
    await fs.unlink(tempFilePath).catch(() => {});
    return res
      .status(500)
      .json({ message: "Error reading uploaded file.", error: readError.message });
  }

  if (!outputFormat) {
    await fs.unlink(tempFilePath);
    return res
      .status(400)
      .json({ message: "El formato de salida es requerido." });
  }

  // --- REVISED DETECTION LOGIC ---
  // If documentType is NOT provided by the user, attempt auto-detection.
  if (!conversionOptions.documentType) {
    console.log(
      "[FileController] documentType not provided. Attempting auto-detection."
    );
    const detectedType = await detectDocumentType(fileBuffer, originalname);

    if (detectedType) {
      // If detection is successful, use the detected type.
      conversionOptions.documentType = detectedType;
      console.log(
        `[FileController] Auto-detected documentType: "${detectedType}"`
      );
    } else {
      // If detection fails (ambiguity, low score, etc.), return a specific error.
      // This prompts the frontend to ask the user for manual input.
      console.log(
        "[FileController] Auto-detection failed. Requesting manual input from user."
      );
      await fs.unlink(tempFilePath); // Clean up the temporary file
      return res.status(400).json({
        message:
          "Could not determine document type. Please select it manually.",
        errorType: "AMBIGUITY_DETECTED", // This is the key for the frontend
      });
    }
  }

  // Validar que el formato de salida sea compatible con el tipo de documento
  if (conversionOptions.documentType) {
    const validation = validateFormatCompatibility(
      conversionOptions.documentType, 
      outputFormat
    );
    
    if (!validation.isValid) {
      await fs.unlink(tempFilePath);
      return res.status(400).json({ message: validation.message });
    }
  }
  // --- END OF REVISED LOGIC ---

  // This check assumes a middleware has populated req.user
  if (!req.user || !req.user.id) {
    await fs.unlink(tempFilePath);
    return res.status(401).json({
      message: "Usuario no autenticado para realizar esta operacion.",
    });
  }

  let newJob;
  try {
    newJob = await conversionJobRepository.createConversionJob({
      userId: req.user.id,
      site: requestUserSite || undefined,
      fileName: originalname,
      originalFilePath: tempFilePath,
      outputFormat: outputFormat,
      conversionOptions: conversionOptions,
      status: "processing",
      isAutomated: false,
    });

    const { convertedFilePath, errorReportPath, status } =
      await fileConversionService.processFileForConversion(
        fileBuffer, // Use the buffer we already read
        originalname,
        outputFormat,
        conversionOptions,
        req.user.id,
        false
      );

    

    await conversionJobRepository.updateConversionJobStatus(newJob._id, status, {
      convertedFilePath,
      errorReportPath,
      completedAt: new Date(),
    });

    // The temp file is no longer needed after processing is complete
    await fs.unlink(tempFilePath);

    res.status(200).json({
      message: "Archivo procesado exitosamente.",
      jobId: newJob._id,
      documentType: conversionOptions.documentType, // Return the type used
      status: status,
    });
  } catch (error) {
    console.error("Error al procesar el archivo:", error);
    // Cleanup in case of failure
    if (await fileExists(tempFilePath)) {
      await fs
        .unlink(tempFilePath)
        .catch((e) =>
          console.error("Error deleting temp file in error handler:", e)
        );
    }
    if (newJob && newJob._id) {
      await conversionJobRepository.updateConversionJobStatus(
        newJob._id,
        "failed",
        {
          errorMessage: error.message,
        }
      );
    }
    res
      .status(500)
      .json({ message: "Error al procesar el archivo.", error: error.message });
  }
};

const getConvertedFile = async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await conversionJobRepository.getConversionJobById(jobId);

    if (!job) {
      return res
        .status(404)
        .json({ message: "Trabajo de conversión no encontrado." });
    }

    // Authorization checks
    try {
      assertUserCanAccessConversionJob(
        job,
        req.user,
        "Acceso denegado. Este es un archivo de conversión automatizado."
      );
    } catch (accessError) {
      return res.status(accessError.statusCode || 403).json({
        message: accessError.message,
      });
    }

    if (job.status !== "completed" && job.status !== "completed_with_errors") {
      return res
        .status(409)
        .json({ message: "El archivo aún no ha sido procesado o falló." });
    }

    if (!job.convertedFilePath || !(await fileExists(job.convertedFilePath))) {
      return res
        .status(404)
        .json({ message: "Archivo convertido no encontrado en el servidor." });
    }

    const downloadName = path.basename(job.convertedFilePath);

    // If this job corresponds to a finishedProduct file, store last download name
    try {
      if (
        job.conversionOptions &&
        job.conversionOptions.documentType === "finishedProduct"
      ) {
        await FinishedProduct.updateOne(
          { sourceJobId: job._id },
          { $set: { lastDownloadedName: downloadName } }
        );
      }
    } catch (updateError) {
      console.warn(
        "No se pudo actualizar lastDownloadedName:",
        updateError.message
      );
    }

    res.download(job.convertedFilePath, downloadName, (err) => {
      if (err) {
        console.error("Error al enviar el archivo para descarga:", err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Error al descargar el archivo." });
        }
      }
    });
  } catch (error) {
    console.error("Error al obtener archivo convertido:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

const getErrorReport = async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await conversionJobRepository.getConversionJobById(jobId);

    if (!job) {
      return res
        .status(404)
        .json({ message: "Trabajo de conversión no encontrado." });
    }

    // Authorization checks
    try {
      assertUserCanAccessConversionJob(
        job,
        req.user,
        "Acceso denegado. Este es un reporte de errores automatizado."
      );
    } catch (accessError) {
      return res.status(accessError.statusCode || 403).json({
        message: accessError.message,
      });
    }

    if (!job.errorReportPath || !(await fileExists(job.errorReportPath))) {
      return res
        .status(404)
        .json({ message: "Reporte de errores no disponible." });
    }

    res.download(job.errorReportPath, `error_report_${jobId}.json`, (err) => {
      if (err) {
        console.error("Error al enviar el reporte de errores:", err);
        if (!res.headersSent) {
          res
            .status(500)
            .json({ message: "Error al descargar el reporte de errores." });
        }
      }
    });
  } catch (error) {
    console.error("Error al obtener reporte de errores:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

const validateManualData = async (req, res) => {
  const { documentType, rows } = req.body || {};

  if (!documentType) {
    return res.status(400).json({ message: "documentType es requerido." });
  }
  if (!Array.isArray(rows)) {
    return res.status(400).json({ message: "rows debe ser un arreglo." });
  }

  const validationResult = await fileConversionService.validateManualRowsForDocument(
    rows,
    documentType,
    { allowEmptyMandatoryFields: false }
  );

  return res.status(200).json({
    isValid: !validationResult.hasErrors,
    errors: validationResult.errors,
  });
};

const getManualCatalogOptions = async (_req, res) => {
  try {
    const unitOfMeasure = getUOMOptions().map((option) => option.code);
    const countryOfOrigin = getCountryOptions();
    const countryNameToCode = getCountryNameToCode();

    return res.status(200).json({
      unitOfMeasure,
      countryOfOrigin,
      countryNameToCode,
    });
  } catch (error) {
    console.error("Error al cargar catalogos manuales:", error);
    return res.status(500).json({
      message: "Error interno al cargar catalogos.",
    });
  }
};

const importManualFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      message: "No se ha proporcionado ningun archivo.",
    });
  }

  const { documentType } = req.body || {};
  if (!documentType) {
    await fs.unlink(req.file.path).catch(() => {});
    return res.status(400).json({
      message: "documentType es requerido.",
    });
  }

  if (!isSupportedAdminFileType(documentType)) {
    await fs.unlink(req.file.path).catch(() => {});
    return res.status(400).json({
      message: ADMIN_FILE_TYPES_ERROR_MESSAGE,
    });
  }

  const tempFilePath = req.file.path;
  const originalName = req.file.originalname || "imported-file";
  const originalExtension = path.extname(originalName).toLowerCase();

  let readPath = tempFilePath;
  let effectiveName = originalName;
  let convertedTempPath = null;

  try {
    if (originalExtension === ".xls") {
      convertedTempPath = await convertXlsToXlsx(tempFilePath);
      readPath = convertedTempPath;
      effectiveName = `${path.parse(originalName).name}.xlsx`;
    }

    const fileBuffer = await fs.readFile(readPath);

    const importResult =
      await fileConversionService
        .prepareManualImportFromFile(
          fileBuffer,
          effectiveName,
          documentType,
        );

    let rows =
      Array.isArray(importResult.rows)
        ? importResult.rows
        : [];

    let errors =
      Array.isArray(importResult.errors)
        ? importResult.errors
        : [];

    let hasErrors =
      Boolean(importResult.hasErrors);

    let masterLookupSummary = null;

    if (documentType === "splScrap") {
      const selectedTypeOfGoods = String(
        req.body.typeOfGoods || "",
      ).trim().toUpperCase();

      if (!["FG", "RM", "EQ"].includes(selectedTypeOfGoods)) {
        throw createHttpError(
          400,
          "Debes seleccionar Type of goods (FG, RM o EQ).",
          { code: "TYPE_OF_GOODS_REQUIRED" },
        );
      }

      const shipmentFields = [
        "Customer(southbound) / Ship to (northbound)",
        "Type of shipment",
        "Expected date of arrival",
        "Waybill number",
        "Total gross weight",
        "Total bundles",
      ];

      rows = rows.map((row) => {
        const cleanRow = { ...(row || {}) };
        shipmentFields.forEach((fieldName) => {
          cleanRow[fieldName] = "";
        });
        cleanRow["Type of goods"] = selectedTypeOfGoods;
        return cleanRow;
      });
    }

    if (
      [
        "finishedProduct",
        "rawMaterial",
        "billOfMaterials",
        "splScrap",
      ].includes(documentType)
    ) {
      const requestedSite =
        resolveDocumentSiteForWrite(
          req.user,
          req.body.site,
        );

      if (!requestedSite) {
        throw createHttpError(
          400,
          "Debes seleccionar una sede para consultar los archivos madre.",
          {
            code:
              "DOCUMENT_SITE_REQUIRED",
          },
        );
      }

      const enrichmentResult =
        await masterFileService
          .enrichImportedRowsFromMasterFiles({
            user: req.user,
            requestedSite,
            documentType,
            rows,
          });

      rows =
        enrichmentResult.rows;

      masterLookupSummary =
        enrichmentResult.summary;

      const validationResult =
        await fileConversionService
          .validateManualRowsForDocument(
            rows,
            documentType,
            {
              allowEmptyMandatoryFields:
                false,
            },
          );

      rows =
        Array.isArray(
          validationResult
            .transformedData
            ?.Sheet1,
        )
          ? validationResult
              .transformedData
              .Sheet1
          : rows;

      errors =
        validationResult.errors || [];

      hasErrors =
        Boolean(
          validationResult.hasErrors,
        );
    }
    const suggestedAdminFileName = path.parse(originalName).name;

    return res.status(200).json({
      message: hasErrors
        ? "Archivo cargado con observaciones."
        : "Archivo cargado correctamente.",
      documentType,
      rows,
      errors,
      hasErrors,
      masterLookupSummary,
      fileName: originalName,
      suggestedAdminFileName,
    });
  } catch (error) {
    console.error(
      "Error al importar archivo manual:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        message:
          error.statusCode
            ? error.message
            : "Error al importar el archivo.",
        error: error.message,
        code: error.code,
      });
  } finally {
    await fs.unlink(tempFilePath).catch(() => {});
    if (convertedTempPath && convertedTempPath !== tempFilePath) {
      await fs.unlink(convertedTempPath).catch(() => {});
    }
  }
};

const createManualFile = async (req, res) => {
  const {
    documentType,
    rows,
    outputFormat,
    displayName,
    site,
  } = req.body || {};
  const normalizedName = normalizeAdminFileName(displayName);
  const requestUserSite =
    resolveDocumentSiteForWrite(
      req.user,
      site,
    );

  if (!documentType) {
    return res.status(400).json({ message: "documentType es requerido." });
  }
  if (!Array.isArray(rows)) {
    return res.status(400).json({ message: "rows debe ser un arreglo." });
  }
  if (!requestUserSite) {
    return res.status(400).json({
      message:
        "Debes seleccionar una sede válida para crear el archivo.",
      code: "DOCUMENT_SITE_REQUIRED",
    });
  }

  const finalOutputFormat = outputFormat || getDefaultFormat(documentType);
  if (!finalOutputFormat) {
    return res.status(400).json({
      message: "No se pudo determinar el formato de salida.",
    });
  }

  const formatValidation = validateFormatCompatibility(
    documentType,
    finalOutputFormat
  );
  if (!formatValidation.isValid) {
    return res.status(400).json({ message: formatValidation.message });
  }

  if (!req.user || !req.user.id) {
    return res.status(401).json({
      message: "Usuario no autenticado para realizar esta operacion.",
    });
  }

  let newJob;
  try {
    if (normalizedName) {
      await assertAdminFileNameAvailable(normalizedName, {
        site: requestUserSite || undefined,
      });
    }

    newJob = await conversionJobRepository.createConversionJob({
      userId: req.user.id,
      site: requestUserSite || undefined,
      fileName: `manual-${documentType}.${finalOutputFormat}`,
      originalFilePath: `manual-${documentType}`,
      outputFormat: finalOutputFormat,
      conversionOptions: {
        documentType,
        displayName: normalizedName || undefined,
      },
      status: "processing",
      isAutomated: false,
    });
    

    const {
      convertedFilePath,
      errorReportPath,
      status,
      errors,
      transformedRows,
      outputFileName,
    } =
      await fileConversionService.processManualDataForConversion(
        rows,
        finalOutputFormat,
        {
          documentType,
          validationOptions: { allowEmptyMandatoryFields: false },
        }
      );
    const lastDownloadedName =
      typeof outputFileName === "string" ? outputFileName : "";
    const resolvedAdminFileName =
      normalizedName || lastDownloadedName;
    const nomenclature = lastDownloadedName
      ? path.parse(lastDownloadedName).name
      : "";

    let savedCount = 0;
    let savedDb = "";
    let savedCollection = "";
    if (status === "completed") {
      const rowsToSave = Array.isArray(transformedRows) ? transformedRows : [];
      if (rowsToSave.length > 0) {
        await assertAdminFileNameAvailable(resolvedAdminFileName, {
          site: requestUserSite || undefined,
        });

        const result = await createAdminFileDocument({
          documentType,
          adminFileName: resolvedAdminFileName,
          lastDownloadedName: lastDownloadedName || undefined,
          site: requestUserSite || undefined,
          userId: req.user.id,
          sourceJobId: newJob._id,
          rows: rowsToSave,
        });

        savedCount = result.savedDoc ? 1 : 0;
        savedDb = result.savedDb;
        savedCollection = result.savedCollection;
        console.log(
          `[${documentType}] Inserted ${savedCount} doc into ${savedDb}.${savedCollection}`
        );
      }
    }

    await conversionJobRepository.updateConversionJobStatus(newJob._id, status, {
      convertedFilePath,
      errorReportPath,
      completedAt: new Date(),
    });

    return res.status(200).json({
      message: "Archivo procesado exitosamente.",
      jobId: newJob._id,
      documentType,
      adminFileName: resolvedAdminFileName,
      lastDownloadedName,
      nomenclature,
      status,
      errors: errors || [],
      savedCount,
      savedDb,
      savedCollection,
    });
  } catch (error) {
    console.error("Error al procesar datos manuales:", error);
    if (newJob && newJob._id) {
      await conversionJobRepository.updateConversionJobStatus(
        newJob._id,
        "failed",
        { errorMessage: error.message }
      );
    }
    return res.status(error.statusCode || 500).json({
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Error al procesar los datos manuales.",
      error: error.message,
      code: error.code,
    });
  }
};

const getAdminFilesByType = async (req, res) => {
  const { type } = req.query || {};
  if (!type) {
    return res.status(400).json({ message: "type es requerido." });
  }

  try {
    const model = requireAdminFileModelByType(type);
    const query = buildAdminFileQueryForUser(req.user);
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);

    const selectFields =
      "adminFileName lastDownloadedName site createdBy updatedBy createdAt updatedAt";
    const docs = await model
      .find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .select(selectFields)
      .populate("createdBy", "displayName email")
      .populate("updatedBy", "displayName email")
      .lean();

    return res.status(200).json({ documents: docs });
  } catch (error) {
    console.error("Error al listar archivos admin:", error);
    return res.status(error.statusCode || 500).json({
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Error interno del servidor al listar archivos.",
      code: error.code,
    });
  }
};

const getAdminFileById = async (req, res) => {
  const { id } = req.params;
  const { type } = req.query || {};

  try {
    const { doc } = await getAdminFileDocumentOrThrow({
      id,
      type,
      user: req.user,
      lean: true,
    });

    return res.status(200).json({ document: doc });
  } catch (error) {
    console.error("Error al obtener archivo admin:", error);
    return res.status(error.statusCode || 500).json({
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Error interno al obtener el archivo.",
      code: error.code,
    });
  }
};

const downloadAdminFileById = async (req, res) => {
  const { id } = req.params;
  const { type } = req.query || {};

  try {
    const { doc } = await getAdminFileDocumentOrThrow({
      id,
      type,
      user: req.user,
    });

    const rowsToExport = Array.isArray(doc.rows) ? doc.rows : [];
    if (!rowsToExport.length) {
      return res
        .status(409)
        .json({ message: "No hay filas para exportar." });
    }

    const {
      convertedFilePath,
      status,
      outputFileName,
    } = await fileConversionService.processManualDataForConversion(
      rowsToExport,
      null,
      { documentType: type }
    );

    if (status !== "completed" || !convertedFilePath) {
      return res.status(409).json({
        message: "No se pudo generar el archivo para descarga.",
      });
    }

    let fallbackName = "finishedProduct.txt";
    if (type === "rawMaterial") fallbackName = "rawMaterial.txt";
    if (type === "billOfMaterials") fallbackName = "billOfMaterials.txt";
    if (type === "splScrap") fallbackName = "splScrap.csv";
    const nomenclature =
      doc.lastDownloadedName ||
      (typeof outputFileName === "string" && outputFileName
        ? outputFileName
        : fallbackName);

    return res.download(convertedFilePath, nomenclature, (err) => {
      if (err) {
        console.error("Error al enviar el archivo:", err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Error al descargar el archivo." });
        }
      }
    });
  } catch (error) {
    console.error("Error al descargar archivo admin:", error);
    return res.status(error.statusCode || 500).json({
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Error interno al descargar el archivo.",
      code: error.code,
    });
  }
};

const copyAdminFileById = async (req, res) => {
  const { id } = req.params;
  const { type } = req.query || {};
  const { displayName } = req.body || {};
  const normalizedName = normalizeAdminFileName(displayName);
  

  if (!normalizedName) {
    return res.status(400).json({
      message: "El nombre del archivo es requerido para copiar.",
      code: "ADMIN_FILE_NAME_REQUIRED",
    });
  }

  try {
    const { doc } = await getAdminFileDocumentOrThrow({
      id,
      type,
      user: req.user,
    });
    const targetSite = resolveDocumentSiteForWrite(req.user, doc.site);

    await assertAdminFileNameAvailable(normalizedName, {
      site: targetSite || undefined,
    });
    const nextNomenclature = generateAdminFileNomenclature(type, doc.rows);
    

    const result = await createAdminFileDocument({
      documentType: type,
      adminFileName: normalizedName,
      lastDownloadedName: nextNomenclature,
      site: targetSite || undefined,
      userId: req.user.id,
      rows: doc.rows,
    });

    return res.status(201).json({
      message: "Archivo copiado.",
      document: {
        _id: result.savedDoc._id,
        adminFileName: result.savedDoc.adminFileName,
        createdAt: result.savedDoc.createdAt,
        updatedAt: result.savedDoc.updatedAt,
        createdBy: result.savedDoc.createdBy,
        updatedBy: result.savedDoc.updatedBy,
        site: result.savedDoc.site || "",
      },
    });
  } catch (error) {
    console.error("Error al copiar archivo admin:", error);
    return res.status(error.statusCode || 500).json({
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Error interno al copiar el archivo.",
      code: error.code,
    });
  }
};

const updateAdminFileById = async (req, res) => {
  const { id } = req.params;
  const { type } = req.query || {};
  const {
    rows,
    displayName,
    site,
  } = req.body || {};

  if (!isSupportedAdminFileType(type)) {
    return res.status(400).json({
      message: ADMIN_FILE_TYPES_ERROR_MESSAGE,
    });
  }
  if (!Array.isArray(rows)) {
    return res.status(400).json({ message: "rows debe ser un arreglo." });
  }

  try {
    const { doc } = await getAdminFileDocumentOrThrow({
      id,
      type,
      user: req.user,
    });

    const validationResult = await fileConversionService.validateManualRowsForDocument(
      rows,
      type,
      { allowEmptyMandatoryFields: false }
    );

    if (validationResult.hasErrors) {
      return res.status(400).json({
        message: "Errores de validacion.",
        errors: validationResult.errors,
      });
    }

    const normalizedName = normalizeAdminFileName(displayName);
    const nextAdminFileName = normalizedName || doc.adminFileName || "";
    const scopedSite =
      resolveDocumentSiteForWrite(
        req.user,
        normalizeUserSite(doc.site) ||
          site,
      );

    if (!scopedSite) {
      return res.status(400).json({
        message:
          "Debes seleccionar una sede válida para actualizar el archivo.",
        code:
          "DOCUMENT_SITE_REQUIRED",
      });
    }

    await assertAdminFileNameAvailable(nextAdminFileName, {
      site: scopedSite,
      exclude: { type, id },
    });

    doc.adminFileName = nextAdminFileName || doc.adminFileName;
    doc.site = scopedSite;
    doc.rows = Array.isArray(validationResult.transformedData.Sheet1)
      ? validationResult.transformedData.Sheet1
      : [];
    doc.lastDownloadedName = generateAdminFileNomenclature(type, doc.rows);
    doc.markModified("rows");
    doc.updatedBy = req.user.id;

    await doc.save();

    return res.status(200).json({
      message: "Archivo actualizado.",
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    console.error("Error al actualizar archivo admin:", error);
    return res.status(error.statusCode || 500).json({
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Error interno al actualizar el archivo.",
      code: error.code,
    });
  }
};

const deleteAdminFileById = async (req, res) => {
  const { id } = req.params;
  const { type } = req.query || {};

  try {
    const { model } = await getAdminFileDocumentOrThrow({
      id,
      type,
      user: req.user,
    });

    await model.deleteOne({ _id: id });
    return res.status(200).json({ message: "Archivo eliminado." });
  } catch (error) {
    console.error("Error al borrar archivo admin:", error);
    return res.status(error.statusCode || 500).json({
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Error interno al borrar el archivo.",
      code: error.code,
    });
  }
};

module.exports = {
  upload,
  uploadAndConvertFile,
  getConvertedFile,
  getErrorReport,
  getManualCatalogOptions,
  validateManualData,
  createManualFile,
  getAdminFilesByType,
  getAdminFileById,
  downloadAdminFileById,
  copyAdminFileById,
  updateAdminFileById,
  deleteAdminFileById,
  importManualFile,
};
