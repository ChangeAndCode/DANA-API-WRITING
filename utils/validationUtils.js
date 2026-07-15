const { getRegistryEntry } = require("../data/documentTypeRegistry");
const { isValidCountryCode } = require("../data/countryCatalog");
const { isValidUOMCode } = require("../data/uomCatalog");

// Reglas de formato
const HTS_FORMATTED_RE = /^\d{4}\.\d{2}\.\d{4}$/; // ####.##.####
const PART_NUMBER_RE = /^[A-Z0-9 ._\/-]+$/;
const isBlank = (v) => v === null || v === undefined || String(v).trim() === "";
const DEFAULT_ALLOW_EMPTY_MANDATORY_FIELDS =
  (process.env.ALLOW_EMPTY_MANDATORY_FIELDS || "true").toLowerCase() === "true";

const normalizeNaftaFlag = (value) => {
  if (value === null || value === undefined) return "";
  const v = String(value).trim().toUpperCase();
  if (v === "" || v === "NA" || v === "N/A" || v === "-") return "";
  if (v === "Y" || v === "YES") return "Y";
  if (v === "N" || v === "NO") return "N";
  return v;
};

const parseNumericValue = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(/,/g, "");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Validates the integrity of parsed data against its schema specification.
 * Checks for mandatory fields, field length, and valid enum values.
 * Adds HTS-format and Country-of-Origin checks.
 * @param {Object} data - The parsed data object, e.g., { Sheet1: [records] }.
 * @param {string} documentType - The internal name of the document type.
 * @returns {{isValid: boolean, errors: Array<Object>}}
 */
