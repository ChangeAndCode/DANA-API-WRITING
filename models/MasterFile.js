const mongoose = require("mongoose");

const VALID_MASTER_SITES = ["gaiim", "p1a"];

const VALID_MASTER_TYPES = [
  "finishedProduct",
  "rawMaterial",
  "billOfMaterials",
];

const masterFileHeaderSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
    },

    normalizedName: {
      type: String,
      trim: true,
      default: "",
    },

    columnIndex: {
      type: Number,
      required: true,
      min: 1,
    },

    columnLetter: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    mappedField: {
      type: String,
      trim: true,
      default: "",
    },

    ignored: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  },
);

const masterFileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    originalFileName: {
      type: String,
      required: true,
      trim: true,
    },

    masterType: {
      type: String,
      required: true,
      enum: VALID_MASTER_TYPES,
      index: true,
    },

    sites: {
      type: [
        {
          type: String,
          enum: VALID_MASTER_SITES,
        },
      ],
      required: true,
      validate: {
        validator(sites) {
          return Array.isArray(sites) && sites.length > 0;
        },
        message: "El archivo madre debe pertenecer al menos a una sede.",
      },
    },

    sourceSheet: {
      type: String,
      required: true,
      trim: true,
    },

    headerRow: {
      type: Number,
      required: true,
      min: 1,
      default: 8,
    },

    partNumberColumn: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: "A",
    },

    headers: {
      type: [masterFileHeaderSchema],
      default: [],
    },

    recordCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    imageCountIgnored: {
      type: Number,
      default: 0,
      min: 0,
    },

    fileSizeBytes: {
      type: Number,
      default: 0,
      min: 0,
    },

    checksum: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "ready",
        "failed",
      ],
      default: "pending",
      index: true,
    },

    warningCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    importWarnings: {
      type: [String],
      default: [],
    },

    revision: {
      type: Number,
      default: 1,
      min: 1,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    lastImportedAt: {
      type: Date,
    },

    errorMessage: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

masterFileSchema.pre("validate", function normalizeSites(next) {
  if (Array.isArray(this.sites)) {
    this.sites = [
      ...new Set(
        this.sites
          .map((site) => String(site || "").trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
  }

  next();
});

masterFileSchema.index({
  sites: 1,
  masterType: 1,
  status: 1,
});

masterFileSchema.index({
  originalFileName: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "MasterFile",
  masterFileSchema,
);