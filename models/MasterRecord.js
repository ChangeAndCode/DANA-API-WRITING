const mongoose = require("mongoose");

const VALID_MASTER_SITES = ["gaiim", "p1a"];

const VALID_MASTER_TYPES = [
  "finishedProduct",
  "rawMaterial",
];

const rawCellSchema = new mongoose.Schema(
  {
    header: {
      type: String,
      required: true,
      trim: true,
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

    value: {
      type: mongoose.Schema.Types.Mixed,
      default: "",
    },
  },
  {
    _id: false,
  },
);

const validationWarningSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      trim: true,
      default: "",
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    field: {
      type: String,
      trim: true,
      default: "",
    },

    originalValue: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    _id: false,
  },
);

const fdaAffirmationSchema = new mongoose.Schema(
  {
    sequence: {
      type: Number,
      min: 1,
      max: 6,
    },

    code: {
      type: String,
      trim: true,
      default: "",
    },

    qualifier: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  },
);

const normalizedValuesSchema = new mongoose.Schema(
  {
    productFamily: {
      type: String,
      trim: true,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    unitWeightLb: {
      type: Number,
    },

    materialCostUsd: {
      type: Number,
    },

    dutiableValueUsd: {
      type: Number,
    },

    unitCostUsd: {
      type: Number,
    },

    addedValueUsd: {
      type: Number,
    },

    totalUnitCostUsd: {
      type: Number,
    },

    unitOfMeasure: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    countryOfOrigin: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    importationHtsCode: {
      type: String,
      trim: true,
      default: "",
    },

    exportationHtsCode: {
      type: String,
      trim: true,
      default: "",
    },

    scheduleBCode: {
      type: String,
      trim: true,
      default: "",
    },

    eccn: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    usmlItar: {
      type: String,
      trim: true,
      default: "",
    },

    licenseNumber: {
      type: String,
      trim: true,
      default: "",
    },

    licenseException: {
      type: String,
      trim: true,
      default: "",
    },

    licenseExpirationDate: {
      type: Date,
    },

    fdaProductCode: {
      type: String,
      trim: true,
      default: "",
    },

    fdaStorage: {
      type: String,
      trim: true,
      default: "",
    },

    fdaCountryOfOrigin: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    fdaMarker: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    fdaAffirmations: {
      type: [fdaAffirmationSchema],
      default: [],
    },

    descriptionForCustoms: {
      type: String,
      trim: true,
      default: "",
    },

    compositionMaterial: {
      type: String,
      trim: true,
      default: "",
    },

    mainFunction: {
      type: String,
      trim: true,
      default: "",
    },

    technicalInformation: {
      type: String,
      trim: true,
      default: "",
    },

    spanishDescription: {
      type: String,
      trim: true,
      default: "",
    },

    mxTariffCode: {
      type: String,
      trim: true,
      default: "",
    },

    regulations: {
      type: String,
      trim: true,
      default: "",
    },

    comments: {
      type: String,
      trim: true,
      default: "",
    },

    clientComments: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
    minimize: false,
  },
);

const masterRecordSchema = new mongoose.Schema(
  {
    masterFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MasterFile",
      required: true,
      index: true,
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
        message: "El registro debe pertenecer al menos a una sede.",
      },
    },

    partNumber: {
      type: String,
      required: true,
      trim: true,
    },

    partNumberNormalized: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    sourceRow: {
      type: Number,
      required: true,
      min: 1,
    },

    rawCells: {
      type: [rawCellSchema],
      default: [],
    },

    normalizedValues: {
      type: normalizedValuesSchema,
      default: () => ({}),
    },

    validationWarnings: {
      type: [validationWarningSchema],
      default: [],
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

masterRecordSchema.pre(
  "validate",
  function normalizeRecordValues(next) {
    if (Array.isArray(this.sites)) {
      this.sites = [
        ...new Set(
          this.sites
            .map((site) =>
              String(site || "").trim().toLowerCase(),
            )
            .filter(Boolean),
        ),
      ];
    }

    if (this.partNumber) {
      this.partNumber = String(this.partNumber).trim();

      this.partNumberNormalized = this.partNumber
        .toUpperCase();
    }

    next();
  },
);

masterRecordSchema.index({
  sites: 1,
  masterType: 1,
  partNumberNormalized: 1,
  isDeleted: 1,
});

masterRecordSchema.index(
  {
    masterFileId: 1,
    sourceRow: 1,
  },
  {
    unique: true,
  },
);

module.exports = mongoose.model(
  "MasterRecord",
  masterRecordSchema,
);