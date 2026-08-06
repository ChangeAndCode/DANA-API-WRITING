const crypto = require("crypto");
const fs = require("fs");
const fsPromises = require("fs/promises");
const ExcelJS = require("exceljs");

const {
  MASTER_TYPES,
  normalizeMasterHeader,
  getMasterFileConfig,
  getCanonicalMasterHeaders,
} = require("../data/masterFileRegistry");

const {
  canonicalizeMasterRecord,
} = require("./masterFileCanonical");

const {
  createParserError,
  getCellValue,
  toCleanText,
  resolveHeaderRule,
  validateRequiredHeaders,
  findPartNumberHeader,
  summarizeMasterHeaderCandidate,
  parseDataRow,
} = require("./masterFileParser");

const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_WARNING_SAMPLE_LIMIT = 200;
const DEFAULT_MASTER_HEADER_SCAN_LIMIT = 25;

const toExcelColumnLetter = (columnIndex) => {
  let value = Number(columnIndex);
  let result = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
};

const calculateFileChecksum = async (filePath) => {
  const hash = crypto.createHash("sha256");

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });

  return hash.digest("hex");
};

const buildStreamingHeaders = (headerRow, config) => {
  const headers = [];
  const columnCount = Math.max(
    Number(headerRow?.cellCount) || 0,
    Number(headerRow?.actualCellCount) || 0,
  );

  for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
    const columnLetter = toExcelColumnLetter(columnIndex);
    const originalHeader = toCleanText(
      getCellValue(headerRow.getCell(columnIndex)),
    );

    if (!originalHeader) continue;

    const normalizedHeader = normalizeMasterHeader(originalHeader);
    const explicitlyIgnored =
      config.ignoredHeaderKeys.includes(
        normalizedHeader,
      );
    const rule = explicitlyIgnored
      ? null
      : resolveHeaderRule(config, columnLetter, normalizedHeader);
    const ignored = explicitlyIgnored || !rule;

    headers.push({
      originalName: originalHeader,
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

const parseStreamingDataRow = (
  row,
  headers,
  partNumberHeader,
  masterType,
) => parseDataRow(
  { getRow: () => row },
  row.number,
  headers,
  partNumberHeader,
  masterType,
);

/**
 * Lee un archivo madre desde disco fila por fila. Nunca conserva el workbook
 * completo ni el conjunto total de registros en memoria.
 */
const parseMasterFileStream = async (filePath, options = {}) => {
  const fileStats = await fsPromises.stat(filePath).catch(() => null);

  if (!fileStats?.isFile() || fileStats.size === 0) {
    throw createParserError(
      "MASTER_FILE_PATH_INVALID",
      "El archivo madre está vacío o no es válido.",
    );
  }

  const parsedBatchSize = Number.parseInt(options.batchSize, 10);
  const batchSize = Number.isInteger(parsedBatchSize) && parsedBatchSize > 0
    ? parsedBatchSize
    : DEFAULT_BATCH_SIZE;
  const warningSampleLimit = Math.max(
    1,
    Number.parseInt(options.warningSampleLimit, 10) ||
      DEFAULT_WARNING_SAMPLE_LIMIT,
  );
  const parsedHeaderScanLimit = Number.parseInt(
    options.headerScanLimit,
    10,
  );
  const headerScanLimit =
    Number.isInteger(parsedHeaderScanLimit) &&
    parsedHeaderScanLimit > 0
      ? parsedHeaderScanLimit
      : DEFAULT_MASTER_HEADER_SCAN_LIMIT;
  const checksum = await calculateFileChecksum(filePath);
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    worksheets: "emit",
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "cache",
    entries: "emit",
  });

  let detectedMasterType = "";
  let sourceSheet = "";
  let detectedHeaderRow = 0;
  let publicHeaders = [];
  let partNumberColumn = "";
  let recordCount = 0;
  let skippedTemplateRows = 0;
  let skippedEmptyPartNumbers = 0;
  let duplicateGroupCount = 0;
  let metadataDelivered = false;
  const partNumberCounts = new Map();
  const warningSamples = [];
  let batch = [];
  let selectedConfig = null;

  const appendWarningSample = (message) => {
    if (warningSamples.length < warningSampleLimit) {
      warningSamples.push(message);
    }
  };

  try {
    for await (const worksheet of workbookReader) {
      if (sourceSheet) continue;

      const candidateTypes =
        options.expectedMasterType
          ? [options.expectedMasterType]
          : Object.values(MASTER_TYPES);
      const candidateConfigs = candidateTypes
        .map((masterType) => ({
          masterType,
          config: getMasterFileConfig(
            masterType,
            worksheet.name,
          ),
        }))
        .filter(({ config }) => {
          const normalizedWorksheetName =
            String(worksheet.name || "")
              .trim()
              .toLowerCase();

          return !(config.ignoredSheetNames || [])
            .some(
              (name) =>
                String(name || "")
                  .trim()
                  .toLowerCase() ===
                normalizedWorksheetName,
            );
        });
      let headers = [];
      let partNumberHeader = null;

      for await (const row of worksheet) {
        if (!partNumberHeader) {
          if (row.number > headerScanLimit) break;

          let bestCandidate = null;

          for (const candidateConfig of candidateConfigs) {
            const candidateHeaders =
              buildStreamingHeaders(
                row,
                candidateConfig.config,
              );
            const summary =
              summarizeMasterHeaderCandidate(
                candidateHeaders,
                candidateConfig.config,
              );

            if (!summary.valid) continue;

            const knownSheetName =
              (candidateConfig.config.sheetNames || [])
                .some(
                  (name) =>
                    String(name || "")
                      .trim()
                      .toLowerCase() ===
                    String(worksheet.name || "")
                      .trim()
                      .toLowerCase(),
                );
            const score =
              summary.score * 100 +
              (knownSheetName ? 10 : 0);

            if (
              !bestCandidate ||
              score > bestCandidate.score
            ) {
              bestCandidate = {
                ...candidateConfig,
                headers: candidateHeaders,
                partNumberHeader:
                  summary.partNumberHeader,
                score,
              };
            }
          }

          if (!bestCandidate) continue;

          detectedMasterType =
            bestCandidate.masterType;
          sourceSheet = worksheet.name;
          detectedHeaderRow = row.number;
          selectedConfig = {
            ...bestCandidate.config,
            headerRow: detectedHeaderRow,
          };
          headers = bestCandidate.headers;
          partNumberHeader =
            bestCandidate.partNumberHeader;

          validateRequiredHeaders(
            headers,
            selectedConfig,
          );

          if (!partNumberHeader) {
            throw createParserError(
              "MASTER_PART_NUMBER_COLUMN_NOT_FOUND",
              "No se encontró la columna Part Number.",
            );
          }

          publicHeaders =
            getCanonicalMasterHeaders(
              detectedMasterType,
            );
          partNumberColumn =
            partNumberHeader.columnLetter;

          if (typeof options.onMetadata === "function") {
            await options.onMetadata({
              originalFileName: options.originalFileName || "",
              masterType: detectedMasterType,
              sourceSheet,
              headerRow: detectedHeaderRow,
              partNumberColumn,
              headers: publicHeaders,
              recordCount: 0,
              imageCountIgnored: 0,
              fileSizeBytes: fileStats.size,
              checksum,
              warningCount: 0,
              importWarnings: [],
            });
          }

          metadataDelivered = true;
          continue;
        }

        const result = parseStreamingDataRow(
          row,
          headers,
          partNumberHeader,
          detectedMasterType,
        );

        if (result.skipped) {
          if (result.reason === "TEMPLATE_ROW") skippedTemplateRows += 1;
          if (result.reason === "EMPTY_PART_NUMBER") {
            skippedEmptyPartNumbers += 1;
          }
          continue;
        }

        recordCount += 1;
        if (
          selectedConfig
            .allowDuplicatePartNumbers !== true
        ) {
          const key = result.record.partNumberNormalized;
          const previousCount = partNumberCounts.get(key) || 0;
          partNumberCounts.set(key, previousCount + 1);
          if (previousCount === 1) duplicateGroupCount += 1;
        }

        batch.push(
          canonicalizeMasterRecord(
            detectedMasterType,
            result.record,
          ),
        );

        if (batch.length >= batchSize) {
          if (typeof options.onBatch === "function") {
            await options.onBatch(batch);
          }
          batch = [];

          if (typeof options.onProgress === "function") {
            await options.onProgress({ recordCount, sourceRow: row.number });
          }
        }
      }
    }
  } catch (error) {
    if (String(error.code || "").startsWith("MASTER_")) throw error;
    throw createParserError(
      "MASTER_FILE_READ_ERROR",
      `No fue posible leer el archivo Excel: ${error.message}`,
    );
  }

  if (!sourceSheet || !metadataDelivered) {
    throw createParserError(
      "MASTER_TYPE_NOT_DETECTED",
      "No se encontro una fila de encabezados valida para el tipo de archivo madre seleccionado.",
    );
  }

  if (batch.length > 0 && typeof options.onBatch === "function") {
    await options.onBatch(batch);
    batch = [];
  }

  if (skippedTemplateRows > 0) {
    appendWarningSample(
      `Se omitieron ${skippedTemplateRows} filas de especificación.`,
    );
  }
  if (skippedEmptyPartNumbers > 0) {
    appendWarningSample(
      `Se omitieron ${skippedEmptyPartNumbers} filas sin Part Number.`,
    );
  }
  if (duplicateGroupCount > 0) {
    appendWarningSample(
      `${duplicateGroupCount} Part Numbers aparecen repetidos en el archivo.`,
    );
  }

  const totalWarningCount =
    skippedTemplateRows + skippedEmptyPartNumbers + duplicateGroupCount;

  return {
    metadata: {
      originalFileName: options.originalFileName || "",
      masterType: detectedMasterType,
      sourceSheet,
      headerRow: detectedHeaderRow,
      partNumberColumn,
      headers: publicHeaders,
      recordCount,
      imageCountIgnored: 0,
      fileSizeBytes: fileStats.size,
      checksum,
      warningCount: totalWarningCount,
      importWarnings: warningSamples,
      warningSamplesTruncated: totalWarningCount > warningSamples.length,
    },
    recordCount,
  };
};

module.exports = {
  parseMasterFileStream,
};
