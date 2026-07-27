// services/masterFileService.js
const path = require("path");
const mongoose = require("mongoose");
const masterFileRepository = require(
  "../repositories/masterFileRepository"
);
const {
  parseMasterFileBuffer,
} = require("../utils/masterFileParser");
const {
  createMasterFileWorkbook,
} = require(
  "../utils/masterFileExporter"
);

const VALID_MASTER_SITES = [
  "gaiim",
  "p1a",
];

/**
 * Genera errores que posteriormente podrá interpretar
 * el controlador para devolver el código HTTP correcto.
 */
const createMasterServiceError = (
  code,
  message,
  statusCode = 400,
) => {
  const error = new Error(message);

  error.code = code;
  error.statusCode = statusCode;

  return error;
};

/**
 * Normaliza la selección de sedes.
 *
 * Acepta:
 * "gaiim"
 * ["gaiim", "p1a"]
 * "gaiim,p1a"
 */
const normalizeMasterSites = (sites) => {
  const receivedSites = Array.isArray(sites)
    ? sites
    : [sites];

  const normalizedSites = [
    ...new Set(
      receivedSites
        .flatMap((site) =>
          String(site || "").split(",")
        )
        .map((site) =>
          site.trim().toLowerCase()
        )
        .filter(Boolean),
    ),
  ];

  if (normalizedSites.length === 0) {
    throw createMasterServiceError(
      "MASTER_SITES_REQUIRED",
      "Debes seleccionar al menos una sede.",
    );
  }

  const invalidSites = normalizedSites.filter(
    (site) =>
      !VALID_MASTER_SITES.includes(site),
  );

  if (invalidSites.length > 0) {
    throw createMasterServiceError(
      "MASTER_SITE_INVALID",
      `Las siguientes sedes no son válidas: ${invalidSites.join(
        ", ",
      )}.`,
    );
  }

  // Mantiene siempre el mismo orden.
  return VALID_MASTER_SITES.filter((site) =>
    normalizedSites.includes(site)
  );
};

/**
 * Obtiene y valida el ID del administrador.
 */
const getAdminUserId = (user) => {
  if (!user) {
    throw createMasterServiceError(
      "MASTER_AUTH_REQUIRED",
      "Debes iniciar sesión para cargar archivos madre.",
      401,
    );
  }

  if (user.role !== "admin") {
    throw createMasterServiceError(
      "MASTER_ADMIN_REQUIRED",
      "Solo un administrador puede cargar archivos madre.",
      403,
    );
  }

  if (user.isActive !== true) {
    throw createMasterServiceError(
      "MASTER_ADMIN_INACTIVE",
      "La cuenta del administrador no está activa.",
      403,
    );
  }

  const userId = user._id || user.id;

  if (
    !userId ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    throw createMasterServiceError(
      "MASTER_USER_ID_INVALID",
      "El usuario autenticado no tiene un ID válido.",
      401,
    );
  }

  return userId;
};

/**
 * Consulta los archivos disponibles según el usuario.
 * Administrador:
 * puede consultar todas las sedes o filtrar una.
 * Usuario:
 * solamente puede consultar su sede asignada.
 */
const listMasterFiles = async ({
  user,
  requestedSite,
  limit,
}) => {
  if (!user) {
    throw createMasterServiceError(
      "MASTER_AUTH_REQUIRED",
      "Debes iniciar sesión para consultar archivos madre.",
      401,
    );
  }

  if (user.isActive !== true) {
    throw createMasterServiceError(
      "MASTER_USER_INACTIVE",
      "La cuenta no está activa.",
      403,
    );
  }

  const filter = {
    status: "ready",
  };

  if (user.role === "admin") {
    const normalizedRequestedSite = String(
      requestedSite || "",
    )
      .trim()
      .toLowerCase();

    if (
      normalizedRequestedSite &&
      !VALID_MASTER_SITES.includes(
        normalizedRequestedSite,
      )
    ) {
      throw createMasterServiceError(
        "MASTER_SITE_INVALID",
        "La sede solicitada no es válida.",
      );
    }

    if (normalizedRequestedSite) {
      filter.sites =
        normalizedRequestedSite;
    }
  } else if (user.role === "user") {
    const userSite = String(
      user.site || "",
    )
      .trim()
      .toLowerCase();

    if (
      !VALID_MASTER_SITES.includes(
        userSite,
      )
    ) {
      throw createMasterServiceError(
        "MASTER_USER_SITE_REQUIRED",
        "El usuario no tiene una sede válida asignada.",
        403,
      );
    }

    filter.sites = userSite;
  } else {
    throw createMasterServiceError(
      "MASTER_ROLE_INVALID",
      "El usuario no tiene un rol válido.",
      403,
    );
  }

  const parsedLimit = Number.parseInt(
    limit,
    10,
  );

  const safeLimit = Number.isFinite(
    parsedLimit,
  )
    ? Math.min(
        Math.max(parsedLimit, 1),
        500,
      )
    : 200;

  return masterFileRepository.findMasterFiles({
    filter,
    limit: safeLimit,
  });
};