const validateDataIntegrity = (data, documentType, options = {}) => {
  const allowEmptyMandatoryFields =
    typeof options.allowEmptyMandatoryFields === "boolean"
      ? options.allowEmptyMandatoryFields
      : DEFAULT_ALLOW_EMPTY_MANDATORY_FIELDS;
  const skippedMandatoryFields = new Set(
    Array.isArray(options.skipMandatoryFields)
      ? options.skipMandatoryFields
      : [],
  );
  const { schemaSpec } = getRegistryEntry(documentType);
  const partNumberSpec =
    documentType === "finishedProduct"
      ? schemaSpec.find((f) => f.dataElement === "Part Number")
      : null;
  const errors = [];
  const records = data.Sheet1;

  if (!records || records.length === 0) {
    errors.push({
      type: "Integrity Error",
      message: "No records found to validate.",
    });
    return { isValid: false, errors };
  }

  records.forEach((record, recordIndex) => {
    const rowNum = recordIndex + 2; // UI-friendly

    // 1) Reglas genéricas del schema (obligatorios + enums)
    schemaSpec.forEach((fieldSpec) => {
      const fieldName = fieldSpec.dataElement;
      const value = record[fieldName];

      // Campos obligatorios (M)
      if (
        fieldSpec.requirement === "M" &&
        isBlank(value) &&
        !allowEmptyMandatoryFields &&
        !skippedMandatoryFields.has(fieldName)
      ) {
        errors.push({
          type: "Integrity Error",
          message: `Row ${rowNum}: Mandatory field "${fieldName}" is missing or empty.`,
          field: fieldName,
          row: rowNum,
        });
      }

      // Enums: validar contra códigos (lado izquierdo antes del "=")
      if (Array.isArray(fieldSpec.possibleValues) && !isBlank(value)) {
        const enumCodes = fieldSpec.possibleValues.map(
          (val) => val.split(/\s*=\s*/)[0]
        );
        const valueToCheck =
          fieldName === "NAFTA"
            ? normalizeNaftaFlag(value)
            : String(value).trim();
        if (!enumCodes.includes(valueToCheck)) {
          errors.push({
            type: "Integrity Error",
            message: `Row ${rowNum}: Field "${fieldName}" has an invalid value "${value}". Expected one of: ${enumCodes.join(
              ", "
            )}`,
            field: fieldName,
            row: rowNum,
            value,
            expected: enumCodes,
          });
        }
      }
    });

    // 1.1) Finished Product: Part Number (alphanumeric, max length)
    if (documentType === "finishedProduct" && partNumberSpec) {
      const pnRaw = record["Part Number"];
      if (!isBlank(pnRaw)) {
        const pn = String(pnRaw).trim().toUpperCase();
        if (pn.length > partNumberSpec.length) {
          errors.push({
            type: "Integrity Error",
            message: `Row ${rowNum}: "Part Number" exceeds max length ${partNumberSpec.length}. Got ${pn.length}.`,
            field: "Part Number",
            row: rowNum,
            value: pnRaw,
            expectedMaxLength: partNumberSpec.length,
          });
        }
        if (!PART_NUMBER_RE.test(pn)) {
          errors.push({
            type: "Integrity Error",
            message: `Row ${rowNum}: "Part Number" must be alphanumeric (A-Z, 0-9) and may include space, dot, underscore, slash, or hyphen.`,
            field: "Part Number",
            row: rowNum,
            value: pnRaw,
          });
        }
      }
    }

    // 2) Validación de formato HTS
    if (documentType === "finishedProduct") {
      [
        "USA Importation HTS Code",
        "USA Exportation Code",
        "USA Exportation HTS Code", // alias aceptado
      ].forEach((fn) => {
        const v = record[fn];
        if (!isBlank(v) && !HTS_FORMATTED_RE.test(String(v))) {
          errors.push({
            type: "Integrity Error",
            message: `Row ${rowNum}: Field "${fn}" must match format ####.##.#### (e.g., 9019.10.9999). Got "${v}".`,
            field: fn,
            row: rowNum,
            value: v,
            expectedFormat: "####.##.####",
          });
        }
      });
    } else if (documentType === "rawMaterial") {
      ["Importation HTS Code", "Exportation HTS Code"].forEach((fn) => {
        const v = record[fn];
        if (!isBlank(v) && !HTS_FORMATTED_RE.test(String(v))) {
          errors.push({
            type: "Integrity Error",
            message: `Row ${rowNum}: Field "${fn}" must match format ####.##.#### (e.g., 9019.10.9999). Got "${v}".`,
            field: fn,
            row: rowNum,
            value: v,
            expectedFormat: "####.##.####",
          });
        }
      });
    } else if (documentType === "splScrap") {
      ["US IMP HTS Code", "US EXP HTS Code"].forEach((fn) => {
        const v = record[fn];
        if (!isBlank(v) && !HTS_FORMATTED_RE.test(String(v))) {
          errors.push({
            type: "Integrity Error",
            message: `Row ${rowNum}: Field "${fn}" must match format ####.##.#### (e.g., 9019.10.9999). Got "${v}".`,
            field: fn,
            row: rowNum,
            value: v,
            expectedFormat: "####.##.####",
          });
        }
      });
    }

    // 3) Validación Country of Origin contra catálogo (ambos esquemas)
    const cooFieldName = Object.prototype.hasOwnProperty.call(
      record,
      "Country of Origin"
    )
      ? "Country of Origin"
      : Object.prototype.hasOwnProperty.call(record, "Country of origin")
      ? "Country of origin"
      : null;

    if (cooFieldName) {
      const coo = record[cooFieldName];
      if (!isBlank(coo)) {
        const code = String(coo).trim().toUpperCase();
        if (!isValidCountryCode(code)) {
          errors.push({
            type: "Integrity Error",
            message: `Row ${rowNum}: "${cooFieldName}" must be a valid 2-letter code from catalog. Got "${coo}".`,
            field: cooFieldName,
            row: rowNum,
            value: coo,
          });
        }
      }
    }

    const uomFieldName = [
      "Unit Of Measure",
      "Unit of Measure",
      "Unit of measure",
    ].find((fieldName) => Object.prototype.hasOwnProperty.call(record, fieldName));

    if (uomFieldName) {
      const uom = record[uomFieldName];
      if (!isBlank(uom)) {
        const code = String(uom).trim().toUpperCase();
        if (!isValidUOMCode(code)) {
          errors.push({
            type: "Integrity Error",
            message: `Row ${rowNum}: "${uomFieldName}" must be a valid uppercase code from catalog. Got "${uom}".`,
            field: uomFieldName,
            row: rowNum,
            value: uom,
          });
        }
      }
    }
  });

  return { isValid: errors.length === 0, errors };
};

