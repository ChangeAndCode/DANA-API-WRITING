const mongoose = require("mongoose");

const unitOfMeasureCatalogSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 3, unique: true, index: true },
    description: { type: String, required: true, trim: true },
    origin: { type: String, trim: true, uppercase: true, maxlength: 3, default: "" },
    allowsDecimals: { type: Boolean, default: false },
    aliases: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("UnitOfMeasureCatalog", unitOfMeasureCatalogSchema);
