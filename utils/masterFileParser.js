// utils/masterFileParser.js

const crypto = require("crypto");
const ExcelJS = require("exceljs");

const {
  normalizeHTS,
  normalizeCurrencyValue,
  normalizeCountryOfOrigin,
} = require("./transformationUtils");

const {
  normalizeUOM,
  isValidUOMCode,
} = require("../data/uomCatalog");

const {
  isValidCountryCode,
} = require("../data/countryCatalog");

const {
  getMasterFileConfig,
  detectMasterTypeBySheetNames,
  normalizeMasterHeader,
} = require("../data/masterFileRegistry");

const HTS_FORMATTED_RE = /^\d{4}\.\d{2}\.\d{4}$/;

/**
 * Crea errores identificables para que posteriormente el
 * controlador pueda responder con el código HTTP adecuado.
 */
const createParserError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

/**
 * Convierte valores especiales de ExcelJS a valores simples.
 */
const getCellValue = (cell) => {
  if (!cell) return "";

  const value = cell.value;

  if (value === null || value === undefined) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return value;
  }

  if (typeof value === "object") {
    if (value.formula !== undefined) {
      return value.result ?? "";
    }

    if (Array.isArray(value.richText)) {
      return value.richText
        .map((item) => item.text || "")
        .join("");
    }

    if (value.text !== undefined) {
      return value.text;
    }

    if (value.result !== undefined) {
      return value.result;
    }

    if (value.error !== undefined) {
      return "";
    }
  }

  return String(value);
};

/**
 * Convierte cualquier valor a texto limpio.
 */
const toCleanText = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value)
    .replace(/\u00a0/g, " ")
    .trim();
};

/**
 * Indica si un valor está vacío.
 */
const isBlank = (value) => {
  return (
    value === null ||
    value === undefined ||
    toCleanText(value) === ""
  );
};

/**
 * Convierte moneda/números de Excel a Number.
 */
const parseNumericValue = (value) => {
  if (isBlank(value)) {
    return {
      isEmpty: true,
      isValid: true,
      value: undefined,
    };
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return {
      isEmpty: false,
      isValid: true,
      value,
    };
  }

  const normalized = normalizeCurrencyValue(value);
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return {
      isEmpty: false,
      isValid: false,
      value: undefined,
    };
  }

  return {
    isEmpty: false,
    isValid: true,
    value: parsed,
  };
};

const MASTER_CURRENCY_MAPPED_FIELDS =
  new Set([
    "materialCostUsd",
    "dutiableValueUsd",
    "unitCostUsd",
    "unitValueUsd",
    "addedValueUsd",
    "totalUnitCostUsd",
    "totalValueUsd",
  ]);

const MASTER_CURRENCY_HEADER_KEYS =
  new Set([
    "materialcostusd",
    "dutiablevalueusd",
    "unitcostusd",
    "unitvalueusd",
    "addedvalueusd",
    "totalunitcost",
    "totalunitcostusd",
    "totalvalueusd",
  ]);

const isMasterCurrencyHeader = (
  header,
) => {
  return (
    MASTER_CURRENCY_MAPPED_FIELDS.has(
      header?.rule?.target || "",
    ) ||
    MASTER_CURRENCY_HEADER_KEYS.has(
      header?.normalizedName || "",
    )
  );
};

const normalizeMasterRawCellValue = (
  value,
  header,
) => {
  if (
    !isMasterCurrencyHeader(
      header,
    )
  ) {
    return value;
  }

  const normalizedValue =
    normalizeCurrencyValue(value);

  if (
    normalizedValue === ""
  ) {
    return "";
  }

  const numericValue =
    Number(normalizedValue);

  return Number.isFinite(
    numericValue,
  )
    ? numericValue
    : normalizedValue;
};

