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
  parseMasterFileStream,
} = require("../utils/masterFileStreamParser");
const {
  createMasterFileWorkbook,
} = require(
  "../utils/masterFileExporter"
);
const { VALID_SITES } = require("../data/siteConfig");
const {
  MASTER_TYPES,
  filterIgnoredMasterHeaders,
} = require("../data/masterFileRegistry");

const VALID_MASTER_SITES = VALID_SITES;
const VALID_MASTER_TYPES = Object.values(MASTER_TYPES);

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
 * Resuelve la sede que puede utilizarse para consultar catálogos.
 * Los usuarios siempre quedan restringidos a su sede. El administrador
 * debe indicar una porque puede trabajar con cualquiera de las dos.
 */
const resolveMasterLookupSite = (
  user,
  requestedSite,
) => {
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

  if (
    !["admin", "user"].includes(
      user.role,
    )
  ) {
    throw createMasterServiceError(
      "MASTER_ROLE_INVALID",
      "El usuario no tiene permisos para consultar archivos madre.",
      403,
    );
  }

  const normalizedRequestedSite =
    String(requestedSite || "")
      .trim()
      .toLowerCase();

  if (user.role === "admin") {
    if (
      !VALID_MASTER_SITES.includes(
        normalizedRequestedSite,
      )
    ) {
      throw createMasterServiceError(
        "MASTER_LOOKUP_SITE_REQUIRED",
        "Selecciona la sede que se utilizará para consultar el archivo madre.",
      );
    }

    return normalizedRequestedSite;
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

  return userSite;
};

/**
 * Consulta el registro madre más reciente que coincida exactamente con
 * Part Number, sede y tipo. Si existen varios registros se informa el
 * número de coincidencias, pero se utiliza primero el archivo actualizado
 * más recientemente y después la primera fila de ese archivo.
 */
const lookupMasterRecordByPartNumber =
  async ({
    user,
    requestedSite,
    partNumber,
    componentPartNumber,
    masterTypes,
  }) => {
    const site =
      resolveMasterLookupSite(
        user,
        requestedSite,
      );

    const normalizedPartNumber =
      String(partNumber || "")
        .trim()
        .toUpperCase();

    const normalizedComponentPartNumber =
      String(componentPartNumber || "")
        .trim()
        .toUpperCase();

    if (!normalizedPartNumber) {
      throw createMasterServiceError(
        "MASTER_LOOKUP_PART_NUMBER_REQUIRED",
        "El Part Number es obligatorio.",
      );
    }

    if (
      normalizedPartNumber.length > 100
    ) {
      throw createMasterServiceError(
        "MASTER_LOOKUP_PART_NUMBER_TOO_LONG",
        "El Part Number excede la longitud permitida.",
      );
    }

    const receivedTypes =
      Array.isArray(masterTypes)
        ? masterTypes
        : String(masterTypes || "")
            .split(",");

    const normalizedMasterTypes = [
      ...new Set(
        receivedTypes
          .map((masterType) =>
            String(
              masterType || "",
            ).trim(),
          )
          .filter(Boolean),
      ),
    ];

    const lookupTypes =
      normalizedMasterTypes.length > 0
        ? normalizedMasterTypes
        : VALID_MASTER_TYPES;

    const invalidTypes =
      lookupTypes.filter(
        (masterType) =>
          !VALID_MASTER_TYPES.includes(
            masterType,
          ),
      );

    if (invalidTypes.length > 0) {
      throw createMasterServiceError(
        "MASTER_LOOKUP_TYPE_INVALID",
        "El tipo de archivo madre solicitado no es válido.",
      );
    }

    const isBillOfMaterialsLookup =
      lookupTypes.length === 1 &&
      lookupTypes[0] === "billOfMaterials";

    if (
      isBillOfMaterialsLookup &&
      !normalizedComponentPartNumber
    ) {
      throw createMasterServiceError(
        "MASTER_LOOKUP_COMPONENT_REQUIRED",
        "El Component Part Number es obligatorio para consultar el B.O.M.",
      );
    }

    if (
      normalizedComponentPartNumber.length >
      100
    ) {
      throw createMasterServiceError(
        "MASTER_LOOKUP_COMPONENT_TOO_LONG",
        "El Component Part Number excede la longitud permitida.",
      );
    }

    const records =
      await masterFileRepository
        .findMasterRecordsByPartNumber({
          partNumberNormalized:
            normalizedPartNumber,

          componentPartNumberNormalized:
            isBillOfMaterialsLookup
              ? normalizedComponentPartNumber
              : "",

          site,

          masterTypes:
            lookupTypes,
        });

    const availableRecords =
      records
        .filter(
          (record) =>
            record.masterFileId,
        )
        .sort((left, right) => {
          const leftUpdatedAt =
            new Date(
              left.masterFileId
                .updatedAt ||
              left.masterFileId
                .lastImportedAt ||
              0,
            ).getTime();

          const rightUpdatedAt =
            new Date(
              right.masterFileId
                .updatedAt ||
              right.masterFileId
                .lastImportedAt ||
              0,
            ).getTime();

          if (
            rightUpdatedAt !==
            leftUpdatedAt
          ) {
            return (
              rightUpdatedAt -
              leftUpdatedAt
            );
          }

          return (
            Number(left.sourceRow) -
            Number(right.sourceRow)
          );
        });

    const selectedRecord =
      availableRecords[0] || null;

    if (!selectedRecord) {
      return {
        site,

        partNumber:
          normalizedPartNumber,

        componentPartNumber:
          normalizedComponentPartNumber,

        masterTypes:
          lookupTypes,

        matchCount: 0,

        hasConflictingBomMatches:
          false,

        match: null,
      };
    }

    /*
    * Si existen varios archivos B.O.M. para la
    * sede, se utiliza el archivo más reciente.
    * La comparación de duplicados se realiza
    * solamente dentro de ese archivo.
    */
    const selectedMasterFileId =
      String(
        selectedRecord
          .masterFileId?._id || "",
      );

    const relevantRecords =
      isBillOfMaterialsLookup
        ? availableRecords.filter(
            (record) =>
              String(
                record.masterFileId?._id ||
                  "",
              ) === selectedMasterFileId,
          )
        : availableRecords;

    /*
    * Compara únicamente los campos que se
    * utilizarán para autollenar el B.O.M.
    */
    const bomValueSignatures =
      new Set(
        relevantRecords.map(
          (record) => {
            const values =
              record.normalizedValues ||
              {};

            return JSON.stringify([
              String(
                values.bomType ?? "",
              )
                .trim()
                .toUpperCase(),

              String(
                values.quantity ?? "",
              ).trim(),

              String(
                values.unitOfMeasure ??
                  "",
              )
                .trim()
                .toUpperCase(),

              String(
                values
                  .componentClassification ??
                  "",
              )
                .trim()
                .toUpperCase(),
            ]);
          },
        ),
      );

    const hasConflictingBomMatches =
      isBillOfMaterialsLookup &&
      bomValueSignatures.size > 1;

    const masterFile =
      selectedRecord.masterFileId;

    return {
      site,
      partNumber:
        normalizedPartNumber,
      masterTypes:
        lookupTypes,
      componentPartNumber:
        normalizedComponentPartNumber,
      matchCount:
        relevantRecords.length,
      hasConflictingBomMatches,
      match: {
        id:
          selectedRecord._id,
        masterType:
          selectedRecord.masterType,
        partNumber:
          selectedRecord.partNumber,
        sourceRow:
          selectedRecord.sourceRow,
        normalizedValues:
          selectedRecord
            .normalizedValues || {},
        validationWarnings:
          selectedRecord
            .validationWarnings || [],
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
          updatedAt:
            masterFile.updatedAt,
        },
      },
    };
  };

