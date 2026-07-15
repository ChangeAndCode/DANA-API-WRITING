// services/fileConversionService.js
const path = require("path");
const fs = require("fs/promises");
const { getRegistryEntry } = require("../data/documentTypeRegistry");
const {
  parseXLSX,
  parseCSV,
  parseTXT,
  generateFilename,
} = require("../utils/fileParsers");
const {
  validateDataIntegrity,
  applyBusinessValidations,
} = require("../utils/validationUtils");
const { applyTransformations } = require("../utils/transformationUtils");
const { getDefaultFormat } = require("../utils/documentFormatRules");

const WRITE_TXT_ON_VALIDATION_ERROR =
  (process.env.WRITE_TXT_ON_VALIDATION_ERROR || "false").toLowerCase() ===
  "true";
const SPLSCRAP_TOTAL_VALUE_FIELD = "Total Value (USD)";

const parseManualNumericValue = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(/,/g, "");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDerivedNumericValue = (value) => {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round((value + Number.EPSILON) * 1e8) / 1e8;
  return rounded.toFixed(8).replace(/\.?0+$/, "");
};

const deriveSplScrapTotalValue = (row = {}) => {
  const quantity = parseManualNumericValue(row["Quantity"]);
  const unitValue = parseManualNumericValue(row["Unit Value (USD)"]);
  const addedValue = parseManualNumericValue(row["Added Value (USD)"]);

  if (quantity === null || unitValue === null || addedValue === null) {
    return "";
  }

  return formatDerivedNumericValue((unitValue + addedValue) * quantity);
};

const normalizeManualRowsForDocument = (rows, documentType) => {
  const safeRows = Array.isArray(rows) ? rows : [];

  if (documentType !== "splScrap") {
    return safeRows.map((row) =>
      row && typeof row === "object" && !Array.isArray(row) ? { ...row } : row,
    );
  }

  return safeRows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    return {
      ...row,
      [SPLSCRAP_TOTAL_VALUE_FIELD]: deriveSplScrapTotalValue(row),
    };
  });
};

const normalizeManualValidationOptions = (documentType, validationOptions = {}) => {
  if (documentType !== "splScrap") return validationOptions;

  const skippedFields = new Set(
    Array.isArray(validationOptions.skipMandatoryFields)
      ? validationOptions.skipMandatoryFields
      : [],
  );
  skippedFields.add(SPLSCRAP_TOTAL_VALUE_FIELD);

  return {
    ...validationOptions,
    skipMandatoryFields: Array.from(skippedFields),
  };
};

const getOutputBaseNameForDocument = (
  documentType,
  rows = [],
  date = new Date(),
) => {
  if (documentType === "splScrap") {
    const prefix = pickSplScrapPrefix({ Sheet1: Array.isArray(rows) ? rows : [] });
    return generateSplScrapFilename(prefix, date);
  }

  const typePrefixMap = {
    finishedProduct: "FG",
    rawMaterial: "RM",
    billOfMaterials: "BM",
  };
  const fileType = typePrefixMap[documentType];
  return fileType ? generateFilename(fileType, date) : `MANUAL_${date.getTime()}`;
};

const generateOutputFileNameForDocument = (
  documentType,
  rows = [],
  outputFormat,
  date = new Date(),
) => {
  const outputExt = outputFormat || getDefaultFormat(documentType) || "txt";
  const outputBaseName = getOutputBaseNameForDocument(documentType, rows, date);
  return `${outputBaseName}.${outputExt}`;
};

const validateTransformedDataForDocument = async (
  transformedData,
  documentType,
  validationOptions = {}
) => {
  const errorReport = [];
  const integrityResult = validateDataIntegrity(
    transformedData,
    documentType,
    validationOptions
  );

  if (!integrityResult.isValid) {
    errorReport.push(...integrityResult.errors);
  }

  if (integrityResult.isValid) {
    const businessValidationResult = await applyBusinessValidations(
      transformedData,
      documentType
    );
    if (!businessValidationResult.isValid) {
      errorReport.push(...businessValidationResult.errors);
    }
  }

  return {
    transformedData,
    errors: errorReport,
    hasErrors: errorReport.length > 0,
  };
};

