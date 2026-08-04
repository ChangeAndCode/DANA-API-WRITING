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
      "Customer Description",

    aliases: [
      "Customer Description / DESCRIPTION",
      "Description",
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

  productfamily: {
    target: "productFamily",
    transform: "text",
  },

  description: {
    target: "description",
    transform: "text",
  },

  unitnetweightg: {
    target: "unitNetWeight",
    transform: "number",
    sourceUnit: "g",
  },

  unitweightlb: {
    target: "unitNetWeight",
    transform: "pounds",
    sourceUnit: "lb",
  },

  materialcostusd: {
    target: "materialCostUsd",
    transform: "number",
  },

  dutiablevalue: {
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

  totalunitcost: {
    target: "totalUnitCostUsd",
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

  descriptionforcustomspurposes: {
    target: "descriptionForCustoms",
    transform: "text",
  },

  compositionmaterial: {
    target: "compositionMaterial",
    transform: "text",
  },

  mainfunction: {
    target: "mainFunction",
    transform: "text",
  },

  technicalinformation: {
    target: "technicalInformation",
    transform: "text",
  },

  spanishdescription: {
    target: "spanishDescription",
    transform: "text",
  },

  mxtariffcode: {
    target: "mxTariffCode",
    transform: "hts",
  },

  regulations: {
    target: "regulations",
    transform: "text",
  },

  comentarios: {
    target: "comments",
    transform: "text",
  },

  comments: {
    target: "comments",
    transform: "text",
  },

  clientcomments: {
    target: "clientComments",
    transform: "text",
  },

  frontrear: {
    target: "frontRear",
    transform: "uppercaseText",
  },
  ...EXPORTATION_HTS_HEADER_RULES,
  ...LICENSE_NUMBER_HEADER_RULES,
  ...LICENSE_EXCEPTION_HEADER_RULES,
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

  itemtypebygroupproductfamily: {
    target: "productFamily",
    transform: "text",
  },

  unitnetweightkgs: {
    target: "unitNetWeight",
    transform: "number",
    sourceUnit: "kg",
  },

  unitnetweightkg: {
    target: "unitNetWeight",
    transform: "number",
    sourceUnit: "kg",
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

  uom: {
    target: "uom",
    transform: "text",
  },

  countryoforigin: {
    target: "countryOfOrigin",
    transform: "country",
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

  descriptionforcustomspurposesenglish: {
    target: "descriptionForCustoms",
    transform: "text",
  },

  descriptionforcustomspurposes: {
    target: "descriptionForCustoms",
    transform: "text",
  },

  technicalinformationcompositionmaterial: {
    target: "technicalInformation",
    transform: "text",
  },

  compositionmaterial: {
    target: "compositionMaterial",
    transform: "text",
  },

  functionandspecificuse: {
    target: "mainFunction",
    transform: "text",
  },

  mainfunction: {
    target: "mainFunction",
    transform: "text",
  },

  spanishdescription: {
    target: "spanishDescription",
    transform: "text",
  },

  mxtariffcode: {
    target: "mxTariffCode",
    transform: "hts",
  },

  regulations: {
    target: "regulations",
    transform: "text",
  },

  comments: {
    target: "comments",
    transform: "text",
  },

  comentarios: {
    target: "comments",
    transform: "text",
  },

  clientcomments: {
    target: "clientComments",
    transform: "text",
  },
  ...EXPORTATION_HTS_HEADER_RULES,
  ...LICENSE_NUMBER_HEADER_RULES,
  ...LICENSE_EXCEPTION_HEADER_RULES,
  ...LICENSE_EXPIRATION_DATE_HEADER_RULES,
  ...USML_ITAR_HEADER_RULES,
});

const BOM_CUSTOMIZER_HEADER_RULES =
  Object.freeze(
    Object.fromEntries(
      Array.from(
        { length: 10 },
        (_, index) => {
          const number = index + 1;

          return [
            `customizer${number}`,
            Object.freeze({
              target: `customizer${number}`,
              transform: "text",
            }),
          ];
        },
      ),
    ),
  );

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

    description: {
      target: "description",
      transform: "text",
    },

    unitvalueusd: {
      target: "unitCostUsd",
      transform: "number",
    },

    addedvalueusd: {
      target: "addedValueUsd",
      transform: "number",
    },

    totalvalueusd: {
      target: "totalValueUsd",
      transform: "number",
    },

    unitnetweight: {
      target: "unitNetWeight",
      transform: "number",
    },

    countryoforigin: {
      target: "countryOfOrigin",
      transform: "country",
    },

    eccn: {
      target: "eccn",
      transform: "uppercaseText",
    },

    usimphtscode: {
      target: "importationHtsCode",
      transform: "hts",
    },

    usexphtscode: {
      target: "exportationHtsCode",
      transform: "hts",
    },

    regime: {
      target: "regime",
      transform: "text",
    },

    brand: {
      target: "brand",
      transform: "text",
    },

    model: {
      target: "model",
      transform: "text",
    },

    serial: {
      target: "serial",
      transform: "text",
    },

    powersourcetype: {
      target: "powerSourceType",
      transform: "text",
    },

    capacity: {
      target: "capacity",
      transform: "text",
    },

    mainfunction: {
      target: "mainFunction",
      transform: "text",
    },

    ponumber: {
      target: "poNumber",
      transform: "text",
    },

    ...LICENSE_NUMBER_HEADER_RULES,
    ...LICENSE_EXCEPTION_HEADER_RULES,
    ...BOM_CUSTOMIZER_HEADER_RULES,
  });



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
    ],

    requiredMappedFields: [
      "partNumber",
      "description",
    ],

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

module.exports = {
  MASTER_TYPES,
  MASTER_FILE_REGISTRY,
  normalizeMasterHeader,
  getMasterFileConfig,
  detectMasterTypeBySheetNames,
  getMasterHeaderRule,
  shouldIgnoreMasterHeader,
};
