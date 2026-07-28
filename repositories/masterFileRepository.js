// repositories/masterFileRepository.js

const MasterFile = require("../models/MasterFile");
const MasterRecord = require("../models/MasterRecord");

/**
 * Agrega la sesión de MongoDB solamente cuando existe.
 */
const getSessionOptions = (session) => {
  return session ? { session } : {};
};

/**
 * Crea la información general de un archivo madre.
 */
const createMasterFile = async (
  masterFileData,
  session = null,
) => {
  const [masterFile] = await MasterFile.create(
    [masterFileData],
    getSessionOptions(session),
  );

  return masterFile;
};

/**
 * Inserta todos los registros internos de un archivo madre.
 */
const insertMasterRecords = async (
  records,
  session = null,
) => {
  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }

  return MasterRecord.insertMany(records, {
    ordered: true,
    ...getSessionOptions(session),
  });
};

/**
 * Ejecuta inserciones, actualizaciones y
 * eliminaciones lógicas en una sola operación.
 */
const bulkWriteMasterRecords = async (
  operations,
  session = null,
) => {
  if (
    !Array.isArray(operations) ||
    operations.length === 0
  ) {
    return null;
  }

  return MasterRecord.bulkWrite(
    operations,
    {
      ordered: true,
      ...getSessionOptions(session),
    },
  );
};

/**
 * Actualiza información del archivo madre.
 */
const updateMasterFileById = async (
  masterFileId,
  updateFields,
  session = null,
) => {
  return MasterFile.findByIdAndUpdate(
    masterFileId,
    {
      $set: updateFields,
    },
    {
      new: true,
      runValidators: true,
      ...getSessionOptions(session),
    },
  );
};

/**
 * Actualiza el archivo solamente si conserva
 * la revisión que recibió originalmente el editor.
 */
const updateMasterFileByIdAndRevision =
  async (
    masterFileId,
    expectedRevision,
    updateFields,
    session = null,
  ) => {
    return MasterFile.findOneAndUpdate(
      {
        _id: masterFileId,
        revision:
          expectedRevision,
      },
      {
        $set:
          updateFields,
        $inc: {
          revision: 1,
        },
      },
      {
        new: true,
        runValidators: true,
        ...getSessionOptions(
          session,
        ),
      },
    );
  };

/**
 * Busca un archivo madre por ID.
 */
const findMasterFileById = async (
  masterFileId,
  session = null,
) => {
  const query = MasterFile.findById(masterFileId);

  if (session) {
    query.session(session);
  }

  return query;
};

/**
 * Consulta archivos madre disponibles.
 */
const findMasterFiles = async ({
  filter = {},
  limit = 200,
} = {}) => {
  return MasterFile.find(filter)
    .sort({
      lastImportedAt: -1,
      createdAt: -1,
    })
    .limit(limit)
    .select([
      "name",
      "originalFileName",
      "masterType",
      "sites",
      "status",
      "recordCount",
      "imageCountIgnored",
      "warningCount",
      "uploadedBy",
      "updatedBy",
      "lastImportedAt",
      "createdAt",
      "updatedAt",
    ].join(" "))
    .populate(
      "uploadedBy",
      "displayName email",
    )
    .populate(
      "updatedBy",
      "displayName email",
    )
    .lean();
};

/**
 * Elimina todos los registros internos asociados
 * con un archivo madre.
 */
const deleteMasterRecordsByMasterFileId = async (
  masterFileId,
  session = null,
) => {
  return MasterRecord.deleteMany(
    {
      masterFileId,
    },
    getSessionOptions(session),
  );
};

/**
 * Recupera los registros activos de un archivo madre
 * en el orden original de sus filas.
 */
const findActiveMasterRecordsByMasterFileId =
  async (masterFileId) => {
    return MasterRecord.find({
      masterFileId,
      isDeleted: false,
    })
      .sort({
        sourceRow: 1,
      })
      .select(
        "sourceRow rawCells",
      )
      .lean();
  };

/**
 * Recupera los registros necesarios para el editor.
 */
const findActiveMasterRecordsForEditor = async (masterFileId) => {
  return MasterRecord.find({
    masterFileId,
    isDeleted: false,
  })
    .sort({ sourceRow: 1 })
    .select([
      "_id",
      "partNumber",
      "sourceRow",
      "rawCells",
      "validationWarnings",
      "createdAt",
      "updatedAt",
    ].join(" "))
    .lean();
};

/**
 * Recupera los identificadores y posiciones
 * de los registros que pueden modificarse.
 */
const findActiveMasterRecordsForUpdate =
  async (
    masterFileId,
    session = null,
  ) => {
    const query =
      MasterRecord.find({
        masterFileId,
        isDeleted: false,
      })
        .sort({
          sourceRow: 1,
        })
        .select([
          "_id",
          "sourceRow",
          "partNumber",
          "partNumberNormalized",
        ].join(" "))
        .lean();

    if (session) {
      query.session(session);
    }

    return query;
  };

/**
 * Obtiene la posición más alta utilizada,
 * incluyendo registros eliminados lógicamente.
 */
const findHighestMasterRecordSourceRow =
  async (
    masterFileId,
    session = null,
  ) => {
    const query =
      MasterRecord.findOne({
        masterFileId,
      })
        .sort({
          sourceRow: -1,
        })
        .select(
          "sourceRow",
        )
        .lean();

    if (session) {
      query.session(session);
    }

    return query;
  };

/**
 * Recupera toda la información necesaria para copiar
 * los registros activos de un archivo madre.
 */
const findActiveMasterRecordsForCopy =
  async (
    masterFileId,
    session = null,
  ) => {
    const query = MasterRecord.find({
      masterFileId,
      isDeleted: false,
    })
      .sort({
        sourceRow: 1,
      })
      .select([
        "masterType",
        "partNumber",
        "partNumberNormalized",
        "sourceRow",
        "rawCells",
        "normalizedValues",
        "validationWarnings",
      ].join(" "));

    if (session) {
      query.session(session);
    }

    return query.lean();
  };

/**
 * Elimina la información general del archivo madre.
 */
const deleteMasterFileById = async (
  masterFileId,
  session = null,
) => {
  return MasterFile.deleteOne(
    {
      _id: masterFileId,
    },
    getSessionOptions(session),
  );
};

module.exports = {
  createMasterFile,
  insertMasterRecords,
  bulkWriteMasterRecords,
  updateMasterFileById,
  updateMasterFileByIdAndRevision,
  findMasterFileById,
  findMasterFiles,
  findActiveMasterRecordsByMasterFileId,
  findActiveMasterRecordsForEditor,
  findActiveMasterRecordsForUpdate,
  findHighestMasterRecordSourceRow,
  findActiveMasterRecordsForCopy,
  deleteMasterRecordsByMasterFileId,
  deleteMasterFileById,
};