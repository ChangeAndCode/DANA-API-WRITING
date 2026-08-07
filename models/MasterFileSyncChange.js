const mongoose = require("mongoose");

const changedFieldSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      required: true,
      trim: true,
    },
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
  },
  { _id: false },
);

const masterFileSyncChangeSchema = new mongoose.Schema(
  {
    auditId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MasterFileSyncAudit",
      required: true,
      index: true,
    },
    masterFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MasterFile",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["added", "updated"],
      required: true,
      index: true,
    },
    recordKey: {
      type: String,
      required: true,
      trim: true,
    },
    partNumber: {
      type: String,
      required: true,
      trim: true,
    },
    componentPartNumber: {
      type: String,
      trim: true,
      default: "",
    },
    sourceRow: {
      type: Number,
      required: true,
      min: 1,
    },
    changedFields: {
      type: [changedFieldSchema],
      default: [],
    },
  },
  { timestamps: true },
);

masterFileSyncChangeSchema.index({
  auditId: 1,
  action: 1,
  sourceRow: 1,
});

module.exports = mongoose.model(
  "MasterFileSyncChange",
  masterFileSyncChangeSchema,
);
