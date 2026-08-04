// data/masterFileRegistry.js

const MASTER_TYPES = Object.freeze({
  FINISHED_PRODUCT: "finishedProduct",
  RAW_MATERIAL: "rawMaterial",
  BILL_OF_MATERIALS: "billOfMaterials",
});

/**
 * Normaliza un encabezado para poder compararlo.
 *
 * Ejemplos:
 * "Unit Net Weight (g)" -> "unitnetweightg"
 * "Country of Origin"  -> "countryoforigin"
 * "USMIL No."          -> "usmilno"
 */
const normalizeMasterHeader = (value) => {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
};

const createMasterHeaderAliasRules = ({
  dataElement,
  aliases = [],
  target,
  transform,
  ...options
}) => {
  const rule = Object.freeze({
    target,
    transform,
    ...options,
  });

  const acceptedHeaders = [
    dataElement,
    ...aliases,
  ];

  return Object.freeze(
    Object.fromEntries(
      acceptedHeaders.map((header) => [
        normalizeMasterHeader(header),
        rule,
      ]),
    ),
  );
};

const EXPORTATION_HTS_HEADER_RULES =
  createMasterHeaderAliasRules({
    dataElement:
      "Exportation HTS Code",
    aliases: [
      "US Exportation HTS Code",
      "USA Exportation HTS Code",
      "Export HTS Code",
      "US Export HTS Code",
      "USA Export HTS Code",
      "Exportation Code",
      "US Exportation Code",
      "USA Exportation Code",
    ],
    target:
      "exportationHtsCode",
    transform:
      "hts",
  });

const RAW_MATERIAL_DESCRIPTION_HEADER_RULES =
  createMasterHeaderAliasRules({
    dataElement:
      "Description",

    aliases: [
      "Customer Description",
      "Customer Description / DESCRIPTION",
    ],

    target:
      "description",

    transform:
      "text",
  });

const LICENSE_NUMBER_HEADER_RULES =
  createMasterHeaderAliasRules({
    dataElement:
      "License Number (LCN)",

    aliases: [
      "License No.",
      "License No",
      "License Number",
      "License #",
      "LCN",
    ],

    target:
      "licenseNumber",

    transform:
      "text",
  });

const LICENSE_EXCEPTION_HEADER_RULES =
  createMasterHeaderAliasRules({
    dataElement:
      "License Exception",

    aliases: [
      "Lic Exception",
      "Exception",
    ],

    target:
      "licenseException",

    transform:
      "text",
  });

const LICENSE_EXPIRATION_DATE_HEADER_RULES =
  createMasterHeaderAliasRules({
    dataElement:
      "License Expiration date",

    aliases: [
      "License Exception Date",
      "Lic Exp Date",
      "Expiration Date",
      "Expires On",
    ],

    target:
      "licenseExpirationDate",

    transform:
      "date",
  });

const USML_ITAR_HEADER_RULES =
  createMasterHeaderAliasRules({
    dataElement:
      "USML (ITAR)",

    aliases: [
      "USML",
      "ITAR",
      "USMIL No.",
      "USMIL No",
    ],

    target:
      "usmlItar",

    transform:
      "text",
  });

/**
 * Reglas de encabezados para Finished Goods.
 *
 * target:
 * Campo dentro de normalizedValues.
 *
 * transform:
 * Indica al futuro parser cómo transformar el valor.
 */
