const mongoose = require("mongoose");

const catalogAuditSchema = new mongoose.Schema(
  {
    catalogType: { type: String, required: true, enum: ["uom", "countries"], index: true },
    entryId: { type: mongoose.Schema.Types.ObjectId, index: true },
    code: { type: String, required: true, trim: true, uppercase: true, index: true },
    action: { type: String, required: true, enum: ["created", "updated", "activated", "deactivated", "deleted"], index: true },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

catalogAuditSchema.index({ catalogType: 1, createdAt: -1 });

module.exports = mongoose.model("CatalogAudit", catalogAuditSchema);