const validateParsedDataForDocument = async (
  parsedData,
  documentType,
  validationOptions = {}
) => {
  const transformedData = applyTransformations(parsedData, documentType);
  return validateTransformedDataForDocument(
    transformedData,
    documentType,
    validationOptions
  );
};

const validateManualRowsForDocument = async (
  rows,
  documentType,
  validationOptions = {}
) => {
  const parsedData = {
    Sheet1: normalizeManualRowsForDocument(rows, documentType),
  };
  return validateParsedDataForDocument(
    parsedData,
    documentType,
    normalizeManualValidationOptions(documentType, validationOptions)
  );
};

// Service that encapsulates file conversion logic
const processFileForConversion = async (
  fileBuffer,
  originalName,
  outputFormat,
  conversionOptions,
  callerUserId = null,
  isAutomated = false
) => {
  const fileExtension = path.extname(originalName).toLowerCase();
  let errorReport = [];
  const { documentType } = conversionOptions;

  if (!documentType) {
    throw new Error(
      "Document type (e.g., 'finishedProduct') is required for processing."
    );
  }

  // Step 1: Parsing
  let parsedData;
  switch (fileExtension) {
    case ".xls":
    case ".xlsx":
    case ".xlsm":
      parsedData = await parseXLSX(fileBuffer, documentType);
      break;
    case ".csv":
      parsedData = await parseCSV(fileBuffer, documentType);
      break;
    case ".txt":
      parsedData = await parseTXT(fileBuffer, documentType);
      break;
    default:
      throw new Error(`Unsupported input file format: ${fileExtension}.`);
  }

  // Step 2: Transformation + Validation
  const validationResult = await validateParsedDataForDocument(
    parsedData,
    documentType
  );
  const transformedData = validationResult.transformedData;
  errorReport = validationResult.errors;
  const hasErrors = validationResult.hasErrors;

  // Step 4: (Opcional) generación del archivo de salida
  const baseName = path.parse(originalName).name;
  const outputExt = outputFormat || getDefaultFormat(documentType) || "txt";
  const isSplScrap = documentType === "splScrap";
  let convertedFilePath = null;

  if (!hasErrors || WRITE_TXT_ON_VALIDATION_ERROR) {
    let outputFileName = `${baseName}.${outputExt}`;

    // For splScrap use PI/PE + timestamp filename convention
    if (isSplScrap) {
      const prefix = pickSplScrapPrefix(transformedData);
      const generated = generateSplScrapFilename(prefix, new Date());
      outputFileName = `${generated}.${outputExt}`;
    } else {
      // FG / RM / BM usan convención TYPE + DDHHMM.MMYY
      const typePrefixMap = {
        finishedProduct: "FG",
        rawMaterial: "RM",
        billOfMaterials: "BM",
      };
      const fileType = typePrefixMap[documentType];
      if (fileType) {
        const generated = generateFilename(fileType, new Date());
        outputFileName = `${generated}.${outputExt}`;
      }
    }

    convertedFilePath = path.join(
      __dirname,
      "..",
      "temp_converted_files",
      outputFileName
    );
    await fs.mkdir(path.dirname(convertedFilePath), { recursive: true });

    if (isSplScrap) {
      await writeSplScrapCSV(transformedData, convertedFilePath);
    } else {
      await writeToStandardizedTXT(
        transformedData,
        convertedFilePath,
        documentType
      );
    }
  }

  // Step 5: Generate error report if any errors occurred
  let errorReportPath = null;
  if (hasErrors) {
    const errorReportFileName = `${baseName}-errors.json`;
    errorReportPath = path.join(
      __dirname,
      "..",
      "temp_error_reports",
      errorReportFileName
    );
    await fs.mkdir(path.dirname(errorReportPath), { recursive: true });
    await fs.writeFile(errorReportPath, JSON.stringify(errorReport, null, 2));
  }

  return {
    convertedFilePath, // puede ser null si no generamos TXT por errores
    errorReportPath,
    status: hasErrors ? "completed_with_errors" : "completed",
  };
};