/**
 * Importa un archivo madre completo.
 */
const importMasterFile = async ({
  fileBuffer,
  originalFileName,
  name,
  expectedMasterType,
  sites,
  user,
}) => {
  const adminUserId = getAdminUserId(user);

  const normalizedSites =
    normalizeMasterSites(sites);

  const safeOriginalFileName = path.basename(
    String(originalFileName || "").trim(),
  );

  if (!safeOriginalFileName) {
    throw createMasterServiceError(
      "MASTER_FILE_NAME_REQUIRED",
      "El archivo madre debe tener un nombre.",
    );
  }

  const masterFileName =
    String(name || "").trim() ||
    safeOriginalFileName;

  /*
   * Leer y validar el Excel antes de abrir la
   * transacción evita mantenerla activa innecesariamente.
   */
  let parsedMasterFile;

  try {
    parsedMasterFile =
      await parseMasterFileBuffer(
        fileBuffer,
        {
          originalFileName:
            safeOriginalFileName,

          expectedMasterType:
            expectedMasterType || undefined,
        },
      );
  } catch (error) {
    /*
     * Los errores producidos por el parser son errores
     * de archivo y deben responder posteriormente como 400.
     */
    if (!error.statusCode) {
      error.statusCode = 400;
    }

    throw error;
  }

  const {
    metadata,
    records,
  } = parsedMasterFile;

  const session =
    await mongoose.startSession();

  let importedMasterFile = null;
  let insertedRecordCount = 0;

  try {
    await session.withTransaction(
      async () => {
        const createdMasterFile =
          await masterFileRepository
            .createMasterFile(
              {
                ...metadata,

                name: masterFileName,
                originalFileName:
                  safeOriginalFileName,

                sites: normalizedSites,

                status: "processing",

                uploadedBy:
                  adminUserId,

                updatedBy:
                  adminUserId,
              },
              session,
            );

        const masterRecords =
          records.map((record) => ({
            ...record,

            masterFileId:
              createdMasterFile._id,

            sites: normalizedSites,

            createdBy:
              adminUserId,

            updatedBy:
              adminUserId,
          }));

        const insertedRecords =
          await masterFileRepository
            .insertMasterRecords(
              masterRecords,
              session,
            );

        insertedRecordCount =
          insertedRecords.length;

        if (
          insertedRecordCount !==
          records.length
        ) {
          throw createMasterServiceError(
            "MASTER_RECORD_COUNT_MISMATCH",
            "No se insertaron todos los registros del archivo madre.",
            500,
          );
        }

        importedMasterFile =
          await masterFileRepository
            .updateMasterFileById(
              createdMasterFile._id,
              {
                status: "ready",

                recordCount:
                  insertedRecordCount,

                lastImportedAt:
                  new Date(),

                updatedBy:
                  adminUserId,
              },
              session,
            );

        if (!importedMasterFile) {
          throw createMasterServiceError(
            "MASTER_FILE_UPDATE_FAILED",
            "No fue posible finalizar la importación del archivo madre.",
            500,
          );
        }
      },
    );
  } finally {
    await session.endSession();
  }

  if (!importedMasterFile) {
    throw createMasterServiceError(
      "MASTER_IMPORT_NOT_COMPLETED",
      "La importación del archivo madre no pudo completarse.",
      500,
    );
  }

  return {
    masterFile:
      importedMasterFile,

    insertedRecordCount,

    warnings:
      metadata.importWarnings || [],
  };
};

/**
 * Verifica que el usuario pueda consultar el archivo.
 */
