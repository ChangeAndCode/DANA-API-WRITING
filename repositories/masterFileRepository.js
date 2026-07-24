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
 *
 * Se utiliza un arreglo en Model.create porque Mongoose
 * maneja las sesiones/transacciones de forma consistente
 * cuando create recibe un arreglo de documentos.
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
 *
 * ordered: true detiene la operación en cuanto encuentra
 * un registro inválido. Si estamos dentro de una transacción,
 * el servicio podrá cancelar toda la carga.
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
 * Actualiza información del archivo madre.
 *
 * Se utilizará para cambiar:
 * processing -> ready
 * processing -> failed
 *
 * También podremos reutilizarlo posteriormente para revisiones.
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
 * Busca un archivo madre por ID.
 *
 * Posteriormente se utilizará para consultar, editar
 * o eliminar un archivo.
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

module.exports = {
  createMasterFile,
  insertMasterRecords,
  updateMasterFileById,
  findMasterFileById,
};