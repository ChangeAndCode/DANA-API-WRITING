const {
  filterMasterNormalizedValues,
  getCanonicalMasterHeaders,
  getMasterHeaderRule,
} = require(
  "../data/masterFileRegistry",
);

const {
  normalizeCurrencyValue,
  normalizeCountryOfOrigin,
  normalizeHTS,
} = require(
  "./transformationUtils",
);

const {
  normalizeUOM,
} = require("../data/uomCatalog");

const isBlank = (value) =>
  value === null ||
  value === undefined ||
  String(value).trim() === "";

const toPlainObject = (value) => {
  if (
    value &&
    typeof value.toObject ===
      "function"
  ) {
    return value.toObject();
  }

  return value;
};

const normalizeNumber = (
  value,
) => {
  if (isBlank(value)) return "";

  const normalized =
    normalizeCurrencyValue(value);
  const numericValue =
    Number(normalized);

  return Number.isFinite(
    numericValue,
  )
    ? numericValue
    : String(normalized).trim();
};

const formatCanonicalDate = (
  value,
) => {
  if (isBlank(value)) return "";

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return String(value).trim();
  }

  const year =
    date.getUTCFullYear();
  const month = String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    date.getUTCDate(),
  ).padStart(2, "0");

  return `${year}${month}${day}`;
};

const getFdaAffirmationValue = (
  normalizedValues,
  rule,
) => {
  const affirmations =
    Array.isArray(
      normalizedValues
        .fdaAffirmations,
    )
      ? normalizedValues
          .fdaAffirmations
      : [];

  const affirmation =
    affirmations
      .map(toPlainObject)
      .find(
        (item) =>
          Number(item?.sequence) ===
          Number(rule.sequence),
      );

  return affirmation?.[
    rule.component
  ] ?? "";
};

const normalizeCanonicalValue = (
  value,
  rule,
) => {
  if (isBlank(value)) return "";

  switch (rule.transform) {
    case "uom":
      return String(
        normalizeUOM(value),
      )
        .trim()
        .toUpperCase();

    case "country":
      return String(
        normalizeCountryOfOrigin(
          value,
        ),
      )
        .trim()
        .toUpperCase();

    case "hts":
      return String(
        normalizeHTS(value),
      ).trim();

    case "number":
    case "pounds":
      return normalizeNumber(value);

    case "date":
      return formatCanonicalDate(
        value,
      );

    case "uppercaseText":
      return String(value)
        .trim()
        .toUpperCase();

    case "partNumber":
      return String(value)
        .trim()
        .toUpperCase();

    default:
      return String(value).trim();
  }
};

const getCanonicalCellValue = (
  masterType,
  record,
  header,
) => {
  const rule =
    getMasterHeaderRule(
      masterType,
      header.originalName,
    );

  if (!rule) return "";

  if (
    rule.target ===
    "partNumber"
  ) {
    return normalizeCanonicalValue(
      record.partNumber,
      rule,
    );
  }

  const normalizedValues =
    toPlainObject(
      record.normalizedValues,
    ) || {};

  const value =
    rule.transform ===
    "fdaAffirmation"
      ? getFdaAffirmationValue(
          normalizedValues,
          rule,
        )
      : normalizedValues[
          rule.target
        ];

  return normalizeCanonicalValue(
    value,
    rule,
  );
};

const buildCanonicalMasterRawCells = (
  masterType,
  record,
) => getCanonicalMasterHeaders(
  masterType,
).flatMap((header) => {
  const value =
    getCanonicalCellValue(
      masterType,
      record,
      header,
    );

  if (isBlank(value)) return [];

  return [{
    header:
      header.originalName,
    columnIndex:
      header.columnIndex,
    columnLetter:
      header.columnLetter,
    value,
  }];
});

const canonicalizeMasterRecord = (
  masterType,
  record,
) => {
  const plainRecord =
    toPlainObject(record) || {};
  const recordType =
    masterType ||
    plainRecord.masterType;
  const normalizedValues =
    filterMasterNormalizedValues(
      recordType,
      plainRecord
        .normalizedValues,
    );
  const preparedRecord = {
    ...plainRecord,
    masterType: recordType,
    normalizedValues,
  };

  return {
    ...preparedRecord,
    rawCells:
      buildCanonicalMasterRawCells(
        recordType,
        preparedRecord,
      ),
  };
};

const canonicalizeMasterFile = (
  masterFile,
) => {
  const plainMasterFile =
    toPlainObject(masterFile) || {};

  return {
    ...plainMasterFile,
    partNumberColumn: "A",
    headers:
      getCanonicalMasterHeaders(
        plainMasterFile
          .masterType,
      ),
  };
};

module.exports = {
  buildCanonicalMasterRawCells,
  canonicalizeMasterFile,
  canonicalizeMasterRecord,
  formatCanonicalDate,
  getCanonicalCellValue,
  normalizeCanonicalValue,
};