const FINISHED_PRODUCT_HEADER_RULES = Object.freeze({
  partnumber: {
    target: "partNumber",
    transform: "partNumber",
  },

  description: {
    target: "description",
    transform: "text",
  },

  unitweightlb: {
    target: "unitNetWeight",
    transform: "pounds",
    sourceUnit: "lb",
  },

  dutiablevalue: {
    target: "dutiableValueUsd",
    transform: "number",
  },

  dutiablevalueusd: {
    target: "dutiableValueUsd",
    transform: "number",
  },

  filler: {
    target: "filler",
    transform: "text",
  },

  addedvalueusd: {
    target: "addedValueUsd",
    transform: "number",
  },

  unitofmeasure: {
    target: "unitOfMeasure",
    transform: "uom",
  },

  countryoforigin: {
    target: "countryOfOrigin",
    transform: "country",
  },

  usaimportationhtscode: {
    target: "importationHtsCode",
    transform: "hts",
  },

  usimportationhtscode: {
    target: "importationHtsCode",
    transform: "hts",
  },

  fdaproductcode: {
    target: "fdaProductCode",
    transform: "text",
  },

  fdastorage: {
    target: "fdaStorage",
    transform: "text",
  },

  fdacountryorigin: {
    target: "fdaCountryOfOrigin",
    transform: "country",
  },

  fdacountryoforigin: {
    target: "fdaCountryOfOrigin",
    transform: "country",
  },

  fdamarker: {
    target: "fdaMarker",
    transform: "uppercaseText",
  },

  fdaaffirmationofcompliancecode1: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 1,
    component: "code",
  },

  fdaaffirmationofcompliancequalifier1: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 1,
    component: "qualifier",
  },

  fdaaffirmationofcompliancecode2: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 2,
    component: "code",
  },

  fdaaffirmationofcompliancequalifier2: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 2,
    component: "qualifier",
  },

  fdaaffirmationofcompliancecode3: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 3,
    component: "code",
  },

  fdaaffirmationofcompliancequalifier3: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 3,
    component: "qualifier",
  },

  fdaaffirmationofcompliancecode4: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 4,
    component: "code",
  },

  fdaaffirmationofcompliancequalifier4: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 4,
    component: "qualifier",
  },

  fdaaffirmationofcompliancecode5: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 5,
    component: "code",
  },

  fdaaffirmationofcompliancequalifier5: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 5,
    component: "qualifier",
  },

  fdaaffirmationofcompliancecode6: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 6,
    component: "code",
  },

  fdaaffirmationofcompliancequalifier6: {
    target: "fdaAffirmations",
    transform: "fdaAffirmation",
    sequence: 6,
    component: "qualifier",
  },

  ...createMasterHeaderAliasRules({
    dataElement: "NAFTA",
    aliases: ["NAFTA Eligible"],
    target: "nafta",
    transform: "uppercaseText",
  }),

  ...createMasterHeaderAliasRules({
    dataElement: "Preference Criterion",
    aliases: ["NAFTA Criterion"],
    target: "preferenceCriterion",
    transform: "uppercaseText",
  }),

  ...createMasterHeaderAliasRules({
    dataElement: "Producer",
    aliases: ["NAFTA Producer"],
    target: "producer",
    transform: "text",
  }),

  ...createMasterHeaderAliasRules({
    dataElement: "Net Cost",
    aliases: ["NAFTA Net Cost"],
    target: "netCost",
    transform: "uppercaseText",
  }),

  ...createMasterHeaderAliasRules({
    dataElement: "Period (From)",
    aliases: ["NAFTA From", "Start Date"],
    target: "periodFrom",
    transform: "date",
  }),

  ...createMasterHeaderAliasRules({
    dataElement: "Period (To)",
    aliases: ["NAFTA To", "End Date"],
    target: "periodTo",
    transform: "date",
  }),

  ...EXPORTATION_HTS_HEADER_RULES,
  ...USML_ITAR_HEADER_RULES,
});

/**
 * Reglas para Raw Material.
 */
const RAW_MATERIAL_HEADER_RULES = Object.freeze({
  partnumber: {
    target: "partNumber",
    transform: "partNumber",
  },

  ...RAW_MATERIAL_DESCRIPTION_HEADER_RULES,

  unitweightlb: {
    target: "unitNetWeight",
    transform: "pounds",
    sourceUnit: "lb",
  },

  unitnetweightlbs: {
    target: "unitNetWeight",
    transform: "number",
    sourceUnit: "lb",
  },

  unitnetweightlb: {
    target: "unitNetWeight",
    transform: "number",
    sourceUnit: "lb",
  },

  unitvalueusd: {
    target: "unitCostUsd",
    transform: "number",
  },

  unitcostusd: {
    target: "unitCostUsd",
    transform: "number",
  },

  unitofmeasure: {
    target: "unitOfMeasure",
    transform: "uom",
  },

  countryoforigin: {
    target: "countryOfOrigin",
    transform: "country",
  },

  importationhtscode: {
    target: "importationHtsCode",
    transform: "hts",
  },

  usimportationhtscode: {
    target: "importationHtsCode",
    transform: "hts",
  },

  usaimportationhtscode: {
    target: "importationHtsCode",
    transform: "hts",
  },

  eccn: {
    target: "eccn",
    transform: "uppercaseText",
  },

  filler: {
    target: "filler",
    transform: "text",
  },

  ...EXPORTATION_HTS_HEADER_RULES,
  ...LICENSE_NUMBER_HEADER_RULES,
  ...LICENSE_EXCEPTION_HEADER_RULES,
  ...LICENSE_EXPIRATION_DATE_HEADER_RULES,
  ...USML_ITAR_HEADER_RULES,
});

const BILL_OF_MATERIALS_HEADER_RULES =
  Object.freeze({
    finishedgoodpartnumber: {
      target: "partNumber",
      transform: "partNumber",
    },

    componentpartnumber: {
      target: "componentPartNumber",
      transform: "partNumber",
    },

    type: {
      target: "bomType",
      transform: "uppercaseText",
    },

    quantity: {
      target: "quantity",
      transform: "number",
    },

    unitofmeasure: {
      target: "unitOfMeasure",
      transform: "uom",
    },

    componentclassification: {
      target: "componentClassification",
      transform: "text",
    },

  });


