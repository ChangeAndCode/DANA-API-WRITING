const CatalogAudit = require("../models/CatalogAudit");

const create = (data) => CatalogAudit.create(data);

const list = ({ catalogType, limit = 200 }) =>
  CatalogAudit.find({ catalogType })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 200, 1), 500))
    .populate("performedBy", "displayName email")
    .lean();

module.exports = { create, list };