// Service for manual (UI) data creation without an input file
const processManualDataForConversion = async (
  rows,
  outputFormat,
  conversionOptions = {}
) => {
  const { documentType, validationOptions = {} } = conversionOptions;

  if (!documentType) {
    throw new Error(
      "Document type (e.g., 'finishedProduct') is required for processing."
    );
  }

  const validationResult = await validateManualRowsForDocument(
    rows,
    documentType,
    validationOptions
  );
  const transformedData = validationResult.transformedData;
  const errorReport = validationResult.errors;
  const hasErrors = validationResult.hasErrors;

  // Step 3: Output file generation (optional)
  const outputExt = outputFormat || getDefaultFormat(documentType) || "txt";
  const isSplScrap = documentType === "splScrap";
  const outputBaseName = getOutputBaseNameForDocument(
    documentType,
    transformedData.Sheet1,
  );
  const outputFileName = `${outputBaseName}.${outputExt}`;

  let convertedFilePath = null;

  if (!hasErrors || WRITE_TXT_ON_VALIDATION_ERROR) {
    convertedFilePath = path.join(
      __dirname,
      "..",
      "temp_converted_files",
      outputFileName
    );
    await fs.mkdir(path.dirname(convertedFilePath), { recursive: true });

    if (isSplScrap) {
      await writeSplScrapCSV(transformedData, convertedFilePath);
    } else {
      await writeToStandardizedTXT(
        transformedData,
        convertedFilePath,
        documentType
      );
    }
  }

  // Step 4: Error report generation if any errors occurred
  let errorReportPath = null;
  if (hasErrors) {
    const errorReportFileName = `${outputBaseName}-errors.json`;
    errorReportPath = path.join(
      __dirname,
      "..",
      "temp_error_reports",
      errorReportFileName
    );
    await fs.mkdir(path.dirname(errorReportPath), { recursive: true });
    await fs.writeFile(errorReportPath, JSON.stringify(errorReport, null, 2));
  }

  return {
    convertedFilePath,
    errorReportPath,
    status: hasErrors ? "completed_with_errors" : "completed",
    errors: errorReport,
    outputFileName,
    transformedRows: transformedData.Sheet1,
  };
};

/**
 * Writes data to a standardized plain text file based on the schema.
 */
async function writeToStandardizedTXT(data, filePath, documentType) {
  const records = data.Sheet1;
  if (!records || records.length === 0) {
    await fs.writeFile(filePath, "");
    return;
  }

  const { schemaSpec } = getRegistryEntry(documentType);

  const lines = records.map((record) => {
    const naftaRaw = String(record["NAFTA"] ?? "")
      .trim()
      .toUpperCase();
    const nafta = naftaRaw === "Y" ? "Y" : naftaRaw === "N" ? "N" : ""; // ← fuerza vacío si no es Y/N
    const maskNafta = documentType === "finishedProduct" && nafta !== "Y";

    const naftaDependents = new Set([
      "Preference Criterion",
      "Producer",
      "Net Cost",
      "Period (From)",
      "Period (To)",
    ]);

    let line = "";
    for (const field of schemaSpec) {
      let value = record[field.dataElement];

      // -------- NAFTA safety mask --------
      // Si el propio campo es NAFTA y quedó inválido, imprímelo vacío
      if (field.dataElement === "NAFTA" && nafta === "") {
        value = "";
      }

      if (maskNafta && naftaDependents.has(field.dataElement)) {
        value = ""; // no imprimir nada para estos campos
      }
      // -----------------------------------

      let formattedValue = "";

      if (value !== null && value !== undefined) {
        if (field.type === "N") {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            const formatMatch = field.format.match(
              /9\((\d+)\)\.?9?\(?(\d+)?\)?/
            );
            const decimalLengthInFormat = formatMatch?.[2]
              ? parseInt(formatMatch[2], 10)
              : 0;
            formattedValue = num
              .toFixed(decimalLengthInFormat)
              .replace(/\.?0+$/, "");
          }
        } else if (field.type === "D") {
          if (value instanceof Date && !isNaN(value)) {
            const year = value.getFullYear();
            const month = (value.getMonth() + 1).toString().padStart(2, "0");
            const day = value.getDate().toString().padStart(2, "0");
            formattedValue = `${year}${month}${day}`;
          } else {
            // si llega string vacío u otro, dejamos vacío
            formattedValue = "";
          }
        } else {
          formattedValue = String(value);
        }
      }

      formattedValue = formattedValue
        .padEnd(field.length, " ")
        .substring(0, field.length);

      line += formattedValue;
    }
    return line;
  });

  await fs.writeFile(filePath, lines.join("\n"));
}