const FINISHED_PRODUCT_CANONICAL_HEADERS =
  Object.freeze([
    "Part Number",
    "Description",
    "Unit Weight Lb.",
    "Dutiable Value (USD)",
    "Filler",
    "Added Value (USD)",
    "Unit of Measure",
    "Country of Origin",
    "USA Importation HTS Code",
    "USA Exportation Code",
    "FDA Product Code",
    "FDA Storage",
    "FDA Country of Origin",
    "FDA Marker",
    ...Array.from(
      { length: 6 },
      (_, index) => [
        `FDA Affirmation of Compliance Code ${index + 1}`,
        `FDA Affirmation of Compliance Qualifier ${index + 1}`,
      ],
    ).flat(),
    "NAFTA",
    "Preference Criterion",
    "Producer",
    "Net Cost",
    "Period (From)",
    "Period (To)",
    "USML (ITAR)",
  ]);

const RAW_MATERIAL_CANONICAL_HEADERS =
  Object.freeze([
    "Part Number",
    "Description",
    "Unit Weight Lb.",
    "Unit Cost (USD)",
    "Unit of Measure",
    "Country of Origin",
    "Importation HTS Code",
    "Exportation HTS Code",
    "ECCN",
    "Filler",
    "License Number (LCN)",
    "License Exception",
    "License Expiration date",
    "USML (ITAR)",
  ]);

const BILL_OF_MATERIALS_CANONICAL_HEADERS =
  Object.freeze([
    "Finished Good Part Number",
    "Component Part Number",
    "Type",
    "Quantity",
    "Unit of Measure",
    "Component classification",
  ]);


/**
 * Configuración de los dos tipos de archivos madre.
 *
 * No se configura por nombre de archivo porque el usuario puede
 * renombrarlo. Se detecta usando la hoja y los encabezados.
 */
const MASTER_FILE_REGISTRY = Object.freeze({
  [MASTER_TYPES.FINISHED_PRODUCT]: Object.freeze({
    masterType: MASTER_TYPES.FINISHED_PRODUCT,

    displayName: "Finished Goods",

    sheetNames: [
      "FG_Catalog",
      "FS E",
    ],

    ignoredSheetNames: [
      "Catalogs",
      "keys",
    ],

    headerRow: 8,

    partNumberHeaderKeys: [
      "partnumber",
      "partno",
    ],

    ignoredHeaderKeys: [
      "image",
      "frontrear",
    ],

    requiredMappedFields: [
      "partNumber",
      "description",
    ],

    canonicalHeaders:
      FINISHED_PRODUCT_CANONICAL_HEADERS,

    headerRules: FINISHED_PRODUCT_HEADER_RULES,
  }),

  [MASTER_TYPES.RAW_MATERIAL]: Object.freeze({
    masterType: MASTER_TYPES.RAW_MATERIAL,

    displayName: "Raw Material",

    sheetNames: [
      "RawMatlCat",
      "RM E",
    ],

    ignoredSheetNames: [
      "Catalogs",
      "keys",
    ],

    headerRow: 8,

    partNumberHeaderKeys: [
      "partnumber",
      "partno",
    ],

    ignoredHeaderKeys: [
      "image",
    ],

    requiredMappedFields: [
      "partNumber",
      "description",
    ],

    canonicalHeaders:
      RAW_MATERIAL_CANONICAL_HEADERS,

    headerRules: RAW_MATERIAL_HEADER_RULES,
  }),

  [MASTER_TYPES.BILL_OF_MATERIALS]:
  Object.freeze({
    masterType:
      MASTER_TYPES.BILL_OF_MATERIALS,

    displayName: "Bill of Materials",

    sheetNames: [
      "BOMs",
      "BOM E",
    ],

    ignoredSheetNames: [
      "Catalogs",
      "keys",
    ],

    headerRow: 1,

    partNumberHeaderKeys: [
      "finishedgoodpartnumber",
    ],

    ignoredHeaderKeys: [
      "image",
    ],

    requiredMappedFields: [
      "partNumber",
      "componentPartNumber",
      "bomType",
      "quantity",
      "unitOfMeasure",
      "componentClassification",
    ],

    allowDuplicatePartNumbers: true,

    canonicalHeaders:
      BILL_OF_MATERIALS_CANONICAL_HEADERS,

    headerRules:
      BILL_OF_MATERIALS_HEADER_RULES,
  }),
});



/**
 * Busca la configuración por tipo interno.
 */