const assertMasterFileAccess = (
  masterFile,
  user,
) => {
  if (!user) {
    throw createMasterServiceError(
      "MASTER_AUTH_REQUIRED",
      "Debes iniciar sesión para descargar archivos madre.",
      401,
    );
  }

  if (user.isActive !== true) {
    throw createMasterServiceError(
      "MASTER_USER_INACTIVE",
      "La cuenta no está activa.",
      403,
    );
  }

  if (user.role === "admin") {
    return;
  }

  if (user.role !== "user") {
    throw createMasterServiceError(
      "MASTER_ROLE_INVALID",
      "El usuario no tiene un rol válido.",
      403,
    );
  }

  const userSite = String(
    user.site || "",
  )
    .trim()
    .toLowerCase();

  if (
    !VALID_MASTER_SITES.includes(
      userSite,
    )
  ) {
    throw createMasterServiceError(
      "MASTER_USER_SITE_REQUIRED",
      "El usuario no tiene una sede válida asignada.",
      403,
    );
  }

  const masterFileSites =
    Array.isArray(masterFile.sites)
      ? masterFile.sites.map((site) =>
          String(site)
            .trim()
            .toLowerCase(),
        )
      : [];

  if (
    !masterFileSites.includes(
      userSite,
    )
  ) {
    throw createMasterServiceError(
      "MASTER_FILE_ACCESS_DENIED",
      "El archivo madre no pertenece a la sede del usuario.",
      403,
    );
  }
};

/**
 * Construye la descarga del archivo madre.
 */
const downloadMasterFile = async ({
  masterFileId,
  user,
}) => {
  if (
    !masterFileId ||
    !mongoose.Types.ObjectId.isValid(
      masterFileId,
    )
  ) {
    throw createMasterServiceError(
      "MASTER_FILE_ID_INVALID",
      "El identificador del archivo madre no es válido.",
    );
  }

  const masterFile =
    await masterFileRepository
      .findMasterFileById(
        masterFileId,
      );

  if (!masterFile) {
    throw createMasterServiceError(
      "MASTER_FILE_NOT_FOUND",
      "El archivo madre no existe.",
      404,
    );
  }

  assertMasterFileAccess(
    masterFile,
    user,
  );

  if (masterFile.status !== "ready") {
    throw createMasterServiceError(
      "MASTER_FILE_NOT_READY",
      "El archivo madre todavía no está disponible.",
      409,
    );
  }

  const records =
    await masterFileRepository
      .findActiveMasterRecordsByMasterFileId(
        masterFileId,
      );

  return createMasterFileWorkbook({
    masterFile,
    records,
  });
};

/**
 * Elimina un archivo madre y todos sus registros.
 *
 * La operación se realiza dentro de una transacción
 * para evitar que queden registros huérfanos.
 */
const deleteMasterFile = async ({
  masterFileId,
  user,
}) => {
  getAdminUserId(user);

  if (
    !masterFileId ||
    !mongoose.Types.ObjectId.isValid(
      masterFileId,
    )
  ) {
    throw createMasterServiceError(
      "MASTER_FILE_ID_INVALID",
      "El identificador del archivo madre no es válido.",
    );
  }

  const session =
    await mongoose.startSession();

  let deletionResult = null;

  try {
    await session.withTransaction(
      async () => {
        const masterFile =
          await masterFileRepository
            .findMasterFileById(
              masterFileId,
              session,
            );

        if (!masterFile) {
          throw createMasterServiceError(
            "MASTER_FILE_NOT_FOUND",
            "El archivo madre no existe.",
            404,
          );
        }

        const recordsDeletion =
          await masterFileRepository
            .deleteMasterRecordsByMasterFileId(
              masterFileId,
              session,
            );

        const fileDeletion =
          await masterFileRepository
            .deleteMasterFileById(
              masterFileId,
              session,
            );

        if (
          fileDeletion.deletedCount !== 1
        ) {
          throw createMasterServiceError(
            "MASTER_FILE_DELETE_FAILED",
            "No fue posible eliminar el archivo madre.",
            500,
          );
        }

        deletionResult = {
          id: masterFile._id,
          name: masterFile.name,
          deletedRecordCount:
            recordsDeletion.deletedCount || 0,
        };
      },
    );
  } finally {
    await session.endSession();
  }

  if (!deletionResult) {
    throw createMasterServiceError(
      "MASTER_DELETE_NOT_COMPLETED",
      "La eliminación no pudo completarse.",
      500,
    );
  }

  return deletionResult;
};

module.exports = {
  importMasterFile,
  normalizeMasterSites,
  listMasterFiles,
  downloadMasterFile,
  deleteMasterFile,

};