// --- splScrap CSV writer ---
const SPL_SCRAP_HEADERS = [
  { field: "Customer(southbound) / Ship to (northbound)", header: "Ship to" },
  { field: "Type of goods", header: "Type of goods" },
  { field: "Type of shipment", header: "Type of shipment" },
  { field: "Expected date of arrival", header: "Expected date of arrival" },
  { field: "Waybill number", header: "Waybill Number" },
  { field: "Total gross weight", header: "Total gross Weight" },
  { field: "Total bundles", header: "Total bundles" },
  { field: "Part Number", header: "Part Number" },
  { field: "Description", header: "Description" },
  { field: "Quantity", header: "Quantity" },
  { field: "Unit Of Measure", header: "Unit of Measure" },
  { field: ["Unit Value (USD)", "Unit Value(USD)"], header: "Unit Value (USD)" },
  { field: ["Added Value (USD)", "Added Value(USD)"], header: "Added Value (USD)" },
  { field: ["Total Value (USD)", "Total Value(USD)"], header: "Total Value (USD)" },
  { field: "Unit Net Weight", header: "Unit Net Weight" },
  { field: "Country of Origin", header: "Country of Origin" },
  { field: "ECCN", header: "ECCN" },
  { field: "License No.", header: "License No." },
  { field: "License Exception", header: "License Exception" },
  { field: "US IMP HTS Code", header: "US IMP HTS Code" },
  { field: "US EXP HTS Code", header: "US EXP HTS Code" },
  { field: "Regime", header: "Regime" },
  { field: "Brand", header: "Brand" },
  { field: "Model", header: "Model" },
  { field: "Serial", header: "Serial" },
  { field: "Power Source Type", header: "Power Source Type" },
  { field: "Capacity", header: "Capacity" },
  { field: "Main Function", header: "Main Function" },
  { field: "PO Number", header: "PO Number" },
];

const formatDateYmd = (value) => {
  if (!value) return "";
  let d;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === "number" && !Number.isNaN(value)) {
    const base = new Date(Date.UTC(1899, 11, 30)); // Excel serial date base
    d = new Date(base.getTime() + value * 86400000);
  } else {
    d = new Date(value);
  }
  if (Number.isNaN(d.getTime())) return String(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

const toCsvValue = (value) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return formatDateYmd(value);
  if (typeof value === "object") {
    if (value instanceof String) return value.toString();
    if (value.result !== undefined) return String(value.result);
    if (value.text) return String(value.text);
    if (Array.isArray(value.richText)) {
      return value.richText.map((rt) => rt.text || "").join("");
    }
    return "";
  }
  if (Number.isFinite(value)) return String(value);
  return String(value);
};

async function writeSplScrapCSV(data, filePath) {
  const rows = data.Sheet1 || [];
  const lines = [];
  const headerLine = SPL_SCRAP_HEADERS.map((h) => h.header).join(",");
  lines.push(headerLine);

  const pickValue = (record, field) => {
    if (Array.isArray(field)) {
      for (const f of field) {
        if (record[f] !== undefined) return record[f];
      }
      return undefined;
    }
    return record[field];
  };

  for (const record of rows) {
    const line = SPL_SCRAP_HEADERS.map(({ field }) => {
      const raw = pickValue(record, field);
      // basic CSV escaping for commas/quotes
      let val = toCsvValue(raw);
      if (/[",\n]/.test(val)) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(",");
    lines.push(line);
  }

  await fs.writeFile(filePath, lines.join("\n"));
}

// prefix PI for Southbound, PE for Northbound and Scrap (default PE)
const pickSplScrapPrefix = (data) => {
  const rows = data.Sheet1 || [];
  if (!rows.length) return "PE";
  const shipment = String(rows[0]["Type of shipment"] || "").toLowerCase();
  if (shipment.includes("south")) return "PI";
  if (shipment.includes("scrap")) return "PE";
  if (shipment.includes("north")) return "PE";
  return "PE";
};

const generateSplScrapFilename = (prefix, date = new Date()) => {
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${prefix}${dd}${hh}${mm}_${month}${yy}`;
};

module.exports = {
  processFileForConversion,
  processManualDataForConversion,
  validateManualRowsForDocument,
  generateOutputFileNameForDocument,
};
