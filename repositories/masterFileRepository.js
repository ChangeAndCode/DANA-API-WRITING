// repositories/masterFileRepository.js

const MasterFile = require("../models/MasterFile");
const MasterRecord = require("../models/MasterRecord");
const mongoose = require("mongoose");
const {
  buildMasterEditorSearchExpression,
} = require("../utils/masterEditorSearch");

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
 * Recupera el archivo madre listo mas reciente para una sede y tipo.
 * La validacion de que pertenezca exclusivamente a la sede se realiza
 * en el servicio para poder devolver un error de negocio explicito.
 */
const findLatestReadyMasterFileForSiteAndType =
  async ({
    site,
    masterType,
  }) => {
    return MasterFile.findOne({
      sites: site,
      masterType,
      status: "ready",
    })
      .sort({
        lastImportedAt: -1,
        updatedAt: -1,
        createdAt: -1,
      })
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
        "masterType partNumber sourceRow rawCells normalizedValues",
      )
      .lean();
  };

/**
 * Recupera solo los registros que pueden coincidir con las filas
 * recibidas durante una sincronizacion posterior al SFTP.
 */
const findActiveMasterRecordsForSync = async ({
  masterFileId,
  partNumbers,
  session = null,
}) => {
  const safePartNumbers = Array.isArray(partNumbers)
    ? [...new Set(partNumbers.filter(Boolean))]
    : [];

  if (!safePartNumbers.length) return [];

  const query = MasterRecord.find({
    masterFileId,
    partNumberNormalized: {
      $in: safePartNumbers,
    },
    isDeleted: false,
  })
    .sort({
      sourceRow: 1,
    })
    .select([
      "_id",
      "masterFileId",
      "masterType",
      "sites",
      "partNumber",
      "partNumberNormalized",
      "sourceRow",
      "rawCells",
      "normalizedValues",
      "validationWarnings",
    ].join(" "))
    .lean();

  if (session) query.session(session);
  return query;
};

/**
 * Recupera los registros necesarios para el editor.
 */
