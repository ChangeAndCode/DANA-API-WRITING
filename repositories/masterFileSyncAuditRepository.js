const MasterFileSyncAudit = require(
  "../models/MasterFileSyncAudit"
);
const MasterFileSyncChange = require(
  "../models/MasterFileSyncChange"
);

const getSessionOptions = (session) =>
  session ? { session } : {};

const createAudit = async (data, session = null) => {
  const [audit] = await MasterFileSyncAudit.create(
    [data],
    getSessionOptions(session),
  );
  return audit;
};

const insertChanges = async (changes, session = null) => {
  if (!Array.isArray(changes) || changes.length === 0) {
    return [];
  }

  return MasterFileSyncChange.insertMany(changes, {
    ordered: true,
    ...getSessionOptions(session),
  });
};

const findAuditsForAdminDocument = async ({
  adminDocumentId,
  documentType,
  limit = 20,
}) => {
  return MasterFileSyncAudit.find({
    adminDocumentId,
    documentType,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("appliedBy", "displayName email")
    .lean();
};

const findAuditByIdForAdminDocument = async ({
  auditId,
  adminDocumentId,
  documentType,
}) => {
  return MasterFileSyncAudit.findOne({
    _id: auditId,
    adminDocumentId,
    documentType,
  })
    .populate("appliedBy", "displayName email")
    .lean();
};

const findChangesByAuditId = async (auditId) => {
  return MasterFileSyncChange.find({ auditId })
    .sort({ action: 1, sourceRow: 1 })
    .lean();
};

module.exports = {
  createAudit,
  insertChanges,
  findAuditsForAdminDocument,
  findAuditByIdForAdminDocument,
  findChangesByAuditId,
};