const parseDateValue = (value) => {
  if (isBlank(value)) {
    return {
      isValid: true,
      value: undefined,
    };
  }

  if (value instanceof Date) {
    if (
      Number.isNaN(
        value.getTime(),
      )
    ) {
      return {
        isValid: false,
        value: undefined,
      };
    }

    return {
      isValid: true,
      value: new Date(
        Date.UTC(
          value.getUTCFullYear(),
          value.getUTCMonth(),
          value.getUTCDate(),
        ),
      ),
    };
  }

  const text =
    toCleanText(value);

  const match = text.match(
    /^(\d{4})[-/.]?(\d{2})[-/.]?(\d{2})(?:T.*)?$/,
  );

  if (!match) {
    return {
      isValid: false,
      value: undefined,
    };
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const parsedDate =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  const isValid =
    parsedDate.getUTCFullYear() ===
      year &&
    parsedDate.getUTCMonth() ===
      month - 1 &&
    parsedDate.getUTCDate() ===
      day;

  return {
    isValid,
    value:
      isValid
        ? parsedDate
        : undefined,
  };
};

/**
 * Reduce el número de decimales producidos por conversiones.
 */
const roundNumber = (value, decimals = 8) => {
  if (!Number.isFinite(value)) return value;

  const factor = 10 ** decimals;

  return (
    Math.round((value + Number.EPSILON) * factor) /
    factor
  );
};

/**
 * Normaliza un Part Number sin eliminar puntos, guiones
 * u otros caracteres válidos.
 */
const normalizePartNumber = (value) => {
  return toCleanText(value).toUpperCase();
};

/**
 * Detecta filas que solo describen el formato del archivo.
 *
 * Ejemplos encontrados:
 * Text-30
 * Text-12
 * Text-10
 */
const isTemplatePartNumber = (partNumber) => {
  return /^text-\d+$/i.test(
    toCleanText(partNumber),
  );
};

/**
 * Detecta valores sospechosos que parecen encabezados internos
 * en vez de Part Numbers.
 *
 * No los elimina: solo genera una advertencia.
 */
const isSuspiciousPartNumber = (partNumber) => {
  const normalized = normalizePartNumber(partNumber);

  return (
    normalized.startsWith("SUPPLIER ") ||
    normalized === "NOXORSOKEM"
  );
};

/**
 * Busca una hoja ignorando diferencias de mayúsculas.
 */
const findWorksheet = (workbook, expectedNames = []) => {
  const normalizedExpected = expectedNames.map((name) =>
    String(name || "").trim().toLowerCase(),
  );

  return (
    workbook.worksheets.find((worksheet) =>
      normalizedExpected.includes(
        worksheet.name.trim().toLowerCase(),
      ),
    ) || null
  );
};

/**
 * Revisa si una columna tiene algún valor debajo de los
 * encabezados. Se utiliza para conservar columnas sin nombre.
 */
const columnHasData = (
  worksheet,
  columnIndex,
  firstDataRow,
) => {
  for (
    let rowNumber = firstDataRow;
    rowNumber <= worksheet.rowCount;
    rowNumber += 1
  ) {
    const value = getCellValue(
      worksheet
        .getRow(rowNumber)
        .getCell(columnIndex),
    );

    if (!isBlank(value)) {
      return true;
    }
  }

  return false;
};

/**
 * Obtiene primero una regla específica por columna
 * y después intenta resolverla por su encabezado.
 *
 * Las reglas por columna sólo deben utilizarse cuando
 * la posición tenga un significado fijo confirmado.
 */
const resolveHeaderRule = (
  config,
  columnLetter,
  normalizedHeader,
) => {
  const columnRule =
    config.columnRules?.[columnLetter] || null;

  if (columnRule) {
    return columnRule;
  }

  return (
    config.headerRules?.[normalizedHeader] || null
  );
};

/**
 * Construye la descripción de los encabezados del archivo.
 */
const buildHeaders = (
  worksheet,
  config,
) => {
  const headerRow = worksheet.getRow(
    config.headerRow,
  );

  const firstDataRow = config.headerRow + 1;
  const headers = [];

  for (
    let columnIndex = 1;
    columnIndex <= worksheet.columnCount;
    columnIndex += 1
  ) {
    const column = worksheet.getColumn(columnIndex);
    const columnLetter = column.letter;

    const headerCell = headerRow.getCell(columnIndex);
    const originalHeaderValue =
      getCellValue(headerCell);

    const originalHeader =
      toCleanText(originalHeaderValue);

    const hasData = columnHasData(
      worksheet,
      columnIndex,
      firstDataRow,
    );

    if (!originalHeader && !hasData) {
      continue;
    }

    const safeHeader =
      originalHeader ||
      `Unnamed Column ${columnLetter}`;

    const normalizedHeader =
      normalizeMasterHeader(safeHeader);

    const ignored =
      config.ignoredHeaderKeys.includes(
        normalizedHeader,
      );

    const rule = ignored
      ? null
      : resolveHeaderRule(
          config,
          columnLetter,
          normalizedHeader,
        );

    headers.push({
      originalName: safeHeader,
      normalizedName: normalizedHeader,
      columnIndex,
      columnLetter,
      mappedField: rule?.target || "",
      ignored,
      rule,
    });
  }

  return headers;
};

/**
 * Valida que estén presentes los encabezados indispensables.
 */
const validateRequiredHeaders = (
  headers,
  config,
) => {
  const availableMappedFields =
    new Set(headers.filter((header) =>
        header.ignored !== true,
      )
      .map((header) =>
        header.mappedField,
      )
      .filter(Boolean),
    );

  const requiredMappedFields =
    Array.isArray(
      config.requiredMappedFields,
    )
      ? config.requiredMappedFields
      : [];

  const missingMappedFields =
    requiredMappedFields.filter(
      (requiredField) =>
        !availableMappedFields.has(
          requiredField,
        ),
    );

  if (
    missingMappedFields.length > 0
  ) {
    throw createParserError(
      "MASTER_REQUIRED_FIELDS_MISSING",
      `Faltan campos obligatorios: ${missingMappedFields.join(
        ", ",
      )}.`,
    );
  }
};

/**
 * Localiza la columna Part Number.
 */
const findPartNumberHeader = (
  headers,
  config,
) => {
  return (
    headers.find((header) =>
      config.partNumberHeaderKeys.includes(
        header.normalizedName,
      ),
    ) || null
  );
};

/**
   * Construye un registro normalizado utilizando
   * las celdas recibidas desde el editor.
 */
const buildMasterRecordFromEditorRow = ({
  masterType,
  headers = [],
  cells = [],
  sourceRow,
}) => {
  const config =
    getMasterFileConfig(masterType);

  const parsedSourceRow =
    Number.parseInt(sourceRow, 10);

  if (
    !Number.isInteger(parsedSourceRow) ||
    parsedSourceRow < 1
  ) {
    throw createParserError(
      "MASTER_EDITOR_SOURCE_ROW_INVALID",
      "La fila del editor no tiene una posición válida.",
    );
  }

  if (!Array.isArray(headers)) {
    throw createParserError(
      "MASTER_EDITOR_HEADERS_INVALID",
      "Los encabezados del archivo madre no son válidos.",
    );
  }

  if (!Array.isArray(cells)) {
    throw createParserError(
      "MASTER_EDITOR_CELLS_INVALID",
      "Las celdas de la fila no son válidas.",
    );
  }

  /*
  * Los encabezados provienen del MasterFile
  * almacenado, no de la petición del navegador.
  */
  const preparedHeaders = headers
    .filter((header) => {
      const columnIndex =
        Number(header.columnIndex);

      return (
        Number.isInteger(columnIndex) &&
        columnIndex > 0
      );
    })
    .map((header) => {
      const originalName =
        toCleanText(
          header.originalName,
        );

      const normalizedName =
        header.normalizedName ||
        normalizeMasterHeader(
          originalName,
        );

      const columnLetter =
        toCleanText(
          header.columnLetter,
        ).toUpperCase();

      const ignored =
        header.ignored === true ||
        config.ignoredHeaderKeys.includes(
          normalizedName,
        );

      const rule = ignored
        ? null
        : resolveHeaderRule(
            config,
            columnLetter,
            normalizedName,
          );

      return {
        originalName,
        normalizedName,
        columnIndex:
          Number(header.columnIndex),
        columnLetter,
        mappedField:
          rule?.target || "",
        ignored,
        rule,
      };
    });

  const partNumberHeader =
    findPartNumberHeader(
      preparedHeaders,
      config,
    );

  if (!partNumberHeader) {
    throw createParserError(
      "MASTER_PART_NUMBER_HEADER_MISSING",
      "No se encontró la columna Part Number.",
    );
  }

  const valuesByColumn =
    new Map();

  cells.forEach((cell) => {
    const columnIndex =
      Number(cell?.columnIndex);

    if (
      Number.isInteger(columnIndex) &&
      columnIndex > 0
    ) {
      valuesByColumn.set(
        columnIndex,
        cell.value,
      );
    }
  });

  const partNumberValue =
    valuesByColumn.get(
      partNumberHeader.columnIndex,
    );

  const partNumber =
    normalizePartNumber(
      partNumberValue,
    );

  if (!partNumber) {
    throw createParserError(
      "MASTER_EDITOR_PART_NUMBER_REQUIRED",
      `La fila ${parsedSourceRow} requiere Part Number.`,
    );
  }

  if (
    isTemplatePartNumber(
      partNumber,
    )
  ) {
    throw createParserError(
      "MASTER_EDITOR_TEMPLATE_ROW_INVALID",
      `La fila ${parsedSourceRow} contiene un Part Number de plantilla.`,
    );
  }

  const rawCells = [];
  const normalizedValues = {};
  const validationWarnings = [];
  const fdaAffirmations =
    new Map();

  preparedHeaders.forEach(
    (header) => {
      if (header.ignored) {
        return;
      }

      const rawValue =
        valuesByColumn.get(
          header.columnIndex,
        );

      if (isBlank(rawValue)) {
        return;
      }

      rawCells.push({
        header:
          header.originalName,
        columnIndex:
          header.columnIndex,
        columnLetter:
          header.columnLetter,
        value:
          normalizeMasterRawCellValue(
            rawValue,
            header,
          ),
      });

      if (
        !header.rule ||
        header.rule.target ===
          "partNumber"
      ) {
        return;
      }

      const transformedValue =
        transformValue(
          rawValue,
          header.rule,
          validationWarnings,
          header.originalName,
        );

      if (
        header.rule.transform ===
        "fdaAffirmation"
      ) {
        const sequence =
          header.rule.sequence;

        const component =
          header.rule.component;

        if (
          !fdaAffirmations.has(
            sequence,
          )
        ) {
          fdaAffirmations.set(
            sequence,
            {
              sequence,
              code: "",
              qualifier: "",
            },
          );
        }

        const affirmation =
          fdaAffirmations.get(
            sequence,
          );

        affirmation[component] =
          transformedValue || "";

        return;
      }

      setNormalizedValue(
        normalizedValues,
        header.rule.target,
        transformedValue,
        validationWarnings,
        header.originalName,
      );

      if (
        header.rule.sourceUnit &&
        transformedValue !==
          undefined
      ) {
        setNormalizedValue(
          normalizedValues,
          "unitNetWeightSourceUnit",
          header.rule.sourceUnit,
          validationWarnings,
          header.originalName,
        );
      }
    },
  );

  const completedAffirmations = [
    ...fdaAffirmations.values(),
  ].filter(
    (affirmation) =>
      affirmation.code ||
      affirmation.qualifier,
  );

  if (
    completedAffirmations.length > 0
  ) {
    normalizedValues
      .fdaAffirmations =
      completedAffirmations;
  }

  if (
    isSuspiciousPartNumber(
      partNumber,
    )
  ) {
    addRecordWarning(
      validationWarnings,
      "SUSPICIOUS_PART_NUMBER",
      `El valor "${partNumber}" parece un encabezado o separador.`,
      "Part Number",
      partNumberValue,
    );
  }

  return {
    masterType,
    partNumber,
    partNumberNormalized:
      partNumber,
    sourceRow:
      parsedSourceRow,
    rawCells,
    normalizedValues,
    validationWarnings,
  };
};

/**
 * Agrega una advertencia a un registro.
 */
const addRecordWarning = (
  warnings,
  code,
  message,
  field = "",
  originalValue = undefined,
) => {
  warnings.push({
    code,
    message,
    field,
    originalValue,
  });
};

/**
 * Transforma un valor según las reglas del registro.
 */
const transformValue = (
  value,
  rule,
  warnings,
  fieldName,
) => {
  const transform = rule?.transform || "text";

  if (isBlank(value)) {
    return undefined;
  }

  switch (transform) {
    case "partNumber":
      return normalizePartNumber(value);

    case "text":
      return toCleanText(value);

    case "uppercaseText":
      return toCleanText(value).toUpperCase();

    case "number": {
      const numericResult =
        parseNumericValue(value);

      if (!numericResult.isValid) {
        addRecordWarning(
          warnings,
          "INVALID_NUMBER",
          `El valor de "${fieldName}" no es numérico.`,
          fieldName,
          value,
        );

        return undefined;
      }

      return numericResult.value;
    }
    case "date": {
      const dateResult =
        parseDateValue(value);

      if (!dateResult.isValid) {
        addRecordWarning(
          warnings,
          "INVALID_DATE",
          `El valor de "${fieldName}" no tiene una fecha válida.`,
          fieldName,
          value,
        );

        return undefined;
      }

      return dateResult.value;
    }

    case "gramsToPounds": {
      const numericResult =
        parseNumericValue(value);

      if (!numericResult.isValid) {
        addRecordWarning(
          warnings,
          "INVALID_WEIGHT",
          `El peso en gramos de "${fieldName}" no es válido.`,
          fieldName,
          value,
        );

        return undefined;
      }

      return roundNumber(
        numericResult.value / 453.59237,
      );
    }

    case "kilogramsToPounds": {
      const numericResult =
        parseNumericValue(value);

      if (!numericResult.isValid) {
        addRecordWarning(
          warnings,
          "INVALID_WEIGHT",
          `El peso en kilogramos de "${fieldName}" no es válido.`,
          fieldName,
          value,
        );

        return undefined;
      }

      return roundNumber(
        numericResult.value * 2.2046226218,
      );
    }

    case "pounds": {
      const numericResult =
        parseNumericValue(value);

      if (!numericResult.isValid) {
        addRecordWarning(
          warnings,
          "INVALID_WEIGHT",
          `El peso en libras de "${fieldName}" no es válido.`,
          fieldName,
          value,
        );

        return undefined;
      }

      return roundNumber(
        numericResult.value,
      );
    }

    case "hts": {
      const normalized = normalizeHTS(value);
      const cleaned = toCleanText(normalized);

      if (
        cleaned &&
        !HTS_FORMATTED_RE.test(cleaned)
      ) {
        addRecordWarning(
          warnings,
          "INVALID_HTS_FORMAT",
          `El valor de "${fieldName}" no tiene formato HTS válido.`,
          fieldName,
          value,
        );
      }

      return cleaned;
    }

    case "country": {
      const normalized =
        normalizeCountryOfOrigin(value);

      const cleaned =
        toCleanText(normalized).toUpperCase();

      if (
        cleaned &&
        !isValidCountryCode(cleaned)
      ) {
        addRecordWarning(
          warnings,
          "UNKNOWN_COUNTRY",
          `El país de "${fieldName}" no existe en el catálogo.`,
          fieldName,
          value,
        );
      }

      return cleaned;
    }

    case "uom": {
      const normalized = normalizeUOM(value);
      const cleaned =
        toCleanText(normalized).toUpperCase();

      if (
        cleaned &&
        !isValidUOMCode(cleaned)
      ) {
        addRecordWarning(
          warnings,
          "UNKNOWN_UOM",
          `La unidad de "${fieldName}" no existe en el catálogo.`,
          fieldName,
          value,
        );
      }

      return cleaned;
    }

    case "fdaAffirmation":
      return toCleanText(value);

    default:
      addRecordWarning(
        warnings,
        "UNKNOWN_TRANSFORMATION",
        `La transformación "${transform}" no está implementada.`,
        fieldName,
        value,
      );

      return toCleanText(value);
  }
};

/**
 * Indica si dos valores normalizados son iguales.
 */
const areEquivalentValues = (
  firstValue,
  secondValue,
) => {
  if (
    typeof firstValue === "number" &&
    typeof secondValue === "number"
  ) {
    return firstValue === secondValue;
  }

  return (
    toCleanText(firstValue) ===
    toCleanText(secondValue)
  );
};

/**
 * Asigna valores normalizados sin sobrescribir silenciosamente
 * valores diferentes provenientes de dos columnas.
 */
const setNormalizedValue = (
  normalizedValues,
  target,
  value,
  warnings,
  originalHeader,
) => {
  if (value === undefined) {
    return;
  }

  const existingValue =
    normalizedValues[target];

  if (
    existingValue !== undefined &&
    existingValue !== "" &&
    !areEquivalentValues(
      existingValue,
      value,
    )
  ) {
    addRecordWarning(
      warnings,
      "CONFLICTING_MAPPED_VALUES",
      `Dos columnas intentan asignar valores diferentes a "${target}".`,
      originalHeader,
      value,
    );

    return;
  }

  normalizedValues[target] = value;
};

/**
 * Procesa una fila completa.
 */
const parseDataRow = (
  worksheet,
  rowNumber,
  headers,
  partNumberHeader,
  masterType,
) => {
  const row = worksheet.getRow(rowNumber);

  const partNumberValue = getCellValue(
    row.getCell(
      partNumberHeader.columnIndex,
    ),
  );

  const partNumber =
    normalizePartNumber(partNumberValue);

  if (!partNumber) {
    return {
      skipped: true,
      reason: "EMPTY_PART_NUMBER",
    };
  }

  if (isTemplatePartNumber(partNumber)) {
    return {
      skipped: true,
      reason: "TEMPLATE_ROW",
    };
  }

  const rawCells = [];
  const normalizedValues = {};
  const validationWarnings = [];

  const fdaAffirmations = new Map();

  for (const header of headers) {
    if (header.ignored) {
      continue;
    }

    const cell = row.getCell(
      header.columnIndex,
    );

    const rawValue = getCellValue(cell);

    if (isBlank(rawValue)) {
      continue;
    }

    rawCells.push({
      header: header.originalName,
      columnIndex: header.columnIndex,
      columnLetter: header.columnLetter,
      value:
        normalizeMasterRawCellValue(
          rawValue,
          header,
        ),
    });

    if (!header.rule) {
      continue;
    }

    if (
      header.rule.target === "partNumber"
    ) {
      continue;
    }

    const transformedValue = transformValue(
      rawValue,
      header.rule,
      validationWarnings,
      header.originalName,
    );

    if (
      header.rule.transform ===
      "fdaAffirmation"
    ) {
      const sequence =
        header.rule.sequence;

      const component =
        header.rule.component;

      if (!fdaAffirmations.has(sequence)) {
        fdaAffirmations.set(sequence, {
          sequence,
          code: "",
          qualifier: "",
        });
      }

      const affirmation =
        fdaAffirmations.get(sequence);

      affirmation[component] =
        transformedValue || "";

      continue;
    }
    setNormalizedValue(
      normalizedValues,
      header.rule.target,
      transformedValue,
      validationWarnings,
      header.originalName,
    );
    if (
      header.rule.sourceUnit &&
      transformedValue !== undefined
    ) {
      setNormalizedValue(
        normalizedValues,
        "unitNetWeightSourceUnit",
        header.rule.sourceUnit,
        validationWarnings,
        header.originalName,
      );
    }
  }

  const completedAffirmations = [
    ...fdaAffirmations.values(),
  ].filter(
    (affirmation) =>
      affirmation.code ||
      affirmation.qualifier,
  );

  if (completedAffirmations.length > 0) {
    normalizedValues.fdaAffirmations =
      completedAffirmations;
  }

  if (isSuspiciousPartNumber(partNumber)) {
    addRecordWarning(
      validationWarnings,
      "SUSPICIOUS_PART_NUMBER",
      `El valor "${partNumber}" parece un encabezado o separador, no un Part Number.`,
      "Part Number",
      partNumberValue,
    );
  }

  return {
    skipped: false,

    record: {
      masterType,
      partNumber,
      partNumberNormalized: partNumber,
      sourceRow: rowNumber,
      rawCells,
      normalizedValues,
      validationWarnings,
    },
  };
};

/**
 * Agrega advertencias a Part Numbers repetidos.
 */
const applyDuplicateWarnings = (
  records,
  fileWarnings,
) => {
  const recordsByPartNumber = new Map();

  records.forEach((record) => {
    const key =
      record.partNumberNormalized;

    if (!recordsByPartNumber.has(key)) {
      recordsByPartNumber.set(key, []);
    }

    recordsByPartNumber
      .get(key)
      .push(record);
  });

  for (const [
    partNumber,
    matches,
  ] of recordsByPartNumber.entries()) {
    if (matches.length < 2) {
      continue;
    }

    fileWarnings.push(
      `Part Number "${partNumber}" aparece ${matches.length} veces.`,
    );

    matches.forEach((record) => {
      addRecordWarning(
        record.validationWarnings,
        "DUPLICATE_PART_NUMBER",
        `El Part Number "${partNumber}" aparece ${matches.length} veces en el archivo.`,
        "Part Number",
        record.partNumber,
      );
    });
  }
};

/**
 * Parsea el buffer de un archivo madre.
 *
 * No guarda datos en MongoDB.
 */
const parseMasterFileBuffer = async (
  fileBuffer,
  options = {},
) => {
  if (
    !Buffer.isBuffer(fileBuffer) ||
    fileBuffer.length === 0
  ) {
    throw createParserError(
      "MASTER_FILE_BUFFER_INVALID",
      "El archivo madre está vacío o no es válido.",
    );
  }

  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(fileBuffer);
  } catch (error) {
    throw createParserError(
      "MASTER_FILE_READ_ERROR",
      `No fue posible leer el archivo Excel: ${error.message}`,
    );
  }

  const sheetNames =
    workbook.worksheets.map(
      (worksheet) => worksheet.name,
    );

  const detectedMasterType =
    detectMasterTypeBySheetNames(sheetNames);

  if (!detectedMasterType) {
    throw createParserError(
      "MASTER_TYPE_NOT_DETECTED",
      "No se encontró una hoja FG_Catalog o RawMatlCat.",
    );
  }

  if (
    options.expectedMasterType &&
    options.expectedMasterType !==
      detectedMasterType
  ) {
    throw createParserError(
      "MASTER_TYPE_MISMATCH",
      `El archivo corresponde a "${detectedMasterType}", no a "${options.expectedMasterType}".`,
    );
  }

  let config = getMasterFileConfig(
    detectedMasterType,
  );

  const worksheet = findWorksheet(
    workbook,
    config.sheetNames,
  );

  if (!worksheet) {
    throw createParserError(
      "MASTER_SOURCE_SHEET_NOT_FOUND",
      "No se encontró la hoja principal del archivo madre.",
    );
  }

  config = getMasterFileConfig(
    detectedMasterType,
    worksheet.name,
  );

  const headers = buildHeaders(
    worksheet,
    config,
  );

  validateRequiredHeaders(
    headers,
    config,
  );

  const partNumberHeader =
    findPartNumberHeader(
      headers,
      config,
    );

  if (!partNumberHeader) {
    throw createParserError(
      "MASTER_PART_NUMBER_COLUMN_NOT_FOUND",
      "No se encontró la columna Part Number.",
    );
  }

  const records = [];
  const fileWarnings = [];
  let skippedTemplateRows = 0;
  let skippedEmptyPartNumbers = 0;

  for (
    let rowNumber = config.headerRow + 1;
    rowNumber <= worksheet.rowCount;
    rowNumber += 1
  ) {
    const result = parseDataRow(
      worksheet,
      rowNumber,
      headers,
      partNumberHeader,
      detectedMasterType,
    );

    if (result.skipped) {
      if (
        result.reason === "TEMPLATE_ROW"
      ) {
        skippedTemplateRows += 1;
      }

      if (
        result.reason ===
        "EMPTY_PART_NUMBER"
      ) {
        skippedEmptyPartNumbers += 1;
      }

      continue;
    }

    records.push(result.record);
  }

  if (skippedTemplateRows > 0) {
    fileWarnings.push(
      `Se omitieron ${skippedTemplateRows} filas de especificación.`,
    );
  }

  if (skippedEmptyPartNumbers > 0) {
    fileWarnings.push(
      `Se omitieron ${skippedEmptyPartNumbers} filas sin Part Number.`,
    );
  }

  if (
    config.allowDuplicatePartNumbers !== true
  ) {
    applyDuplicateWarnings(
      records,
      fileWarnings,
    );
  }

  const publicHeaders = headers
    .filter(
      (header) =>
        header.ignored !== true,
    )
    .map(
      ({
        originalName,
        normalizedName,
        columnIndex,
        columnLetter,
        mappedField,
      }) => ({
        originalName,
        normalizedName,
        columnIndex,
        columnLetter,
        mappedField,
        ignored: false,
      }),
    );

  const imageCountIgnored =
    Array.isArray(workbook.media)
      ? workbook.media.length
      : 0;

  const checksum = crypto
    .createHash("sha256")
    .update(fileBuffer)
    .digest("hex");

  return {
    metadata: {
      originalFileName:
        options.originalFileName || "",
      masterType: detectedMasterType,
      sourceSheet: worksheet.name,
      headerRow: config.headerRow,
      partNumberColumn:
        partNumberHeader.columnLetter,
      headers: publicHeaders,
      recordCount: records.length,
      imageCountIgnored,
      fileSizeBytes: fileBuffer.length,
      checksum,
      warningCount: fileWarnings.length,
      importWarnings: fileWarnings,
    },

    records,
  };
};

module.exports = {
  parseMasterFileBuffer,
  buildMasterRecordFromEditorRow,
  normalizePartNumber,
  isTemplatePartNumber,
  createParserError,
  getCellValue,
  toCleanText,
  resolveHeaderRule,
  validateRequiredHeaders,
  findPartNumberHeader,
  parseDataRow,
};