const findActiveMasterRecordsForEditor = async ({
  masterFileId,
  page,
  pageSize,
  search = "",
  columnIndexes = [],
}) => {
  const filter = {
    masterFileId,
    isDeleted: false,
  };
  const searchExpression =
    buildMasterEditorSearchExpression({
      search,
      columnIndexes,
    });

  if (searchExpression) {
    Object.assign(
      filter,
      searchExpression,
    );
  }


  const [records, totalRecords] = await Promise.all([
    MasterRecord.find(filter)
    .sort({ sourceRow: 1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .select([
      "_id",
      "masterType",
      "partNumber",
      "sourceRow",
      "rawCells",
      "normalizedValues",
      "validationWarnings",
      "createdAt",
      "updatedAt",
    ].join(" "))
    .lean(),
    MasterRecord.countDocuments(filter),
  ]);

  return { records, totalRecords };
};

/**
 * Busca registros activos por Part Number, sede y tipo de catálogo.
 * La información del archivo padre permite descartar archivos que ya
 * no estén disponibles y elegir el catálogo actualizado más reciente.
 */
const findMasterRecordsByPartNumber =
  async ({
    partNumberNormalized,
    componentPartNumberNormalized = "",
    site,
    masterTypes,
    limit = 50,
  }) => {
    const filters = {
      partNumberNormalized,
      sites: site,
      masterType: {
        $in: masterTypes,
      },
      isDeleted: false,
    };

    if (componentPartNumberNormalized) {
      filters[
        "normalizedValues.componentPartNumber"
      ] = componentPartNumberNormalized;
    }

    return MasterRecord.find(filters)
      .sort({
        sourceRow: 1,
      })
      .limit(limit)
      .select([
        "_id",
        "masterFileId",
        "masterType",
        "partNumber",
        "partNumberNormalized",
        "sourceRow",
        "normalizedValues",
        "validationWarnings",
      ].join(" "))
      .populate({
        path: "masterFileId",
        match: {
          status: "ready",
          sites: site,
        },
        select: [
          "name",
          "masterType",
          "sites",
          "status",
          "revision",
          "updatedAt",
          "lastImportedAt",
        ].join(" "),
      })
      .lean();
  };

const findBomMasterRecordsForBatch =
  async ({
    finishedGoodPartNumbers,
    componentPartNumbers,
    site,
  }) => {
    const safeFinishedGoods =
      Array.isArray(
        finishedGoodPartNumbers,
      )
        ? finishedGoodPartNumbers
        : [];

    const safeComponents =
      Array.isArray(
        componentPartNumbers,
      )
        ? componentPartNumbers
        : [];

    if (
      safeFinishedGoods.length === 0 ||
      safeComponents.length === 0
    ) {
      return [];
    }

    return MasterRecord.find({
      sites: site,

      masterType:
        "billOfMaterials",

      partNumberNormalized: {
        $in: safeFinishedGoods,
      },

      "normalizedValues.componentPartNumber":
        {
          $in: safeComponents,
        },

      isDeleted: false,
    })
      .sort({
        sourceRow: 1,
      })
      .select([
        "_id",
        "masterFileId",
        "masterType",
        "partNumber",
        "partNumberNormalized",
        "sourceRow",
        "normalizedValues",
        "validationWarnings",
      ].join(" "))
      .populate({
        path: "masterFileId",

        match: {
          status: "ready",
          sites: site,
          masterType:
            "billOfMaterials",
        },

        select: [
          "name",
          "masterType",
          "sites",
          "status",
          "revision",
          "updatedAt",
          "lastImportedAt",
        ].join(" "),
      })
      .lean();
  };

const findMasterRecordsForBatch = async ({
  partNumbers,
  site,
  masterTypes,
}) => {
  const safePartNumbers = Array.isArray(partNumbers)
    ? [...new Set(partNumbers.filter(Boolean))]
    : [];
  const safeMasterTypes = Array.isArray(masterTypes)
    ? [...new Set(masterTypes.filter(Boolean))]
    : [];

  if (!safePartNumbers.length || !safeMasterTypes.length) {
    return [];
  }

  return MasterRecord.find({
    sites: site,
    masterType: { $in: safeMasterTypes },
    partNumberNormalized: { $in: safePartNumbers },
    isDeleted: false,
  })
    .sort({ sourceRow: 1 })
    .select([
      "_id",
      "masterFileId",
      "masterType",
      "partNumber",
      "partNumberNormalized",
      "sourceRow",
      "normalizedValues",
      "validationWarnings",
    ].join(" "))
    .populate({
      path: "masterFileId",
      match: {
        status: "ready",
        sites: site,
        masterType: { $in: safeMasterTypes },
      },
      select: [
        "name",
        "masterType",
        "sites",
        "status",
        "revision",
        "updatedAt",
        "lastImportedAt",
      ].join(" "),
    })
    .lean();
};

/**
 * Recupera los identificadores y posiciones
 * de los registros que pueden modificarse.
 */
const findActiveMasterRecordsForUpdate =
  async (
    masterFileId,
    recordIds,
    session = null,
  ) => {
    const query =
      MasterRecord.find({
        masterFileId,
        isDeleted: false,
        _id: {
          $in: recordIds,
        },
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

const countActiveMasterRecords = async (
  masterFileId,
  session = null,
) => {
  const query = MasterRecord.countDocuments({
    masterFileId,
    isDeleted: false,
  });

  if (session) query.session(session);
  return query;
};

const countActiveMasterRecordWarnings = async (
  masterFileId,
  session = null,
) => {
  const aggregate = MasterRecord.aggregate([
    {
      $match: {
        masterFileId:
          new mongoose.Types.ObjectId(masterFileId),
        isDeleted: false,
      },
    },
    {
      $project: {
        warningCount: {
          $size: {
            $ifNull: ["$validationWarnings", []],
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$warningCount" },
      },
    },
  ]);

  if (session) aggregate.session(session);
  const [result] = await aggregate;
  return result?.total || 0;
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
  findLatestReadyMasterFileForSiteAndType,
  findActiveMasterRecordsByMasterFileId,
  findActiveMasterRecordsForSync,
  findActiveMasterRecordsForEditor,
  findMasterRecordsByPartNumber,
  findBomMasterRecordsForBatch,
  findMasterRecordsForBatch,
  findActiveMasterRecordsForUpdate,
  countActiveMasterRecords,
  countActiveMasterRecordWarnings,
  findHighestMasterRecordSourceRow,
  findActiveMasterRecordsForCopy,
  deleteMasterRecordsByMasterFileId,
  deleteMasterFileById,
};
