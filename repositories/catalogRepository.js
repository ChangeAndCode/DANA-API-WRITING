const UnitOfMeasureCatalog = require("../models/UnitOfMeasureCatalog");
const CountryCatalog = require("../models/CountryCatalog");

const MODELS = { uom: UnitOfMeasureCatalog, countries: CountryCatalog };
const getModel = (type) => MODELS[type];

const list = (type, { includeInactive = false } = {}) =>
  getModel(type)
    .find(includeInactive ? {} : { isActive: true })
    .sort({ code: 1 })
    .populate("createdBy updatedBy", "displayName email")
    .lean();

const count = (type) => getModel(type).countDocuments();
const findById = (type, id) => getModel(type).findById(id);
const findByCode = (type, code) => getModel(type).findOne({ code });
const create = (type, data) => getModel(type).create(data);
const update = (type, id, data) =>
  getModel(type).findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
const insertMany = (type, entries) =>
  getModel(type).insertMany(entries, { ordered: false });
const deleteById = (type, id) => getModel(type).findByIdAndDelete(id);

module.exports = { list, count, findById, findByCode, create, update, insertMany, deleteById };
