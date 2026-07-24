// data/masterFileRegistry.js

const MASTER_TYPES = Object.freeze({
  FINISHED_PRODUCT: "finishedProduct",
  RAW_MATERIAL: "rawMaterial",
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
    target: "unitWeightLb",
    transform: "gramsToPounds",
  },

  materialcostusd: {
    target: "materialCostUsd",
    transform: "number",
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

  usmilno: {
    target: "usmlItar",
    transform: "text",
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
});

/**
 * Reglas para Raw Material.
 */
const RAW_MATERIAL_HEADER_RULES = Object.freeze({
  partnumber: {
    target: "partNumber",
    transform: "partNumber",
  },

  itemtypebygroupproductfamily: {
    target: "productFamily",
    transform: "text",
  },

  customerdescription: {
    target: "description",
    transform: "text",
  },

  description: {
    target: "description",
    transform: "text",
  },

  unitnetweightkgs: {
    target: "unitWeightLb",
    transform: "kilogramsToPounds",
  },

  unitnetweightkg: {
    target: "unitWeightLb",
    transform: "kilogramsToPounds",
  },

  unitnetweightlbs: {
    target: "unitWeightLb",
    transform: "pounds",
  },

  unitnetweightlb: {
    target: "unitWeightLb",
    transform: "pounds",
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
    target: "unitOfMeasure",
    transform: "uom",
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

    requiredHeaderKeys: [
      "partnumber",
      "description",
    ],

    headerRules: FINISHED_PRODUCT_HEADER_RULES,
  }),

  [MASTER_TYPES.RAW_MATERIAL]: Object.freeze({
    masterType: MASTER_TYPES.RAW_MATERIAL,

    displayName: "Raw Material",

    sheetNames: [
      "RawMatlCat",
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

    requiredHeaderKeys: [
      "partnumber",
      "customerdescription",
    ],

    columnRules: {
      I: {
        target: "scheduleBCode",
        transform: "hts",
      },
    },

    headerRules: RAW_MATERIAL_HEADER_RULES,
  }),
});

/**
 * Busca la configuración por tipo interno.
 */
const getMasterFileConfig = (masterType) => {
  const config = MASTER_FILE_REGISTRY[masterType];

  if (!config) {
    throw new Error(
      `Tipo de archivo madre desconocido: ${masterType}`,
    );
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