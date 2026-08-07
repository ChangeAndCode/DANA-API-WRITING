const mongoose = require("mongoose");
const { VALID_SITES } = require("../data/siteConfig");
const {
  MASTER_TYPES,
} = require("../data/masterFileRegistry");

const summarySchema = new mongoose.Schema(
  {
    total: { type: Number, required: true, min: 0 },
    added: { type: Number, required: true, min: 0 },
    updated: { type: Number, required: true, min: 0 },
    unchanged: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const masterFileSyncAuditSchema = new mongoose.Schema(
  {
    adminDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      required: true,
      enum: Object.values(MASTER_TYPES),
      index: true,
    },
    adminFileName: {
      type: String,
      trim: true,
      default: "",
    },
    masterFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MasterFile",
      required: true,
      index: true,
    },
    masterFileName: {
      type: String,
      trim: true,
      default: "",
    },
    site: {
      type: String,
      enum: VALID_SITES,
      required: true,
      index: true,
    },
    appliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sftpRemoteFileName: {
      type: String,
      trim: true,
      default: "",
    },
    summary: {
      type: summarySchema,
      required: true,
    },
  },
  { timestamps: true },
);

masterFileSyncAuditSchema.index({
  adminDocumentId: 1,
  documentType: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "MasterFileSyncAudit",
  masterFileSyncAuditSchema,
);