const enrichBillOfMaterialsRows =
  async ({
    user,
    requestedSite,
    rows,
  }) => {
    const site =
      resolveMasterLookupSite(
        user,
        requestedSite,
      );

    const safeRows =
      Array.isArray(rows)
        ? rows.map((row) => ({
            ...(row || {}),
          }))
        : [];

    const normalizeValue =
      (value) =>
        String(value ?? "")
          .trim()
          .toUpperCase();

    const buildPairKey = (
      finishedGood,
      component,
    ) =>
      `${finishedGood}||${component}`;

    const pairEntries = [];
    const inputPairCounts =
      new Map();

    safeRows.forEach(
      (row, rowIndex) => {
        const finishedGood =
          normalizeValue(
            row[
              "Finished Good Part Number"
            ],
          );

        const component =
          normalizeValue(
            row[
              "Component Part Number"
            ],
          );

        if (
          !finishedGood ||
          !component
        ) {
          return;
        }

        const pairKey =
          buildPairKey(
            finishedGood,
            component,
          );

        pairEntries.push({
          row,
          rowIndex,
          finishedGood,
          component,
          pairKey,
        });

        inputPairCounts.set(
          pairKey,
          (
            inputPairCounts.get(
              pairKey,
            ) || 0
          ) + 1,
        );
      },
    );

    const finishedGoodPartNumbers =
      [
        ...new Set(
          pairEntries.map(
            (entry) =>
              entry.finishedGood,
          ),
        ),
      ];

    const componentPartNumbers =
      [
        ...new Set(
          pairEntries.map(
            (entry) =>
              entry.component,
          ),
        ),
      ];

    const records =
      await masterFileRepository
        .findBomMasterRecordsForBatch({
          finishedGoodPartNumbers,
          componentPartNumbers,
          site,
        });

    const recordsByPair =
      new Map();

    records
      .filter(
        (record) =>
          record.masterFileId,
      )
      .forEach((record) => {
        const pairKey =
          buildPairKey(
            normalizeValue(
              record
                .partNumberNormalized,
            ),

            normalizeValue(
              record
                .normalizedValues
                ?.componentPartNumber,
            ),
          );

        if (
          !recordsByPair.has(
            pairKey,
          )
        ) {
          recordsByPair.set(
            pairKey,
            [],
          );
        }

        recordsByPair
          .get(pairKey)
          .push(record);
      });

    const usedOccurrences =
      new Map();

    let matchedRows = 0;
    let missingRows = 0;
    let ambiguousRows = 0;
    let filledFieldCount = 0;

    pairEntries.forEach(
      (entry) => {
        const pairRecords =
          recordsByPair.get(
            entry.pairKey,
          ) || [];

        if (
          pairRecords.length === 0
        ) {
          missingRows += 1;
          return;
        }

        pairRecords.sort(
          (left, right) => {
            const leftDate =
              new Date(
                left.masterFileId
                  ?.updatedAt ||
                left.masterFileId
                  ?.lastImportedAt ||
                0,
              ).getTime();

            const rightDate =
              new Date(
                right.masterFileId
                  ?.updatedAt ||
                right.masterFileId
                  ?.lastImportedAt ||
                0,
              ).getTime();

            if (
              rightDate !== leftDate
            ) {
              return (
                rightDate -
                leftDate
              );
            }

            return (
              Number(
                left.sourceRow,
              ) -
              Number(
                right.sourceRow,
              )
            );
          },
        );

        const selectedFileId =
          String(
            pairRecords[0]
              .masterFileId?._id ||
              "",
          );

        const relevantRecords =
          pairRecords.filter(
            (record) =>
              String(
                record
                  .masterFileId?._id ||
                  "",
              ) ===
              selectedFileId,
          );

        const signatures =
          new Set(
            relevantRecords.map(
              (record) => {
                const values =
                  record
                    .normalizedValues ||
                  {};

                return JSON.stringify([
                  normalizeValue(
                    values.bomType ||
                      values.componentType,
                  ),

                  String(
                    values.quantity ??
                      "",
                  ).trim(),

                  normalizeValue(
                    values
                      .unitOfMeasure,
                  ),

                  normalizeValue(
                    values
                      .componentClassification,
                  ),
                ]);
              },
            ),
          );

        let selectedRecord =
          relevantRecords[0];

        if (
          signatures.size > 1
        ) {
          const importedCount =
            inputPairCounts.get(
              entry.pairKey,
            ) || 0;

          if (
            importedCount !==
            relevantRecords.length
          ) {
            ambiguousRows += 1;
            return;
          }

          const occurrence =
            usedOccurrences.get(
              entry.pairKey,
            ) || 0;

          selectedRecord =
            relevantRecords[
              occurrence
            ];

          usedOccurrences.set(
            entry.pairKey,
            occurrence + 1,
          );
        }

        if (!selectedRecord) {
          ambiguousRows += 1;
          return;
        }

        const normalizedValues =
          selectedRecord
            .normalizedValues || {};

        const valuesToFill = [
          [
            "Type",
            normalizedValues.bomType ||
              normalizedValues.componentType,
          ],
          [
            "Quantity",
            normalizedValues.quantity,
          ],
          [
            "Unit of Measure",
            normalizedValues
              .unitOfMeasure,
          ],
          [
            "Component classification",
            normalizedValues
              .componentClassification,
          ],
        ];

        valuesToFill.forEach(
          ([fieldName, value]) => {
            if (
              value === undefined ||
              value === null ||
              String(value).trim() === ""
            ) {
              return;
            }

            if (
              String(
                entry.row[
                  fieldName
                ] || "",
              ).trim()
            ) {
              return;
            }

            entry.row[fieldName] =
              value;

            filledFieldCount += 1;
          },
        );

        matchedRows += 1;
      },
    );

    return {
      site,
      rows: safeRows,

      summary: {
        totalRows:
          safeRows.length,

        matchedRows,
        missingRows,
        ambiguousRows,
        filledFieldCount,
      },
    };
  };

