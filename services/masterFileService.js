// services/masterFileService.js
const path = require("path");
const mongoose = require("mongoose");
const masterFileRepository = require(
  "../repositories/masterFileRepository"
);
const {
  parseMasterFileBuffer,
  buildMasterRecordFromEditorRow,
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
 * Obtiene el ID de un administrador o usuario
 * autorizado para editar contenido.
 */
const getMasterEditorUserId = (
  user,
) => {
  if (!user) {
    throw createMasterServiceError(
      "MASTER_AUTH_REQUIRED",
      "Debes iniciar sesión para editar archivos madre.",
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

  if (
    !["admin", "user"].includes(
      user.role,
    )
  ) {
    throw createMasterServiceError(
      "MASTER_ROLE_INVALID",
      "El usuario no tiene permisos para editar archivos madre.",
      403,
    );
  }

  const userId =
    user._id || user.id;

  if (
    !userId ||
    !mongoose.Types.ObjectId.isValid(
      userId,
    )
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
 * Vuelve a calcular las advertencias por
 * Part Numbers repetidos después de editar.
 */
const applyEditorDuplicateWarnings = (
  records,
) => {
  const recordsByPartNumber =
    new Map();

  records.forEach((record) => {
    record.validationWarnings =
      Array.isArray(
        record.validationWarnings,
      )
        ? record.validationWarnings.filter(
            (warning) =>
              warning.code !==
              "DUPLICATE_PART_NUMBER",
          )
        : [];

    const partNumber =
      record.partNumberNormalized;

    if (
      !recordsByPartNumber.has(
        partNumber,
      )
    ) {
      recordsByPartNumber.set(
        partNumber,
        [],
      );
    }

    recordsByPartNumber
      .get(partNumber)
      .push(record);
  });

  for (const [
    partNumber,
    matches,
  ] of recordsByPartNumber) {
    if (matches.length < 2) {
      continue;
    }

    matches.forEach((record) => {
      record.validationWarnings.push({
        code:
          "DUPLICATE_PART_NUMBER",

        message:
          `El Part Number "${partNumber}" aparece ${matches.length} veces en el archivo.`,

        field:
          "Part Number",

        originalValue:
          record.partNumber,
      });
    });
  }
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
 * Obtiene los metadatos y registros de un archivo madre
 * para mostrarlos en el editor.
 */
const getMasterFileEditorData = async ({
  masterFileId,
  user,
}) => {
  if (
    !masterFileId ||
    !mongoose.Types.ObjectId.isValid(masterFileId)
  ) {
    throw createMasterServiceError(
      "MASTER_FILE_ID_INVALID",
      "El identificador del archivo madre no es válido.",
    );
  }

  const masterFile =
    await masterFileRepository.findMasterFileById(
      masterFileId,
    );

  if (!masterFile) {
    throw createMasterServiceError(
      "MASTER_FILE_NOT_FOUND",
      "El archivo madre no existe.",
      404,
    );
  }

  assertMasterFileAccess(masterFile, user);

  if (masterFile.status !== "ready") {
    throw createMasterServiceError(
      "MASTER_FILE_NOT_READY",
      "El archivo madre todavía no está disponible.",
      409,
    );
  }

  const records =
    await masterFileRepository
      .findActiveMasterRecordsForEditor(
        masterFileId,
      );

  return {
    masterFile,
    records,
  };
};

/**
 * Guarda los cambios realizados desde el editor.
 */
const updateMasterFileFromEditor =
  async ({
    masterFileId,
    revision,
    name,
    sites,
    rows,
    deletedRecordIds = [],
    user,
  }) => {
    const editorUserId =
      getMasterEditorUserId(user);

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

    const expectedRevision =
      Number(revision);

    if (
      !Number.isInteger(
        expectedRevision,
      ) ||
      expectedRevision < 1
    ) {
      throw createMasterServiceError(
        "MASTER_REVISION_INVALID",
        "La revisión del archivo madre no es válida.",
      );
    }

    if (!Array.isArray(rows)) {
      throw createMasterServiceError(
        "MASTER_EDITOR_ROWS_INVALID",
        "Las filas del editor no son válidas.",
      );
    }

    if (rows.length === 0) {
      throw createMasterServiceError(
        "MASTER_EDITOR_ROWS_REQUIRED",
        "El archivo madre debe conservar al menos una fila.",
      );
    }

    if (rows.length > 100000) {
      throw createMasterServiceError(
        "MASTER_EDITOR_ROWS_LIMIT",
        "El archivo madre excede el límite de filas permitido.",
        413,
      );
    }

    if (
      !Array.isArray(
        deletedRecordIds,
      )
    ) {
      throw createMasterServiceError(
        "MASTER_DELETED_RECORDS_INVALID",
        "La lista de filas eliminadas no es válida.",
      );
    }

    const normalizedDeletedIds = [
      ...new Set(
        deletedRecordIds.map(
          (recordId) =>
            String(
              recordId || "",
            ).trim(),
        ),
      ),
    ].filter(Boolean);

    normalizedDeletedIds.forEach(
      (recordId) => {
        if (
          !mongoose.Types.ObjectId.isValid(
            recordId,
          )
        ) {
          throw createMasterServiceError(
            "MASTER_RECORD_ID_INVALID",
            `El registro eliminado "${recordId}" no tiene un ID válido.`,
          );
        }
      },
    );

    const normalizedRows =
      rows.map((row, index) => {
        const recordId =
          String(
            row?.id || "",
          ).trim();

        if (
          recordId &&
          !mongoose.Types.ObjectId.isValid(
            recordId,
          )
        ) {
          throw createMasterServiceError(
            "MASTER_RECORD_ID_INVALID",
            `La fila ${index + 1} no tiene un ID válido.`,
          );
        }

        if (
          !Array.isArray(
            row?.cells,
          )
        ) {
          throw createMasterServiceError(
            "MASTER_EDITOR_CELLS_INVALID",
            `Las celdas de la fila ${index + 1} no son válidas.`,
          );
        }

        return {
          id:
            recordId,
          cells:
            row.cells,
          editorRow:
            index + 1,
        };
      });

    const receivedRecordIds =
      normalizedRows
        .map((row) => row.id)
        .filter(Boolean);

    if (
      new Set(
        receivedRecordIds,
      ).size !==
      receivedRecordIds.length
    ) {
      throw createMasterServiceError(
        "MASTER_RECORD_ID_DUPLICATE",
        "El editor envió una fila existente más de una vez.",
      );
    }

    const deletedIdsSet =
      new Set(
        normalizedDeletedIds,
      );

    const conflictingRecordId =
      receivedRecordIds.find(
        (recordId) =>
          deletedIdsSet.has(
            recordId,
          ),
      );

    if (conflictingRecordId) {
      throw createMasterServiceError(
        "MASTER_RECORD_STATE_CONFLICT",
        "Una fila no puede actualizarse y eliminarse al mismo tiempo.",
      );
    }

    const session =
      await mongoose.startSession();

    let updateResult = null;

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

          assertMasterFileAccess(
            masterFile,
            user,
          );

          if (
            masterFile.status !==
            "ready"
          ) {
            throw createMasterServiceError(
              "MASTER_FILE_NOT_READY",
              "El archivo madre todavía no está disponible.",
              409,
            );
          }

          if (
            Number(
              masterFile.revision,
            ) !== expectedRevision
          ) {
            throw createMasterServiceError(
              "MASTER_REVISION_CONFLICT",
              "El archivo fue modificado por otro usuario. Recarga la página antes de continuar.",
              409,
            );
          }

          const currentRecords =
            await masterFileRepository
              .findActiveMasterRecordsForUpdate(
                masterFileId,
                session,
              );

          const highestSourceRecord =
            await masterFileRepository
              .findHighestMasterRecordSourceRow(
                masterFileId,
                session,
              );

          const currentRecordsById =
            new Map(
              currentRecords.map(
                (record) => [
                  String(
                    record._id,
                  ),
                  record,
                ],
              ),
            );

          normalizedDeletedIds.forEach(
            (recordId) => {
              if (
                !currentRecordsById.has(
                  recordId,
                )
              ) {
                throw createMasterServiceError(
                  "MASTER_RECORD_NOT_FOUND",
                  "Una de las filas eliminadas ya no existe o pertenece a otro archivo.",
                  409,
                );
              }
            },
          );

          receivedRecordIds.forEach(
            (recordId) => {
              if (
                !currentRecordsById.has(
                  recordId,
                )
              ) {
                throw createMasterServiceError(
                  "MASTER_RECORD_NOT_FOUND",
                  "Una de las filas editadas ya no existe o pertenece a otro archivo.",
                  409,
                );
              }
            },
          );

          const receivedIdsSet =
            new Set(
              receivedRecordIds,
            );

          currentRecords.forEach(
            (record) => {
              const recordId =
                String(record._id);

              if (
                !receivedIdsSet.has(
                  recordId,
                ) &&
                !deletedIdsSet.has(
                  recordId,
                )
              ) {
                throw createMasterServiceError(
                  "MASTER_RECORD_SET_INCOMPLETE",
                  "El contenido enviado por el editor está incompleto. Recarga la página.",
                  409,
                );
              }
            },
          );

          const isAdmin =
            user.role === "admin";

          const nextName = isAdmin
            ? String(
                name || "",
              ).trim()
            : masterFile.name;

          if (!nextName) {
            throw createMasterServiceError(
              "MASTER_NAME_REQUIRED",
              "El nombre del archivo madre es obligatorio.",
            );
          }

          if (
            nextName.length > 150
          ) {
            throw createMasterServiceError(
              "MASTER_NAME_TOO_LONG",
              "El nombre no puede exceder 150 caracteres.",
            );
          }

          const nextSites = isAdmin
            ? normalizeMasterSites(
                sites,
              )
            : normalizeMasterSites(
                masterFile.sites,
              );

          let nextSourceRow =
            Math.max(
              Number(
                highestSourceRecord
                  ?.sourceRow,
              ) || 0,
              Number(
                masterFile.headerRow,
              ) || 0,
            );

          const preparedRows =
            normalizedRows.map(
              (receivedRow) => {
                const currentRecord =
                  receivedRow.id
                    ? currentRecordsById.get(
                        receivedRow.id,
                      )
                    : null;

                const sourceRow =
                  currentRecord
                    ? Number(
                        currentRecord
                          .sourceRow,
                      )
                    : ++nextSourceRow;

                let recordData;

                try {
                  recordData =
                    buildMasterRecordFromEditorRow({
                      masterType:
                        masterFile.masterType,
                      headers:
                        masterFile.headers,
                      cells:
                        receivedRow.cells,
                      sourceRow,
                    });
                } catch (error) {
                  if (
                    !error.statusCode
                  ) {
                    error.statusCode =
                      400;
                  }

                  throw error;
                }

                return {
                  id:
                    receivedRow.id,
                  recordData,
                };
              },
            );

          const finalRecords =
            preparedRows.map(
              (preparedRow) =>
                preparedRow.recordData,
            );

          applyEditorDuplicateWarnings(
            finalRecords,
          );

          const now =
            new Date();

          const operations =
            preparedRows.map(
              (preparedRow) => {
                const recordData =
                  preparedRow.recordData;

                if (preparedRow.id) {
                  return {
                    updateOne: {
                      filter: {
                        _id:
                          preparedRow.id,
                        masterFileId,
                        isDeleted:
                          false,
                      },

                      update: {
                        $set: {
                          ...recordData,
                          sites:
                            nextSites,
                          updatedBy:
                            editorUserId,
                          isDeleted:
                            false,
                        },

                        $unset: {
                          deletedAt: "",
                          deletedBy: "",
                        },
                      },
                    },
                  };
                }

                return {
                  insertOne: {
                    document: {
                      ...recordData,
                      masterFileId,
                      sites:
                        nextSites,
                      createdBy:
                        editorUserId,
                      updatedBy:
                        editorUserId,
                      isDeleted:
                        false,
                    },
                  },
                };
              },
            );

          normalizedDeletedIds.forEach(
            (recordId) => {
              operations.push({
                updateOne: {
                  filter: {
                    _id:
                      recordId,
                    masterFileId,
                    isDeleted:
                      false,
                  },

                  update: {
                    $set: {
                      isDeleted:
                        true,
                      deletedAt:
                        now,
                      deletedBy:
                        editorUserId,
                      updatedBy:
                        editorUserId,
                    },
                  },
                },
              });
            },
          );

          await masterFileRepository
            .bulkWriteMasterRecords(
              operations,
              session,
            );

          const warningCount =
            finalRecords.reduce(
              (
                totalWarnings,
                record,
              ) =>
                totalWarnings +
                (
                  record
                    .validationWarnings
                    ?.length || 0
                ),
              0,
            );

          const updatedMasterFile =
            await masterFileRepository
              .updateMasterFileByIdAndRevision(
                masterFileId,
                expectedRevision,
                {
                  name:
                    nextName,
                  sites:
                    nextSites,
                  recordCount:
                    finalRecords.length,
                  warningCount,
                  updatedBy:
                    editorUserId,
                },
                session,
              );

          if (!updatedMasterFile) {
            throw createMasterServiceError(
              "MASTER_REVISION_CONFLICT",
              "El archivo fue modificado por otro usuario. Recarga la página.",
              409,
            );
          }

          updateResult = {
            masterFile:
              updatedMasterFile,

            insertedRecordCount:
              preparedRows.filter(
                (row) => !row.id,
              ).length,

            updatedRecordCount:
              preparedRows.filter(
                (row) => row.id,
              ).length,

            deletedRecordCount:
              normalizedDeletedIds.length,

            warningCount,
          };
        },
      );
    } finally {
      await session.endSession();
    }

    if (!updateResult) {
      throw createMasterServiceError(
        "MASTER_EDITOR_UPDATE_NOT_COMPLETED",
        "No fue posible guardar los cambios.",
        500,
      );
    }

    return updateResult;
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
 * Crea una copia independiente de un archivo madre
 * y de todos sus registros activos.
 */
const copyMasterFile = async ({
  sourceMasterFileId,
  name,
  sites,
  user,
}) => {
  const adminUserId =
    getAdminUserId(user);
  if (
    !sourceMasterFileId ||
    !mongoose.Types.ObjectId.isValid(
      sourceMasterFileId,
    )
  ) {
    throw createMasterServiceError(
      "MASTER_FILE_ID_INVALID",
      "El identificador del archivo madre no es válido.",
    );
  }
  const copyName = String(
    name || "",
  ).trim();
  if (!copyName) {
    throw createMasterServiceError(
      "MASTER_COPY_NAME_REQUIRED",
      "Debes escribir un nombre para la copia.",
    );
  }
  if (copyName.length > 150) {
    throw createMasterServiceError(
      "MASTER_COPY_NAME_TOO_LONG",
      "El nombre de la copia no puede exceder 150 caracteres.",
    );
  }
  const copiedSites = normalizeMasterSites(sites);
  const copyExtension = path
    .extname(copyName)
    .toLowerCase();
  const copyOriginalFileName =
    copyExtension === ".xlsx" ||
    copyExtension === ".xlsm"
      ? copyName
      : `${copyName}.xlsx`;
  const session =
    await mongoose.startSession();
  let copiedMasterFile = null;
  let copiedRecordCount = 0;
  try {
    await session.withTransaction(
      async () => {
        const sourceMasterFile =
          await masterFileRepository
            .findMasterFileById(
              sourceMasterFileId,
              session,
            );
        if (!sourceMasterFile) {
          throw createMasterServiceError(
            "MASTER_FILE_NOT_FOUND",
            "El archivo madre original no existe.",
            404,
          );
        }
        if (
          sourceMasterFile.status !==
          "ready"
        ) {
          throw createMasterServiceError(
            "MASTER_FILE_NOT_READY",
            "El archivo madre original todavía no está disponible.",
            409,
          );
        }
        const sourceData =
          typeof sourceMasterFile.toObject ===
          "function"
            ? sourceMasterFile.toObject()
            : sourceMasterFile;
        const sourceRecords =
          await masterFileRepository
            .findActiveMasterRecordsForCopy(
              sourceMasterFileId,
              session,
            );
        const createdMasterFile =
          await masterFileRepository
            .createMasterFile(
              {
                name: copyName,
                originalFileName:
                  copyOriginalFileName,
                masterType:
                  sourceData.masterType,
                sites:
                  copiedSites,
                sourceSheet:
                  sourceData.sourceSheet,
                headerRow:
                  sourceData.headerRow,
                partNumberColumn:
                  sourceData.partNumberColumn,
                headers:
                  sourceData.headers || [],
                recordCount: 0,
                imageCountIgnored:
                  sourceData.imageCountIgnored ||
                  0,
                fileSizeBytes:
                  sourceData.fileSizeBytes ||
                  0,
                checksum:
                  sourceData.checksum || "",
                status: "processing",
                warningCount:
                  sourceData.warningCount ||
                  0,
                importWarnings:
                  sourceData.importWarnings ||
                  [],
                revision: 1,
                uploadedBy:
                  adminUserId,
                updatedBy:
                  adminUserId,
                lastImportedAt:
                  new Date(),
                errorMessage: "",
              },
              session,
            );
        const copiedRecords =
          sourceRecords.map(
            (sourceRecord) => ({
              masterFileId:
                createdMasterFile._id,
              masterType:
                sourceRecord.masterType,
              sites:
                copiedSites,
              partNumber:
                sourceRecord.partNumber,
              partNumberNormalized:
                sourceRecord
                  .partNumberNormalized,
              sourceRow:
                sourceRecord.sourceRow,
              rawCells:
                sourceRecord.rawCells ||
                [],
              normalizedValues:
                sourceRecord
                  .normalizedValues ||
                {},
              validationWarnings:
                sourceRecord
                  .validationWarnings ||
                [],
              isDeleted: false,
              createdBy:
                adminUserId,
              updatedBy:
                adminUserId,
            }),
          );
        const insertedRecords =
          await masterFileRepository
            .insertMasterRecords(
              copiedRecords,
              session,
            );
        copiedRecordCount =
          insertedRecords.length;
        if (
          copiedRecordCount !==
          sourceRecords.length
        ) {
          throw createMasterServiceError(
            "MASTER_COPY_RECORD_COUNT_MISMATCH",
            "No fue posible copiar todos los registros del archivo madre.",
            500,
          );
        }
        copiedMasterFile =
          await masterFileRepository
            .updateMasterFileById(
              createdMasterFile._id,
              {
                status: "ready",

                recordCount:
                  copiedRecordCount,

                lastImportedAt:
                  new Date(),

                updatedBy:
                  adminUserId,
              },
              session,
            );
        if (!copiedMasterFile) {
          throw createMasterServiceError(
            "MASTER_COPY_UPDATE_FAILED",
            "No fue posible finalizar la copia del archivo madre.",
            500,
          );
        }
      },
    );
  } finally {
    await session.endSession();
  }

  if (!copiedMasterFile) {
    throw createMasterServiceError(
      "MASTER_COPY_NOT_COMPLETED",
      "La copia del archivo madre no pudo completarse.",
      500,
    );
  }

  return {
    sourceMasterFileId,
    masterFile:
      copiedMasterFile,
    copiedRecordCount,
  };
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
  getMasterFileEditorData,
  updateMasterFileFromEditor,
  downloadMasterFile,
  copyMasterFile,
  deleteMasterFile,

};