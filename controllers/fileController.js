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
const siteSftpService = require("../services/siteSftpService");
const {
  SFTP_IN_PROGRESS_STATUSES,
  createSftpAvailableFilter,
  createSftpOperationId,
  createSftpOwnerFilter,
  createSftpSendAcquisitionFilter,
  getSftpLeaseExpiry,
  isSftpOperationActive,
  shouldDeletePreviousRemoteFile,
} = require("../utils/sftpOperationLock");
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

const assertUserCanAccessConversionJob = (job, user) => {
  if (isAdminUser(user)) return;

  if (!job.userId) {
    throw createHttpError(403, "Acceso denegado.");
  }

  const userSite = getScopedUserSite(user);
  const jobSite = normalizeUserSite(job?.site);

  if (userSite && jobSite) {
    if (userSite !== jobSite) {
      throw createHttpError(403, "Acceso denegado.");
    }
    return;
  }

  if (job.userId.toString() !== user.id.toString()) {
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
  const query = model.findById(id).select("+sftpDelivery.remotePath");
  const doc = lean ? await query.lean() : await query;
  if (!doc) {
    throw createHttpError(404, "Archivo no encontrado.");
  }

  assertUserCanAccessAdminFile(doc, user);
  return { model, doc };
};

const DEFAULT_SFTP_LOCK_TIMEOUT_MS = 60 * 1000;
const MAX_STORED_SFTP_ERROR_LENGTH = 500;

const getSftpLockTimeoutMs = () => {
  const configured = Number.parseInt(process.env.SFTP_LOCK_TIMEOUT_MS, 10);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_SFTP_LOCK_TIMEOUT_MS;
};

const normalizeSftpSite = (value) =>
  String(value || "").trim().toLowerCase();

const resolveSftpTargetSite = ({ user, documentSite, requestedSite }) => {
  const requested = normalizeSftpSite(requestedSite);

  if (!VALID_USER_SITES.includes(requested)) {
    throw createHttpError(400, "Debes seleccionar una sede SFTP valida.", {
      code: "SFTP_SITE_REQUIRED",
    });
  }

  if (isAdminUser(user)) return requested;

  const assignedSite =
    getScopedUserSite(user) || normalizeSftpSite(documentSite);
  if (!VALID_USER_SITES.includes(assignedSite)) {
    throw createHttpError(403, "No tienes una sede asignada para enviar.", {
      code: "SFTP_USER_SITE_REQUIRED",
    });
  }
  if (requested !== assignedSite) {
    throw createHttpError(403, "No puedes enviar archivos a otra sede.", {
      code: "SFTP_SITE_ACCESS_DENIED",
    });
  }

  return assignedSite;
};

const toPlainObject = (value) => {
  if (!value) return {};
  return typeof value.toObject === "function" ? value.toObject() : { ...value };
};

const toPublicSftpDelivery = (value) => {
  const delivery = toPlainObject(value);
  return {
    status: delivery.status || "not_sent",
    site: delivery.site || "",
    attempts: Number(delivery.attempts) || 0,
    lastAttemptAt: delivery.lastAttemptAt || null,
    sentAt: delivery.sentAt || null,
    lastAttemptBy: delivery.lastAttemptBy || null,
    lastError: delivery.lastError || "",
    remoteFileName: delivery.remoteFileName || "",
    lastDryRunAt: delivery.lastDryRunAt || null,
    lastDryRunSite: delivery.lastDryRunSite || "",
    lastDryRunBy: delivery.lastDryRunBy || null,
    lastDryRunSucceeded:
      typeof delivery.lastDryRunSucceeded === "boolean"
        ? delivery.lastDryRunSucceeded
        : null,
    lastDryRunError: delivery.lastDryRunError || "",
  };
};

const getAdminFileTypeByModel = (model) => {
  const match = Object.entries(ADMIN_FILE_MODELS).find(
    ([, candidate]) => candidate === model,
  );
  return match?.[0] || "";
};

const getDefaultMasterFileSyncStatus = (documentType) =>
  documentType === "splScrap" ? "not_applicable" : "pending";

const toPublicMasterFileSync = (value, documentType) => {
  const sync = toPlainObject(value);
  const summary = toPlainObject(sync.summary);

  return {
    status:
      sync.status || getDefaultMasterFileSyncStatus(documentType),
    attempts: Number(sync.attempts) || 0,
    lastAttemptAt: sync.lastAttemptAt || null,
    appliedAt: sync.appliedAt || null,
    lastAttemptBy: sync.lastAttemptBy || null,
    lastError: sync.lastError || "",
    masterFileId: sync.masterFileId || null,
    masterFileName: sync.masterFileName || "",
    auditId: sync.auditId || null,
    summary: {
      total: Number(summary.total) || 0,
      added: Number(summary.added) || 0,
      updated: Number(summary.updated) || 0,
      unchanged: Number(summary.unchanged) || 0,
    },
  };
};

const toPublicAdminFileDocument = (value, documentType = "") => {
  const document = toPlainObject(value);
  return {
    ...document,
    sftpDelivery: toPublicSftpDelivery(document.sftpDelivery),
    masterFileSync: toPublicMasterFileSync(
      document.masterFileSync,
      documentType,
    ),
  };
};

const getSftpDocumentSummary = async (model, id) => {
  const documentType = getAdminFileTypeByModel(model);
  const document = await model
    .findById(id)
    .select(
      "adminFileName lastDownloadedName site createdBy updatedBy createdAt updatedAt sftpDelivery masterFileSync",
    )
    .populate("createdBy", "displayName email")
    .populate("updatedBy", "displayName email")
    .populate("sftpDelivery.lastAttemptBy", "displayName email")
    .populate("sftpDelivery.lastDryRunBy", "displayName email")
    .populate("masterFileSync.lastAttemptBy", "displayName email")
    .lean();

  return document
    ? toPublicAdminFileDocument(document, documentType)
    : null;
};

const isSftpOperationInProgress = (document) =>
  isSftpOperationActive(
    toPlainObject(document?.sftpDelivery),
    getSftpLockTimeoutMs(),
  );

const sanitizeStoredSftpError = (value) =>
  String(value || "No se pudo completar la operacion SFTP.")
    .trim()
    .slice(0, MAX_STORED_SFTP_ERROR_LENGTH);

const prepareAdminFileForSftp = async (document, documentType) => {
  const rows = Array.isArray(document.rows) ? document.rows : [];
  if (!rows.length) {
    throw createHttpError(409, "No hay filas para enviar.", {
      code: "ADMIN_FILE_EMPTY",
    });
  }

  const result = await fileConversionService.processManualDataForConversion(
    rows,
    null,
    { documentType },
  );

  if (result.status !== "completed" || !result.convertedFilePath) {
    throw createHttpError(
      409,
      "No se pudo generar un archivo valido para enviar.",
      { code: "ADMIN_FILE_EXPORT_FAILED" },
    );
  }

  let fallbackName = "finishedProduct.txt";
  if (documentType === "rawMaterial") fallbackName = "rawMaterial.txt";
  if (documentType === "billOfMaterials") {
    fallbackName = "billOfMaterials.txt";
  }
  if (documentType === "splScrap") fallbackName = "splScrap.csv";

  return {
    localPath: result.convertedFilePath,
    fileName: siteSftpService.sanitizeRemoteFileName(
      document.lastDownloadedName || result.outputFileName || fallbackName,
    ),
  };
};

const markSftpOperationFailed = async ({
  model,
  id,
  operationId,
  message,
}) =>
  model.updateOne(
    createSftpOwnerFilter({
      id,
      operationId,
      statuses: SFTP_IN_PROGRESS_STATUSES,
    }),
    {
      $set: {
        "sftpDelivery.status": "failed",
        "sftpDelivery.lastError": sanitizeStoredSftpError(message),
      },
      $unset: {
        "sftpDelivery.operationId": "",
        "sftpDelivery.lockExpiresAt": "",
      },
    },
    { timestamps: false },
  );

const renewSftpOperationLease = async ({ model, id, operationId }) => {
  const timeoutMs = getSftpLockTimeoutMs();
  const result = await model.updateOne(
    createSftpOwnerFilter({
      id,
      operationId,
      statuses: SFTP_IN_PROGRESS_STATUSES,
    }),
    {
      $set: {
        "sftpDelivery.lockExpiresAt": getSftpLeaseExpiry(timeoutMs),
        "sftpDelivery.lastAttemptAt": new Date(),
      },
    },
    { timestamps: false },
  );
  return result.matchedCount === 1;
};

const startSftpLeaseHeartbeat = ({ model, id, operationId }) => {
  const intervalMs = Math.max(
    1000,
    Math.min(15000, Math.floor(getSftpLockTimeoutMs() / 3)),
  );
  let renewalInProgress = false;
  const timer = setInterval(async () => {
    if (renewalInProgress) return;
    renewalInProgress = true;
    try {
      await renewSftpOperationLease({ model, id, operationId });
    } catch (error) {
      console.warn("[SFTP] No se pudo renovar el lease del envio.", {
        documentId: String(id),
        code: error.code || "SFTP_LEASE_RENEWAL_FAILED",
      });
    } finally {
      renewalInProgress = false;
    }
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
};

const isMasterFileSyncInProgress = (document) => {
  const sync = toPlainObject(document?.masterFileSync);
  return sync.status === "applying";
};

const markMasterFileSyncFailed = async ({
  model,
  id,
  message,
  userId,
  incrementAttempt = false,
}) => {
  const update = {
    $set: {
      "masterFileSync.status": "failed",
      "masterFileSync.lastAttemptAt": new Date(),
      "masterFileSync.lastAttemptBy": userId,
      "masterFileSync.lastError": sanitizeStoredSftpError(message),
      "masterFileSync.appliedAt": null,
    },
  };

  if (incrementAttempt) {
    update.$inc = {
      "masterFileSync.attempts": 1,
    };
  }

  await model.updateOne(
    { _id: id },
    update,
    { timestamps: false },
  );
};

const getPublicMasterFileSyncErrorMessage = (error) => {
  const statusCode = Number(error?.statusCode);
  if (
    Number.isInteger(statusCode) &&
    statusCode >= 400 &&
    statusCode < 500 &&
    error?.message
  ) {
    return error.message;
  }
  return "No se pudo actualizar el archivo madre.";
};

const applyPreparedMasterSyncForAdminDocument = async ({
  model,
  id,
  documentType,
  preparedSync,
  user,
  adminFileName,
  sftpRemoteFileName,
}) => {
  if (!preparedSync?.required) {
    return {
      required: false,
    };
  }

  const userId = user?.id || user?._id;
  const attemptAt = new Date();
  const lock = await model.updateOne(
    {
      _id: id,
      "masterFileSync.status": { $ne: "applying" },
    },
    {
      $set: {
        "masterFileSync.status": "applying",
        "masterFileSync.lastAttemptAt": attemptAt,
        "masterFileSync.lastAttemptBy": userId,
        "masterFileSync.lastError": "",
        "masterFileSync.appliedAt": null,
      },
      $inc: {
        "masterFileSync.attempts": 1,
      },
    },
    { timestamps: false },
  );

  if (!lock.modifiedCount) {
    throw createHttpError(
      409,
      "La actualizacion del archivo madre ya esta en proceso.",
      { code: "MASTER_SYNC_ALREADY_IN_PROGRESS" },
    );
  }

  let result;
  try {
    result = await masterFileService.applyPreparedAdminFileMasterSync({
      preparedSync,
      user,
      auditContext: {
        adminDocumentId: id,
        adminFileName,
        sftpRemoteFileName,
      },
    });
  } catch (error) {
    try {
      await markMasterFileSyncFailed({
        model,
        id,
        message: getPublicMasterFileSyncErrorMessage(error),
        userId,
      });
    } catch {
      console.error("[MF] No se guardo el estado fallido.", {
        documentId: String(id),
        documentType,
        code: "MASTER_SYNC_STATUS_PERSIST_FAILED",
      });
    }
    throw error;
  }

  const appliedAt = new Date();
  const statusUpdate = await model.updateOne(
    {
      _id: id,
      "masterFileSync.status": "applying",
    },
    {
      $set: {
        "masterFileSync.status": "applied",
        "masterFileSync.appliedAt": appliedAt,
        "masterFileSync.lastError": "",
        "masterFileSync.masterFileId": result.masterFileId,
        "masterFileSync.masterFileName": result.masterFileName,
        "masterFileSync.auditId": result.auditId,
        "masterFileSync.summary": {
          total: result.total,
          added: result.added,
          updated: result.updated,
          unchanged: result.unchanged,
        },
      },
    },
    { timestamps: false },
  );

  if (!statusUpdate.modifiedCount) {
    throw createHttpError(
      500,
      "El archivo madre se actualizo, pero no se pudo guardar el estado MF.",
      { code: "MASTER_SYNC_STATUS_PERSIST_FAILED" },
    );
  }

  return result;
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
    masterFileSync: {
      status: getDefaultMasterFileSyncStatus(documentType),
    },
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
    });

    const { convertedFilePath, errorReportPath, status } =
      await fileConversionService.processFileForConversion(
        fileBuffer, // Use the buffer we already read
        originalname,
        outputFormat,
        conversionOptions
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
      assertUserCanAccessConversionJob(job, req.user);
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
      assertUserCanAccessConversionJob(job, req.user);
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
    rowValidation: validationResult.rowValidation || [],
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
    let rowValidation = [];

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

      rowValidation =
        validationResult.rowValidation || [];
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
      rowValidation,
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
      "adminFileName lastDownloadedName site createdBy updatedBy createdAt updatedAt sftpDelivery masterFileSync";
    const docs = await model
      .find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .select(selectFields)
      .populate("createdBy", "displayName email")
      .populate("updatedBy", "displayName email")
      .populate("sftpDelivery.lastAttemptBy", "displayName email")
      .populate("sftpDelivery.lastDryRunBy", "displayName email")
      .populate("masterFileSync.lastAttemptBy", "displayName email")
      .lean();

    return res.status(200).json({
      documents: docs.map((doc) =>
        toPublicAdminFileDocument(doc, type)
      ),
    });
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

    return res.status(200).json({
      document: toPublicAdminFileDocument(doc, type),
    });
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

const sendAdminFileViaSftp = async (req, res) => {
  const { id } = req.params;
  const { type } = req.query || {};
  const { site, dryRun } = req.body || {};
  const isDryRun = dryRun === true || dryRun === "true";
  let model;
  let document;
  let targetSite = "";
  let activeOperationId = "";
  let stopLeaseHeartbeat = () => {};

  try {
    ({ model, doc: document } = await getAdminFileDocumentOrThrow({
      id,
      type,
      user: req.user,
    }));

    targetSite = resolveSftpTargetSite({
      user: req.user,
      documentSite: document.site,
      requestedSite: site,
    });

    const configuration =
      siteSftpService.validateSiteConfiguration(targetSite);
    if (!configuration.valid) {
      return res.status(503).json({
        message: "La configuracion SFTP de la sede esta incompleta.",
        code: "SFTP_CONFIGURATION_INCOMPLETE",
        dryRun: isDryRun,
        document: await getSftpDocumentSummary(model, id),
      });
    }

    if (isSftpOperationInProgress(document)) {
      return res.status(409).json({
        message: "El archivo ya tiene un envio SFTP en proceso.",
        code: "SFTP_ALREADY_IN_PROGRESS",
        dryRun: isDryRun,
        document: await getSftpDocumentSummary(model, id),
      });
    }

    if (isMasterFileSyncInProgress(document)) {
      return res.status(409).json({
        message: "El archivo ya tiene una actualizacion MF en proceso.",
        code: "MASTER_SYNC_ALREADY_IN_PROGRESS",
        dryRun: isDryRun,
        document: await getSftpDocumentSummary(model, id),
      });
    }

    const userId = req.user?.id || req.user?._id;
    const attemptDate = new Date();

    if (isDryRun) {
      let simulation;
      try {
        simulation = await siteSftpService.testSiteConnection(targetSite);
      } catch (error) {
        const publicError = siteSftpService.sanitizeSftpError(error);

        try {
          await model.updateOne(
            { _id: id },
            {
              $set: {
                "sftpDelivery.lastDryRunAt": attemptDate,
                "sftpDelivery.lastDryRunBy": userId,
                "sftpDelivery.lastDryRunSite": targetSite,
                "sftpDelivery.lastDryRunSucceeded": false,
                "sftpDelivery.lastDryRunError": sanitizeStoredSftpError(
                  publicError.message,
                ),
              },
            },
            { timestamps: false },
          );
        } catch {
          console.error("[SFTP] No se guardo la simulacion fallida.", {
            documentId: String(id),
            documentType: type,
            site: targetSite,
            code: "SFTP_AUDIT_PERSIST_FAILED",
          });
        }

        console.warn("[SFTP] Simulacion fallida.", {
          documentId: String(id),
          documentType: type,
          site: targetSite,
          code: publicError.code,
        });

        let failedDocument = null;
        try {
          failedDocument = await getSftpDocumentSummary(model, id);
        } catch {
          // The connection result remains the primary error.
        }

        return res.status(502).json({
          message: publicError.message,
          code: publicError.code,
          dryRun: true,
          document: failedDocument,
        });
      }

      await model.updateOne(
        { _id: id },
        {
          $set: {
            "sftpDelivery.lastDryRunAt": attemptDate,
            "sftpDelivery.lastDryRunBy": userId,
            "sftpDelivery.lastDryRunSite": targetSite,
            "sftpDelivery.lastDryRunSucceeded": true,
            "sftpDelivery.lastDryRunError": "",
          },
        },
        { timestamps: false },
      );

      console.info("[SFTP] Simulacion completada.", {
        documentId: String(id),
        documentType: type,
        site: targetSite,
      });

      let simulatedDocument = null;
      try {
        simulatedDocument = await getSftpDocumentSummary(model, id);
      } catch {
        console.warn("[SFTP] No se pudo recargar la simulacion.", {
          documentId: String(id),
          documentType: type,
          site: targetSite,
          code: "SFTP_AUDIT_READ_FAILED",
        });
      }

      return res.status(200).json({
        message: "Simulacion SFTP completada correctamente.",
        dryRun: true,
        remoteDirectoryExists: simulation.remoteDirectoryExists,
        connectionAttempts: simulation.connectionAttempts,
        document: simulatedDocument,
      });
    }

    if (toPlainObject(document.sftpDelivery).status === "sent") {
      return res.status(409).json({
        message:
          "El archivo ya fue enviado. Debes editarlo antes de generar un nuevo envio.",
        code: "SFTP_ALREADY_SENT_NO_CHANGES",
        dryRun: false,
        document: await getSftpDocumentSummary(model, id),
      });
    }

    if (!Array.isArray(document.rows) || !document.rows.length) {
      return res.status(409).json({
        message: "No hay filas para enviar.",
        code: "ADMIN_FILE_EMPTY",
        dryRun: false,
        document: await getSftpDocumentSummary(model, id),
      });
    }

    const lockTimeoutMs = getSftpLockTimeoutMs();
    activeOperationId = createSftpOperationId();
    const availableFilter = createSftpSendAcquisitionFilter({
      id,
      timeoutMs: lockTimeoutMs,
      now: attemptDate,
    });
    const lockedDocument = await model.findOneAndUpdate(
      availableFilter,
      {
        $set: {
          "sftpDelivery.status": "pending",
          "sftpDelivery.lastAttemptAt": attemptDate,
          "sftpDelivery.lastAttemptBy": userId,
          "sftpDelivery.operationId": activeOperationId,
          "sftpDelivery.lockExpiresAt": getSftpLeaseExpiry(
            lockTimeoutMs,
            attemptDate,
          ),
          "sftpDelivery.lastError": "",
          "sftpDelivery.sentAt": null,
          "sftpDelivery.remoteFileName": null,
          ...(type === "splScrap"
            ? {}
            : {
                "masterFileSync.status": "pending",
                "masterFileSync.lastError": "",
                "masterFileSync.appliedAt": null,
                "masterFileSync.masterFileId": null,
                "masterFileSync.masterFileName": "",
                "masterFileSync.auditId": null,
                "masterFileSync.summary": {
                  total: 0,
                  added: 0,
                  updated: 0,
                  unchanged: 0,
                },
              }),
        },
        $inc: {
          "sftpDelivery.attempts": 1,
        },
      },
      {
        new: false,
        timestamps: false,
      },
    ).select("+sftpDelivery.remotePath");

    if (!lockedDocument) {
      activeOperationId = "";
      return res.status(409).json({
        message: "El archivo ya tiene un envio SFTP en proceso.",
        code: "SFTP_ALREADY_IN_PROGRESS",
        dryRun: false,
        document: await getSftpDocumentSummary(model, id),
      });
    }

    stopLeaseHeartbeat = startSftpLeaseHeartbeat({
      model,
      id,
      operationId: activeOperationId,
    });

    const previousDelivery = toPlainObject(lockedDocument.sftpDelivery);
    const previousRemotePath = previousDelivery.remotePath || "";
    const previousRemoteSite =
      normalizeSftpSite(previousDelivery.site) || targetSite;

    let preparedFile;
    try {
      preparedFile = await prepareAdminFileForSftp(
        lockedDocument,
        type,
      );
    } catch (error) {
      const statusCode = error.statusCode || 500;
      const publicMessage =
        statusCode < 500
          ? error.message
          : "No se pudo generar el archivo para enviar.";

      await markSftpOperationFailed({
        model,
        id,
        operationId: activeOperationId,
        message: publicMessage,
      });

      console.warn("[SFTP] No se genero el archivo.", {
        documentId: String(id),
        documentType: type,
        site: targetSite,
        code: error.code || "ADMIN_FILE_EXPORT_FAILED",
      });

      return res.status(statusCode).json({
        message: publicMessage,
        code: error.code || "ADMIN_FILE_EXPORT_FAILED",
        dryRun: false,
        document: await getSftpDocumentSummary(model, id),
      });
    }

    let preparedMasterSync;
    try {
      preparedMasterSync =
        await masterFileService.prepareAdminFileMasterSync({
          documentType: type,
          rows: lockedDocument.rows,
          site: targetSite,
          user: req.user,
        });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      const publicMessage =
        statusCode < 500
          ? error.message
          : "No se pudo preparar la actualizacion del archivo madre.";

      await markSftpOperationFailed({
        model,
        id,
        operationId: activeOperationId,
        message: publicMessage,
      });

      if (type !== "splScrap") {
        try {
          await markMasterFileSyncFailed({
            model,
            id,
            message: publicMessage,
            userId,
            incrementAttempt: true,
          });
        } catch {
          console.error("[MF] No se guardo el error de preparacion.", {
            documentId: String(id),
            documentType: type,
            code: "MASTER_SYNC_STATUS_PERSIST_FAILED",
          });
        }
      }

      console.warn("[SFTP] No se preparo el archivo madre.", {
        documentId: String(id),
        documentType: type,
        site: targetSite,
        code: error.code || "MASTER_SYNC_PREPARATION_FAILED",
      });

      return res.status(statusCode).json({
        message: publicMessage,
        code: error.code || "MASTER_SYNC_PREPARATION_FAILED",
        dryRun: false,
        document: await getSftpDocumentSummary(model, id),
      });
    }

    const transition = await model.updateOne(
      createSftpOwnerFilter({
        id,
        operationId: activeOperationId,
        statuses: ["pending"],
      }),
      {
        $set: {
          "sftpDelivery.status": "sending",
          "sftpDelivery.lockExpiresAt": getSftpLeaseExpiry(lockTimeoutMs),
        },
      },
      { timestamps: false },
    );

    if (!transition.modifiedCount) {
      return res.status(409).json({
        message: "El estado del envio cambio antes de transferir el archivo.",
        code: "SFTP_STATUS_CONFLICT",
        dryRun: false,
        document: await getSftpDocumentSummary(model, id),
      });
    }

    let uploadResult;
    try {
      uploadResult = await siteSftpService.uploadFileForSite({
        site: targetSite,
        localPath: preparedFile.localPath,
        fileName: preparedFile.fileName,
      });
    } catch (error) {
      const publicError = siteSftpService.sanitizeSftpError(error);

      await markSftpOperationFailed({
        model,
        id,
        operationId: activeOperationId,
        message: publicError.message,
      });

      console.warn("[SFTP] Envio fallido.", {
        documentId: String(id),
        documentType: type,
        site: targetSite,
        code: publicError.code,
      });

      return res.status(502).json({
        message: publicError.message,
        code: publicError.code,
        dryRun: false,
        document: await getSftpDocumentSummary(model, id),
      });
    }

    const previousRemoteMustBeRemoved = shouldDeletePreviousRemoteFile({
      previousSite: previousRemoteSite,
      previousPath: previousRemotePath,
      nextSite: targetSite,
      nextPath: uploadResult.remotePath,
    });
    if (previousRemoteMustBeRemoved) {
      try {
        await siteSftpService.deleteRemoteFileForSite({
          site: previousRemoteSite,
          remotePath: previousRemotePath,
        });
      } catch (error) {
        const message =
          "La nueva version fue transferida, pero no se pudo eliminar el archivo remoto anterior.";
        await markSftpOperationFailed({
          model,
          id,
          operationId: activeOperationId,
          message,
        });
        console.error("[SFTP] No se elimino la version remota anterior.", {
          documentId: String(id),
          documentType: type,
          site: previousRemoteSite,
          code: error.code || "SFTP_PREVIOUS_REMOTE_DELETE_FAILED",
        });
        return res.status(502).json({
          message,
          code: "SFTP_PREVIOUS_REMOTE_DELETE_FAILED",
          dryRun: false,
          transferCompleted: true,
          previousFileDeleted: false,
          document: await getSftpDocumentSummary(model, id),
        });
      }
    }

    const sentAt = new Date();
    const sentDelivery = {
      status: "sent",
      site: targetSite,
      attempts:
        (Number(previousDelivery.attempts) || 0) + 1,
      lastAttemptAt: attemptDate,
      sentAt,
      lastAttemptBy: userId,
      lastError: "",
      remoteFileName: uploadResult.remoteFileName,
    };

    let sentStateUpdate;
    try {
      sentStateUpdate = await model.updateOne(
        createSftpOwnerFilter({
          id,
          operationId: activeOperationId,
          statuses: ["sending"],
        }),
        {
          $set: {
            "sftpDelivery.status": "sent",
            "sftpDelivery.site": targetSite,
            "sftpDelivery.sentAt": sentAt,
            "sftpDelivery.lastError": "",
            "sftpDelivery.remoteFileName": uploadResult.remoteFileName,
            "sftpDelivery.remotePath": uploadResult.remotePath,
          },
          $unset: {
            "sftpDelivery.operationId": "",
            "sftpDelivery.lockExpiresAt": "",
          },
        },
        { timestamps: false },
      );
    } catch (error) {
      console.error("[SFTP] El archivo fue transferido sin guardar auditoria.", {
        documentId: String(id),
        documentType: type,
        site: targetSite,
        code: "SFTP_AUDIT_PERSIST_FAILED",
      });

      return res.status(500).json({
        message:
          "El archivo fue transferido, pero no se pudo guardar su estado. No lo reintentes hasta revisar la auditoria.",
        code: "SFTP_AUDIT_PERSIST_FAILED",
        dryRun: false,
        transferCompleted: true,
        sftpDelivery: sentDelivery,
      });
    }

    if (sentStateUpdate.matchedCount !== 1) {
      console.error("[SFTP] El intento perdio la propiedad del lease.", {
        documentId: String(id),
        documentType: type,
        site: targetSite,
        code: "SFTP_OPERATION_SUPERSEDED",
      });
      return res.status(409).json({
        message:
          "El archivo fue transferido, pero otro intento reemplazo este envio. Revisa el estado antes de reintentar.",
        code: "SFTP_OPERATION_SUPERSEDED",
        dryRun: false,
        transferCompleted: true,
        document: await getSftpDocumentSummary(model, id),
      });
    }
    activeOperationId = "";

    let masterFileUpdate;
    try {
      masterFileUpdate =
        await applyPreparedMasterSyncForAdminDocument({
          model,
          id,
          documentType: type,
          preparedSync: preparedMasterSync,
          user: req.user,
          adminFileName: lockedDocument.adminFileName,
          sftpRemoteFileName: uploadResult.remoteFileName,
        });
    } catch (error) {
      const statusCode =
        Number.isInteger(error.statusCode) &&
        error.statusCode >= 400 &&
        error.statusCode < 500
          ? error.statusCode
          : 500;
      let responseDocument = null;

      try {
        responseDocument = await getSftpDocumentSummary(model, id);
      } catch {
        // The transfer and master file error remain the primary result.
      }

      if (type !== "splScrap") {
        try {
          await markMasterFileSyncFailed({
            model,
            id,
            message: getPublicMasterFileSyncErrorMessage(error),
            userId,
          });
          responseDocument = await getSftpDocumentSummary(model, id);
        } catch {
          // The transfer and original master file error remain primary.
        }
      }

      console.error(
        "[SFTP] Archivo enviado sin actualizar el archivo madre.",
        {
          documentId: String(id),
          documentType: type,
          site: targetSite,
          code: error.code || "MASTER_SYNC_FAILED",
        },
      );

      return res.status(statusCode).json({
        message:
          "El archivo fue enviado por SFTP, pero no se pudo actualizar el archivo madre. No lo reenvies hasta revisar el error.",
        code: error.code || "MASTER_SYNC_FAILED",
        dryRun: false,
        transferCompleted: true,
        masterFileUpdateCompleted: false,
        sftpDelivery: sentDelivery,
        document: responseDocument,
      });
    }

    console.info("[SFTP] Archivo enviado.", {
      documentId: String(id),
      documentType: type,
      site: targetSite,
      masterFileUpdate:
        masterFileUpdate?.required
          ? {
              masterFileId: masterFileUpdate.masterFileId,
              added: masterFileUpdate.added,
              updated: masterFileUpdate.updated,
              unchanged: masterFileUpdate.unchanged,
            }
          : null,
    });

    let responseDocument = null;
    try {
      responseDocument = await getSftpDocumentSummary(model, id);
    } catch {
      console.warn("[SFTP] No se pudo recargar la auditoria enviada.", {
        documentId: String(id),
        documentType: type,
        site: targetSite,
        code: "SFTP_AUDIT_READ_FAILED",
      });
    }

    const successMessage = masterFileUpdate?.required
      ? `Archivo enviado por SFTP correctamente. Archivo madre actualizado: ${masterFileUpdate.added} agregados, ${masterFileUpdate.updated} actualizados y ${masterFileUpdate.unchanged} sin cambios.`
      : "Archivo enviado por SFTP correctamente.";

    return res.status(200).json({
      message: successMessage,
      dryRun: false,
      connectionAttempts: uploadResult.connectionAttempts,
      sftpDelivery: sentDelivery,
      masterFileUpdate,
      document: responseDocument,
    });
  } catch (error) {
    if (model && id && activeOperationId) {
      try {
        await markSftpOperationFailed({
          model,
          id,
          operationId: activeOperationId,
          message: error.message,
        });
      } catch {
        // The original request error remains primary.
      }
    }
    const statusCode = error.statusCode || 500;
    const publicMessage =
      statusCode < 500
        ? error.message
        : "Error interno al procesar el envio SFTP.";

    console.warn("[SFTP] Solicitud rechazada.", {
      documentId: String(id || ""),
      documentType: type || "",
      site: targetSite || "",
      code: error.code || "SFTP_REQUEST_FAILED",
    });

    return res.status(statusCode).json({
      message: publicMessage,
      code: error.code || "SFTP_REQUEST_FAILED",
      dryRun: isDryRun,
    });
  } finally {
    stopLeaseHeartbeat();
  }
};

const getAdminFileMasterSyncAudits = async (req, res) => {
  const { id } = req.params;
  const { type } = req.query || {};

  try {
    const { doc } = await getAdminFileDocumentOrThrow({
      id,
      type,
      user: req.user,
      lean: true,
    });
    const audits =
      await masterFileService.listAdminFileMasterSyncAudits({
        adminDocumentId: id,
        documentType: type,
        user: req.user,
        limit: req.query.limit,
      });

    return res.status(200).json({
      masterFileSync: toPublicMasterFileSync(
        doc.masterFileSync,
        type,
      ),
      audits,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "No se pudo consultar la auditoria MF.",
      code: error.code || "MASTER_SYNC_AUDIT_READ_FAILED",
    });
  }
};

const getAdminFileMasterSyncAuditDetails = async (req, res) => {
  const { id, auditId } = req.params;
  const { type } = req.query || {};

  try {
    await getAdminFileDocumentOrThrow({
      id,
      type,
      user: req.user,
      lean: true,
    });
    const result =
      await masterFileService.getAdminFileMasterSyncAuditDetails({
        auditId,
        adminDocumentId: id,
        documentType: type,
        user: req.user,
      });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "No se pudo consultar el detalle de auditoria MF.",
      code: error.code || "MASTER_SYNC_AUDIT_DETAIL_FAILED",
    });
  }
};

const retryAdminFileMasterSync = async (req, res) => {
  const { id } = req.params;
  const { type } = req.query || {};

  if (type === "splScrap") {
    return res.status(409).json({
      message: "Packing List no actualiza archivos madre.",
      code: "MASTER_SYNC_NOT_APPLICABLE",
    });
  }

  try {
    const { model, doc } = await getAdminFileDocumentOrThrow({
      id,
      type,
      user: req.user,
    });
    const delivery = toPlainObject(doc.sftpDelivery);
    const sync = toPublicMasterFileSync(doc.masterFileSync, type);

    if (delivery.status !== "sent") {
      throw createHttpError(
        409,
        "El archivo no tiene un envio SFTP exitoso para reutilizar.",
        { code: "MASTER_SYNC_SFTP_NOT_SENT" },
      );
    }

    if (sync.status === "applying") {
      throw createHttpError(
        409,
        "La actualizacion del archivo madre ya esta en proceso.",
        { code: "MASTER_SYNC_ALREADY_IN_PROGRESS" },
      );
    }

    if (sync.status === "applied") {
      throw createHttpError(
        409,
        "La actualizacion del archivo madre ya fue aplicada.",
        { code: "MASTER_SYNC_ALREADY_APPLIED" },
      );
    }

    const targetSite = normalizeSftpSite(
      delivery.site || doc.site,
    );
    let preparedSync;

    try {
      preparedSync =
        await masterFileService.prepareAdminFileMasterSync({
          documentType: type,
          rows: doc.rows,
          site: targetSite,
          user: req.user,
        });
    } catch (error) {
      await markMasterFileSyncFailed({
        model,
        id,
        message: getPublicMasterFileSyncErrorMessage(error),
        userId: req.user?.id || req.user?._id,
        incrementAttempt: true,
      });
      throw error;
    }

    const masterFileUpdate =
      await applyPreparedMasterSyncForAdminDocument({
        model,
        id,
        documentType: type,
        preparedSync,
        user: req.user,
        adminFileName: doc.adminFileName,
        sftpRemoteFileName: delivery.remoteFileName,
      });
    const responseDocument =
      await getSftpDocumentSummary(model, id);

    return res.status(200).json({
      message: `Archivo madre actualizado: ${masterFileUpdate.added} agregados, ${masterFileUpdate.updated} actualizados y ${masterFileUpdate.unchanged} sin cambios.`,
      masterFileUpdate,
      document: responseDocument,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message:
        statusCode < 500
          ? error.message
          : "No se pudo reintentar la actualizacion del archivo madre.",
      code: error.code || "MASTER_SYNC_RETRY_FAILED",
      document: await (async () => {
        try {
          const model = getAdminFileModelByType(type);
          return model
            ? await getSftpDocumentSummary(model, id)
            : null;
        } catch {
          return null;
        }
      })(),
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
    const { model, doc } = await getAdminFileDocumentOrThrow({
      id,
      type,
      user: req.user,
    });

    if (isSftpOperationInProgress(doc)) {
      return res.status(409).json({
        message: "No puedes actualizar el archivo durante un envio SFTP.",
        code: "SFTP_ALREADY_IN_PROGRESS",
      });
    }

    if (isMasterFileSyncInProgress(doc)) {
      return res.status(409).json({
        message: "No puedes actualizar el archivo durante una actualizacion MF.",
        code: "MASTER_SYNC_ALREADY_IN_PROGRESS",
      });
    }

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

    const transformedRows = Array.isArray(
      validationResult.transformedData.Sheet1,
    )
      ? validationResult.transformedData.Sheet1
      : [];
    const updateFilter = createSftpAvailableFilter({
      id,
      timeoutMs: getSftpLockTimeoutMs(),
    });
    updateFilter["masterFileSync.status"] = { $ne: "applying" };
    const updatedDocument = await model.findOneAndUpdate(
      updateFilter,
      {
        $set: {
          adminFileName: nextAdminFileName || doc.adminFileName,
          site: scopedSite,
          rows: transformedRows,
          lastDownloadedName: generateAdminFileNomenclature(
            type,
            transformedRows,
          ),
          updatedBy: req.user.id,
          "sftpDelivery.status": "not_sent",
          "sftpDelivery.lastError": "",
          "masterFileSync.status": getDefaultMasterFileSyncStatus(type),
          "masterFileSync.attempts": 0,
          "masterFileSync.lastError": "",
          "masterFileSync.masterFileName": "",
          "masterFileSync.summary": {
            total: 0,
            added: 0,
            updated: 0,
            unchanged: 0,
          },
        },
        $unset: {
          "sftpDelivery.sentAt": "",
          "sftpDelivery.remoteFileName": "",
          "sftpDelivery.operationId": "",
          "sftpDelivery.lockExpiresAt": "",
          "masterFileSync.lastAttemptAt": "",
          "masterFileSync.appliedAt": "",
          "masterFileSync.lastAttemptBy": "",
          "masterFileSync.masterFileId": "",
          "masterFileSync.auditId": "",
        },
      },
      { new: true, runValidators: true },
    );

    if (!updatedDocument) {
      return res.status(409).json({
        message:
          "El archivo inicio otra operacion antes de guardar los cambios. Actualiza su estado e intenta nuevamente.",
        code: "ADMIN_FILE_OPERATION_CONFLICT",
      });
    }

    return res.status(200).json({
      message: "Archivo actualizado.",
      updatedAt: updatedDocument.updatedAt,
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
    const { model, doc } = await getAdminFileDocumentOrThrow({
      id,
      type,
      user: req.user,
    });

    if (isSftpOperationInProgress(doc)) {
      return res.status(409).json({
        message: "No puedes eliminar el archivo durante un envio SFTP.",
        code: "SFTP_ALREADY_IN_PROGRESS",
      });
    }

    if (isMasterFileSyncInProgress(doc)) {
      return res.status(409).json({
        message: "No puedes eliminar el archivo durante una actualizacion MF.",
        code: "MASTER_SYNC_ALREADY_IN_PROGRESS",
      });
    }

    const deleteFilter = createSftpAvailableFilter({
      id,
      timeoutMs: getSftpLockTimeoutMs(),
    });
    deleteFilter["masterFileSync.status"] = { $ne: "applying" };
    const deleteResult = await model.deleteOne(deleteFilter);
    if (deleteResult.deletedCount !== 1) {
      return res.status(409).json({
        message:
          "El archivo inicio otra operacion antes de poder eliminarse. Actualiza su estado e intenta nuevamente.",
        code: "ADMIN_FILE_OPERATION_CONFLICT",
      });
    }
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
  sendAdminFileViaSftp,
  getAdminFileMasterSyncAudits,
  getAdminFileMasterSyncAuditDetails,
  retryAdminFileMasterSync,
  copyAdminFileById,
  updateAdminFileById,
  deleteAdminFileById,
  importManualFile,
};