const isEmptyImportedCell = (value) =>
  value === undefined ||
  value === null ||
  String(value).trim() === "";

const getFirstNormalizedValue = (values, keys) => {
  for (const key of keys) {
    if (!isEmptyImportedCell(values?.[key])) {
      return values[key];
    }
  }
  return "";
};

const formatImportedDate = (value) => {
  if (isEmptyImportedCell(value)) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("");
};

const getFdaAffirmation = (values, sequence, component) => {
  const affirmations = Array.isArray(values?.fdaAffirmations)
    ? values.fdaAffirmations
    : [];
  return affirmations.find(
    (item) => Number(item?.sequence) === sequence,
  )?.[component] || "";
};

const buildImportedMasterValues = (
  documentType,
  normalizedValues,
) => {
  const commonValues = {
    "Description": normalizedValues.description,
    "Unit of Measure": normalizedValues.unitOfMeasure,
    "Unit Of Measure": normalizedValues.unitOfMeasure,
    "Country of Origin": normalizedValues.countryOfOrigin,
  };

  if (documentType === "finishedProduct") {
    const values = {
      ...commonValues,
      "Unit Weight Lb.": normalizedValues.unitNetWeight,
      "Dutiable Value (USD)": getFirstNormalizedValue(
        normalizedValues,
        ["dutiableValueUsd", "materialCostUsd"],
      ),
      "Filler": normalizedValues.filler,
      "Added Value (USD)": normalizedValues.addedValueUsd,
      "USA Importation HTS Code": normalizedValues.importationHtsCode,
      "USA Exportation Code": normalizedValues.exportationHtsCode,
      "FDA Product Code": normalizedValues.fdaProductCode,
      "FDA Storage": normalizedValues.fdaStorage,
      "FDA Country of Origin": normalizedValues.fdaCountryOfOrigin,
      "FDA Marker": normalizedValues.fdaMarker,
      "USML (ITAR)": normalizedValues.usmlItar,
    };

    for (let sequence = 1; sequence <= 6; sequence += 1) {
      values[`FDA Affirmation of Compliance Code ${sequence}`] =
        getFdaAffirmation(normalizedValues, sequence, "code");
      values[`FDA Affirmation of Compliance Qualifier ${sequence}`] =
        getFdaAffirmation(normalizedValues, sequence, "qualifier");
    }
    return values;
  }

  if (documentType === "rawMaterial") {
    return {
      ...commonValues,
      "Unit Weight Lb.": normalizedValues.unitNetWeight,
      "Unit Cost (USD)": normalizedValues.unitCostUsd,
      "Country of origin": normalizedValues.countryOfOrigin,
      "Unit of measure": normalizedValues.unitOfMeasure,
      "Importation HTS Code": normalizedValues.importationHtsCode,
      "Exportation HTS Code": normalizedValues.exportationHtsCode,
      "ECCN": normalizedValues.eccn,
      "Filler": normalizedValues.filler,
      "License Number (LCN)": normalizedValues.licenseNumber,
      "License Exception": normalizedValues.licenseException,
      "License Expiration date": formatImportedDate(
        normalizedValues.licenseExpirationDate,
      ),
      "USML (ITAR)": normalizedValues.usmlItar,
    };
  }

  if (documentType === "splScrap") {
    return {
      ...commonValues,
      "Unit Value (USD)": getFirstNormalizedValue(
        normalizedValues,
        ["unitCostUsd", "materialCostUsd", "totalUnitCostUsd"],
      ),
      "Added Value (USD)": normalizedValues.addedValueUsd,
      "Unit Net Weight": normalizedValues.unitNetWeight,
      "ECCN": normalizedValues.eccn,
      "License No.": normalizedValues.licenseNumber,
      "License Exception": normalizedValues.licenseException,
      "US IMP HTS Code": normalizedValues.importationHtsCode,
      "US EXP HTS Code": normalizedValues.exportationHtsCode,
      "Main Function": normalizedValues.mainFunction,
    };
  }

  return {};
};