/**
 * Applies complex, cross-field, or database-dependent business rules.
 * Includes NAFTA-dependent rules.
 * @param {Object} data - The parsed data object.
 * @param {string} documentType - The internal name of the document type.
 * @returns {Promise<{isValid: boolean, errors: Array<Object>}>}
 */
const applyBusinessValidations = async (data, documentType) => {
  const errors = [];
  const records = data.Sheet1;

  if (!records || records.length === 0) {
    return { isValid: true, errors: [] };
  }

  if (documentType === "finishedProduct") {
    records.forEach((record, recordIndex) => {
      const rowNum = recordIndex + 2;

      // Regla existente: FDA Marker => FDA Product Code
      const fdaMarker = record["FDA Marker"];
      const fdaProductCode = record["FDA Product Code"];
      if (fdaMarker === "FD2" && isBlank(fdaProductCode)) {
        errors.push({
          type: "Business Rule Violation",
          message: `Row ${rowNum}: "FDA Product Code" is mandatory when "FDA Marker" is "FD2".`,
          field: "FDA Product Code",
          row: rowNum,
        });
      }

      // Regla existente: NAFTA => Preference Criterion obligatorio
      const nafta = normalizeNaftaFlag(record["NAFTA"]);
      const preferenceCriterion = record["Preference Criterion"];
      if (nafta === "Y" && isBlank(preferenceCriterion)) {
        errors.push({
          type: "Business Rule Violation",
          message: `Row ${rowNum}: "Preference Criterion" is mandatory when "NAFTA" is "Y".`,
          field: "Preference Criterion",
          row: rowNum,
        });
      }

      // NUEVAS reglas cuando NAFTA = "Y"
      if (nafta === "Y") {
        const netCost = record["Net Cost"];
        const netCostUp = isBlank(netCost)
          ? ""
          : String(netCost).trim().toUpperCase();

        if (!["CN", "NO"].includes(netCostUp)) {
          errors.push({
            type: "Business Rule Violation",
            message: `Row ${rowNum}: When "NAFTA" is "Y", "Net Cost" must be "CN" or "NO". Got "${netCost}".`,
            field: "Net Cost",
            row: rowNum,
            value: netCost,
            expected: ["CN", "NO"],
          });
        }

        const periodFrom = record["Period (From)"];
        if (isBlank(periodFrom)) {
          errors.push({
            type: "Business Rule Violation",
            message: `Row ${rowNum}: "Period (From)" is mandatory when "NAFTA" is "Y".`,
            field: "Period (From)",
            row: rowNum,
          });
        }

        const periodTo = record["Period (To)"];
        if (isBlank(periodTo)) {
          errors.push({
            type: "Business Rule Violation",
            message: `Row ${rowNum}: "Period (To)" is mandatory when "NAFTA" is "Y".`,
            field: "Period (To)",
            row: rowNum,
          });
        }
      }
    });
  }

  if (documentType === "splScrap") {
    records.forEach((record, recordIndex) => {
      const rowNum = recordIndex + 2;
      const shipment = String(record["Type of shipment"] || "").trim();

      if (shipment !== "Scrap") return;

      const typeOfGoods = String(record["Type of goods"] || "")
        .trim()
        .toUpperCase();
      if (typeOfGoods !== "FG") {
        errors.push({
          type: "Business Rule Violation",
          message: `Row ${rowNum}: "Type of goods" must be "FG" when "Type of shipment" is "Scrap".`,
          field: "Type of goods",
          row: rowNum,
          value: record["Type of goods"],
          expected: ["FG"],
        });
      }

      const addedValue = parseNumericValue(record["Added Value (USD)"]);
      if (addedValue !== 0) {
        errors.push({
          type: "Business Rule Violation",
          message: `Row ${rowNum}: "Added Value (USD)" must be 0 when "Type of shipment" is "Scrap".`,
          field: "Added Value (USD)",
          row: rowNum,
          value: record["Added Value (USD)"],
          expected: 0,
        });
      }

    });
  }

  return { isValid: errors.length === 0, errors };
};

module.exports = {
  validateDataIntegrity,
  applyBusinessValidations,
};
