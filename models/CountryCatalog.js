const mongoose = require("mongoose");

const countryCatalogSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, minlength: 2, maxlength: 2, unique: true, index: true },
    description: { type: String, required: true, trim: true },
    aliases: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CountryCatalog", countryCatalogSchema);