const enrichImportedRowsFromMasterFiles = async ({
  user,
  requestedSite,
  documentType,
  rows,
}) => {
  if (documentType === "billOfMaterials") {
    const result = await enrichBillOfMaterialsRows({
      user,
      requestedSite,
      rows,
    });
    const classifiedRows =
      result.summary.matchedRows +
      result.summary.missingRows +
      result.summary.ambiguousRows;
    result.summary.missingRows += Math.max(
      0,
      result.summary.totalRows - classifiedRows,
    );
    return result;
  }

  const masterTypesByDocument = {
    finishedProduct: ["finishedProduct"],
    rawMaterial: ["rawMaterial"],
    splScrap: ["finishedProduct", "rawMaterial"],
  };
  const masterTypes = masterTypesByDocument[documentType];

  if (!masterTypes) {
    return {
      rows: Array.isArray(rows) ? rows : [],
      summary: null,
    };
  }

  const site = resolveMasterLookupSite(user, requestedSite);
  const safeRows = Array.isArray(rows)
    ? rows.map((row) => ({ ...(row || {}) }))
    : [];
  const normalizeValue = (value) =>
    String(value ?? "").trim().toUpperCase();
  const partNumbers = [
    ...new Set(
      safeRows
        .filter((row) => {
          if (documentType !== "splScrap") return true;
          return ["FG", "RM"].includes(
            normalizeValue(row["Type of goods"]),
          );
        })
        .map((row) => normalizeValue(row["Part Number"]))
        .filter(Boolean),
    ),
  ];

  const records = await masterFileRepository.findMasterRecordsForBatch({
    partNumbers,
    site,
    masterTypes,
  });
  const recordsByPartAndType = new Map();

  records.filter((record) => record.masterFileId).forEach((record) => {
    const key = `${normalizeValue(record.partNumberNormalized)}||${record.masterType}`;
    if (!recordsByPartAndType.has(key)) recordsByPartAndType.set(key, []);
    recordsByPartAndType.get(key).push(record);
  });

  const selectLatestCandidate = (partNumber, masterType) => {
    const candidates = recordsByPartAndType.get(
      `${partNumber}||${masterType}`,
    ) || [];
    if (!candidates.length) return { status: "missing" };

    candidates.sort((left, right) => {
      const leftDate = new Date(
        left.masterFileId?.updatedAt || left.masterFileId?.lastImportedAt || 0,
      ).getTime();
      const rightDate = new Date(
        right.masterFileId?.updatedAt || right.masterFileId?.lastImportedAt || 0,
      ).getTime();
      return rightDate - leftDate || Number(left.sourceRow) - Number(right.sourceRow);
    });

    const newestFileId = String(candidates[0].masterFileId?._id || "");
    const newestRecords = candidates.filter(
      (record) => String(record.masterFileId?._id || "") === newestFileId,
    );
    const signatures = new Set(
      newestRecords.map((record) => JSON.stringify(record.normalizedValues || {})),
    );

    if (signatures.size > 1) return { status: "ambiguous" };
    return { status: "matched", record: newestRecords[0] };
  };

  let matchedRows = 0;
  let missingRows = 0;
  let ambiguousRows = 0;
  let filledFieldCount = 0;

  safeRows.forEach((row) => {
    const partNumber = normalizeValue(row["Part Number"]);
    if (!partNumber) {
      missingRows += 1;
      return;
    }

    let rowMasterTypes = masterTypes;

    if (documentType === "splScrap") {
      const typeOfGoods = normalizeValue(row["Type of goods"]);

      if (typeOfGoods === "FG") {
        rowMasterTypes = ["finishedProduct"];
      } else if (typeOfGoods === "RM") {
        rowMasterTypes = ["rawMaterial"];
      } else {
        // EQ y cualquier tipo no reconocido corresponden a partes
        // que no deben consultarse en los archivos madre actuales.
        missingRows += 1;
        return;
      }
    }

    const candidates = rowMasterTypes.map(
      (masterType) => selectLatestCandidate(partNumber, masterType),
    );
    const hasAmbiguousCandidate = candidates.some(
      (candidate) => candidate.status === "ambiguous",
    );
    const matches = candidates.filter(
      (candidate) => candidate.status === "matched",
    );

    if (hasAmbiguousCandidate || matches.length > 1) {
      ambiguousRows += 1;
      return;
    }
    if (!matches.length) {
      missingRows += 1;
      return;
    }

    const valuesToFill = buildImportedMasterValues(
      documentType,
      matches[0].record.normalizedValues || {},
    );
    Object.entries(valuesToFill).forEach(([fieldName, value]) => {
      if (
        isEmptyImportedCell(row[fieldName]) &&
        !isEmptyImportedCell(value)
      ) {
        row[fieldName] = value;
        filledFieldCount += 1;
      }
    });
    matchedRows += 1;
  });

  return {
    site,
    rows: safeRows,
    summary: {
      totalRows: safeRows.length,
      matchedRows,
      missingRows,
      ambiguousRows,
      filledFieldCount,
    },
  };
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
 * Importa un archivo madre desde disco utilizando memoria acotada. El parser
 * entrega lotes pequeños y cada lote se libera después de insertarse.
 */
const importMasterFileFromPath = async ({
  filePath,
  originalFileName,
  name,
  expectedMasterType,
  sites,
  user,
}) => {
  const adminUserId = getAdminUserId(user);
  const normalizedSites = normalizeMasterSites(sites);
  const safeOriginalFileName = path.basename(
    String(originalFileName || "").trim(),
  );

  if (!safeOriginalFileName) {
    throw createMasterServiceError(
      "MASTER_FILE_NAME_REQUIRED",
      "El archivo madre debe tener un nombre.",
    );
  }

  const masterFileName = String(name || "").trim() || safeOriginalFileName;
  const configuredBatchSize = Number.parseInt(
    process.env.MASTER_IMPORT_BATCH_SIZE,
    10,
  );
  const batchSize = Number.isInteger(configuredBatchSize) &&
    configuredBatchSize >= 100 && configuredBatchSize <= 2000
    ? configuredBatchSize
    : 500;
  const warningSampleLimit = Math.max(
    1,
    Math.min(
      Number.parseInt(process.env.MASTER_IMPORT_WARNING_SAMPLE_LIMIT, 10) || 200,
      1000,
    ),
  );

  let importedMasterFile = null;
  let insertedRecordCount = 0;
  let lastProgressSaved = 0;

  try {
    const parsedResult = await parseMasterFileStream(filePath, {
      originalFileName: safeOriginalFileName,
      expectedMasterType: expectedMasterType || undefined,
      batchSize,
      warningSampleLimit,
      onMetadata: async (metadata) => {
        importedMasterFile = await masterFileRepository.createMasterFile({
          ...metadata,
          name: masterFileName,
          originalFileName: safeOriginalFileName,
          sites: normalizedSites,
          status: "processing",
          uploadedBy: adminUserId,
          updatedBy: adminUserId,
        });
      },
      onBatch: async (records) => {
        if (!importedMasterFile) {
          throw createMasterServiceError(
            "MASTER_IMPORT_METADATA_MISSING",
            "No fue posible inicializar el archivo madre.",
            500,
          );
        }

        const masterRecords = records.map((record) => ({
          ...record,
          masterFileId: importedMasterFile._id,
          sites: normalizedSites,
          createdBy: adminUserId,
          updatedBy: adminUserId,
        }));
        const insertedRecords = await masterFileRepository.insertMasterRecords(
          masterRecords,
        );

        if (insertedRecords.length !== records.length) {
          throw createMasterServiceError(
            "MASTER_RECORD_COUNT_MISMATCH",
            "No se insertaron todos los registros del lote.",
            500,
          );
        }

        insertedRecordCount += insertedRecords.length;
      },
      onProgress: async ({ recordCount }) => {
        if (
          importedMasterFile &&
          recordCount - lastProgressSaved >= 5000
        ) {
          lastProgressSaved = recordCount;
          await masterFileRepository.updateMasterFileById(
            importedMasterFile._id,
            {
              recordCount,
              updatedBy: adminUserId,
            },
          );
        }
      },
    });

    if (!importedMasterFile) {
      throw createMasterServiceError(
        "MASTER_IMPORT_NOT_INITIALIZED",
        "No fue posible iniciar la importación del archivo madre.",
        500,
      );
    }

    if (insertedRecordCount !== parsedResult.recordCount) {
      throw createMasterServiceError(
        "MASTER_RECORD_COUNT_MISMATCH",
        "El total insertado no coincide con las filas procesadas.",
        500,
      );
    }

    importedMasterFile = await masterFileRepository.updateMasterFileById(
      importedMasterFile._id,
      {
        status: "ready",
        recordCount: insertedRecordCount,
        warningCount: parsedResult.metadata.warningCount,
        importWarnings: parsedResult.metadata.importWarnings,
        lastImportedAt: new Date(),
        errorMessage: "",
        updatedBy: adminUserId,
      },
    );

    return {
      masterFile: importedMasterFile,
      insertedRecordCount,
      warnings: parsedResult.metadata.importWarnings || [],
    };
  } catch (error) {
    if (importedMasterFile?._id) {
      await masterFileRepository.deleteMasterRecordsByMasterFileId(
        importedMasterFile._id,
      ).catch(() => {});
      await masterFileRepository.updateMasterFileById(
        importedMasterFile._id,
        {
          status: "failed",
          recordCount: 0,
          errorMessage: String(error.message || "Error de importación").slice(0, 1000),
          updatedBy: adminUserId,
        },
      ).catch(() => {});
    }

    if (!error.statusCode) error.statusCode = 400;
    throw error;
  }
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
  page = 1,
  pageSize = 1000,
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

  const parsedPage = Number.parseInt(page, 10);
  const parsedPageSize = Number.parseInt(pageSize, 10);
  const safePage = Number.isInteger(parsedPage) && parsedPage > 0
    ? parsedPage
    : 1;
  const safePageSize = Number.isInteger(parsedPageSize) && parsedPageSize > 0
    ? Math.min(parsedPageSize, 1000)
    : 1000;

  const pageResult =
    await masterFileRepository
      .findActiveMasterRecordsForEditor(
        {
          masterFileId,
          page: safePage,
          pageSize: safePageSize,
        },
      );

  const totalPages = Math.max(
    1,
    Math.ceil(pageResult.totalRecords / safePageSize),
  );

  if (safePage > totalPages) {
    throw createMasterServiceError(
      "MASTER_EDITOR_PAGE_INVALID",
      "La página solicitada ya no existe.",
      404,
    );
  }

  return {
    masterFile,
    records: pageResult.records,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      totalRecords: pageResult.totalRecords,
      totalPages,
    },
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

    if (rows.length > 1000) {
      throw createMasterServiceError(
        "MASTER_EDITOR_ROWS_LIMIT",
        "Sólo se pueden guardar 1,000 filas por página.",
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
                [
                  ...receivedRecordIds,
                  ...normalizedDeletedIds,
                ],
                session,
              );

          const currentRecordCount =
            await masterFileRepository
              .countActiveMasterRecords(
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

          const insertedRecordCount =
            preparedRows.filter(
              (row) => !row.id,
            ).length;
          const nextRecordCount =
            currentRecordCount +
            insertedRecordCount -
            normalizedDeletedIds.length;

          if (nextRecordCount < 1) {
            throw createMasterServiceError(
              "MASTER_EDITOR_ROWS_REQUIRED",
              "El archivo madre debe conservar al menos una fila.",
            );
          }

          applyEditorDuplicateWarnings(
            finalRecords,
            masterFile.masterType,
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

          const sitesChanged =
            JSON.stringify([...(masterFile.sites || [])].sort()) !==
            JSON.stringify([...nextSites].sort());

          if (sitesChanged) {
            operations.unshift({
              updateMany: {
                filter: {
                  masterFileId,
                  isDeleted: false,
                },
                update: {
                  $set: {
                    sites: nextSites,
                    updatedBy: editorUserId,
                  },
                },
              },
            });
          }

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
            await masterFileRepository
              .countActiveMasterRecordWarnings(
                masterFileId,
                session,
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
                    nextRecordCount,
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
              insertedRecordCount,

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
        const retainedHeaders =
          filterIgnoredMasterHeaders(
            sourceData.masterType,
            sourceData.headers,
          );
        const retainedColumnIndexes =
          new Set(
            retainedHeaders.map(
              (header) =>
                Number(
                  header.columnIndex,
                ),
            ),
          );
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
                  retainedHeaders,
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
                Array.isArray(
                  sourceRecord.rawCells,
                )
                  ? sourceRecord.rawCells.filter(
                      (rawCell) =>
                        retainedColumnIndexes.has(
                          Number(
                            rawCell.columnIndex,
                          ),
                        ),
                    )
                  : [],
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
  importMasterFileFromPath,
  normalizeMasterSites,
  listMasterFiles,
  lookupMasterRecordByPartNumber,
  enrichBillOfMaterialsRows,
  enrichImportedRowsFromMasterFiles,
  getMasterFileEditorData,
  updateMasterFileFromEditor,
  downloadMasterFile,
  copyMasterFile,
  deleteMasterFile,
};
