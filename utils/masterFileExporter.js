const path = require("path");
const ExcelJS = require("exceljs");
const {
  getCanonicalMasterHeaders,
} = require("../data/masterFileRegistry");
const {
  canonicalizeMasterRecord,
  getCanonicalCellValue,
} = require("./masterFileCanonical");

/**
 * Convierte el nombre de la hoja en un nombre válido
 * para Excel.
 */
const sanitizeWorksheetName = (value) => {
  const sanitizedName = String(
    value || "MasterFile",
  )
    .replace(
      /[\\/*?:\[\]]/g,
      "_",
    )
    .trim()
    .slice(0, 31);

  return sanitizedName || "MasterFile";
};

/**
 * Genera un nombre seguro para el archivo descargado.
 */
const createDownloadFileName = (
  masterFile,
) => {
  const sourceName =
    masterFile.originalFileName ||
    masterFile.name ||
    "archivo-madre";

  const baseName = path
    .parse(sourceName)
    .name
    .replace(
      /[<>:"/\\|?*\u0000-\u001F]/g,
      "_",
    )
    .trim();

  return `${
    baseName || "archivo-madre"
  }-sin-imagenes.xlsx`;
};

/**
 * Convierte valores de MongoDB a valores compatibles
 * con una celda de Excel.
 */
const normalizeExportCellValue = (
  value,
) => {
  if (
    value === null ||
    value === undefined
  ) {
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

  return String(value);
};

/**
 * Reconstruye el archivo Excel usando los encabezados
 * y las celdas originales guardadas en MongoDB.
 *
 * No incorpora imágenes.
 */
const createMasterFileWorkbook = async ({
  masterFile,
  records,
}) => {
  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    "DANA API Writing";

  workbook.created =
    new Date();

  const worksheet =
    workbook.addWorksheet(
      sanitizeWorksheetName(
        masterFile.sourceSheet,
      ),
    );

  const headerRowNumber =
    Number.isInteger(
      masterFile.headerRow,
    ) &&
    masterFile.headerRow > 0
      ? masterFile.headerRow
      : 1;

  const headers =
    getCanonicalMasterHeaders(
      masterFile.masterType,
    );

  const headerRow =
    worksheet.getRow(
      headerRowNumber,
    );

  headers.forEach((header) => {
    const headerCell =
      headerRow.getCell(
        header.columnIndex,
      );

    headerCell.value =
      header.originalName || "";

    headerCell.font = {
      bold: true,
      color: {
        argb: "FFFFFFFF",
      },
    };

    headerCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FF2563EB",
      },
    };

    headerCell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };

    worksheet.getColumn(
      header.columnIndex,
    ).width = Math.min(
      Math.max(
        String(
          header.originalName || "",
        ).length + 2,
        12,
      ),
      35,
    );
  });

  headerRow.height = 32;

  const activeRecords = Array.isArray(
    records,
  )
    ? records
    : [];

  activeRecords.forEach(
    (record, recordIndex) => {
      const canonicalRecord =
        canonicalizeMasterRecord(
          masterFile.masterType,
          record,
        );
      const row =
        worksheet.getRow(
          headerRowNumber +
            recordIndex +
            1,
        );

      headers.forEach(
        (header) => {
          const cell =
            row.getCell(
              header.columnIndex,
            );
          const value =
            getCanonicalCellValue(
              masterFile.masterType,
              canonicalRecord,
              header,
            );

          cell.value =
            normalizeExportCellValue(
              value,
            );

          if (
            header.mappedField ===
              "importationHtsCode" ||
            header.mappedField ===
              "exportationHtsCode"
          ) {
            cell.numFmt = "@";
          }
        },
      );
    },
  );

  worksheet.views = [
    {
      state: "frozen",
      ySplit: headerRowNumber,
    },
  ];

  worksheet.autoFilter = {
    from: {
      row: headerRowNumber,
      column: 1,
    },
    to: {
      row: headerRowNumber,
      column: headers.length,
    },
  };

  const generatedBuffer =
    await workbook.xlsx.writeBuffer();

  return {
    buffer:
      Buffer.from(generatedBuffer),

    fileName:
      createDownloadFileName(
        masterFile,
      ),

    exportedRecordCount:
      activeRecords.length,
  };
};

module.exports = {
  createMasterFileWorkbook,
};