const getMasterFileConfig = (masterType, sourceSheetName = "") => {
  const config = MASTER_FILE_REGISTRY[masterType];

  if (!config) {
    throw new Error(
      `Tipo de archivo madre desconocido: ${masterType}`,
    );
  }

  const normalizedSheetName = String(sourceSheetName || "")
    .trim()
    .toLowerCase();

  if (["fs e", "rm e"].includes(normalizedSheetName)) {
    return {
      ...config,
      headerRow: 1,
    };
  }

  if (normalizedSheetName === "bom e") {
    return {
      ...config,
      headerRow: 1,
      requiredMappedFields: config.requiredMappedFields.filter(
        (field) => field !== "componentClassification",
      ),
    };
  }

  return config;
};

/**
 * Detecta el tipo según las hojas encontradas en el workbook.
 */
const detectMasterTypeBySheetNames = (sheetNames = []) => {
  const normalizedSheetNames = sheetNames.map((name) =>
    String(name || "").trim().toLowerCase(),
  );

  for (const config of Object.values(MASTER_FILE_REGISTRY)) {
    const matches = config.sheetNames.some((expectedName) =>
      normalizedSheetNames.includes(
        expectedName.toLowerCase(),
      ),
    );

    if (matches) {
      return config.masterType;
    }
  }

  return null;
};



/**
 * Obtiene la regla de mapeo de un encabezado.
 */
const getMasterHeaderRule = (
  masterType,
  originalHeader,
) => {
  const config = getMasterFileConfig(masterType);
  const normalizedHeader =
    normalizeMasterHeader(originalHeader);

  return (
    config.headerRules[normalizedHeader] || null
  );
};

/**
 * Indica si una columna debe ignorarse.
 */
const shouldIgnoreMasterHeader = (
  masterType,
  originalHeader,
) => {
  const config = getMasterFileConfig(masterType);
  const normalizedHeader =
    normalizeMasterHeader(originalHeader);

  return config.ignoredHeaderKeys.includes(
    normalizedHeader,
  );
};

const filterIgnoredMasterHeaders = (
  masterType,
  headers = [],
) => {
  if (!Array.isArray(headers)) return [];

  return headers.filter((header) => {
    const headerName =
      header?.originalName ||
      header?.normalizedName;

    return (
      !shouldIgnoreMasterHeader(
        masterType,
        headerName,
      ) &&
      Boolean(
        getMasterHeaderRule(
          masterType,
          headerName,
        ),
      )
    );
  });
};

const toExcelColumnLetter = (
  columnIndex,
) => {
  let value = Number(columnIndex);
  let result = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result =
      String.fromCharCode(
        65 + remainder,
      ) + result;
    value = Math.floor(
      (value - 1) / 26,
    );
  }

  return result;
};

/**
 * Devuelve el esquema publico y estable que usan editor,
 * copias y descargas. Los alias solo se utilizan al leer.
 */
const getCanonicalMasterHeaders = (
  masterType,
) => {
  const config =
    getMasterFileConfig(masterType);

  return config.canonicalHeaders.map(
    (originalName, index) => {
      const normalizedName =
        normalizeMasterHeader(
          originalName,
        );
      const rule =
        config.headerRules[
          normalizedName
        ];

      if (!rule) {
        throw new Error(
          `El encabezado canonico "${originalName}" no tiene una regla para "${masterType}".`,
        );
      }

      const columnIndex =
        index + 1;

      return {
        originalName,
        normalizedName,
        columnIndex,
        columnLetter:
          toExcelColumnLetter(
            columnIndex,
          ),
        mappedField:
          rule.target,
        ignored: false,
      };
    },
  );
};

const filterMasterNormalizedValues = (
  masterType,
  normalizedValues = {},
) => {
  const config =
    getMasterFileConfig(masterType);

  const sourceValues =
    typeof normalizedValues?.toObject ===
    "function"
      ? normalizedValues.toObject()
      : normalizedValues;

  if (
    !sourceValues ||
    typeof sourceValues !== "object" ||
    Array.isArray(sourceValues)
  ) {
    return {};
  }

  const allowedFields =
    new Set(
      Object.values(
        config.headerRules,
      )
        .map((rule) => rule.target)
        .filter(
          (target) =>
            target !== "partNumber",
        ),
    );

  if (allowedFields.has("unitNetWeight")) {
    allowedFields.add(
      "unitNetWeightSourceUnit",
    );
  }

  return Object.fromEntries(
    Object.entries(sourceValues).filter(
      ([field]) =>
        allowedFields.has(field),
    ),
  );
};

module.exports = {
  MASTER_TYPES,
  MASTER_FILE_REGISTRY,
  normalizeMasterHeader,
  getMasterFileConfig,
  detectMasterTypeBySheetNames,
  getMasterHeaderRule,
  shouldIgnoreMasterHeader,
  filterIgnoredMasterHeaders,
  getCanonicalMasterHeaders,
  filterMasterNormalizedValues,
};
