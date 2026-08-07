const mongoose = require("mongoose");

const MASTER_FILE_SYNC_STATUSES = Object.freeze([
  "not_applicable",
  "pending",
  "applying",
  "applied",
  "failed",
]);

const masterFileSyncSummarySchema = new mongoose.Schema(
  {
    total: { type: Number, default: 0, min: 0 },
    added: { type: Number, default: 0, min: 0 },
    updated: { type: Number, default: 0, min: 0 },
    unchanged: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const createMasterFileSyncSchema = ({
  defaultStatus = "pending",
} = {}) => {
  if (!MASTER_FILE_SYNC_STATUSES.includes(defaultStatus)) {
    throw new Error("Estado inicial MF no valido.");
  }

  return new mongoose.Schema(
    {
      status: {
        type: String,
        enum: MASTER_FILE_SYNC_STATUSES,
        default: defaultStatus,
        index: true,
      },
      attempts: {
        type: Number,
        default: 0,
        min: 0,
      },
      lastAttemptAt: Date,
      appliedAt: Date,
      lastAttemptBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      lastError: {
        type: String,
        default: "",
        maxlength: 500,
      },
      masterFileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MasterFile",
      },
      masterFileName: {
        type: String,
        trim: true,
        default: "",
      },
      auditId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MasterFileSyncAudit",
      },
      summary: {
        type: masterFileSyncSummarySchema,
        default: () => ({}),
      },
    },
    { _id: false },
  );
};

module.exports = {
  MASTER_FILE_SYNC_STATUSES,
  createMasterFileSyncSchema,
};
