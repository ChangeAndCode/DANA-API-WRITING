const path = require("path");
const ExcelJS = require("exceljs");

const {
  normalizeCurrencyValue,
} = require(
  "./transformationUtils",
);

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

const isCurrencyHeader = (
  header,
) => {
  return (
    MASTER_CURRENCY_MAPPED_FIELDS.has(
      header?.mappedField || "",
    ) ||
    MASTER_CURRENCY_HEADER_KEYS.has(
      header?.normalizedName || "",
    )
  );
};

const normalizeExportCurrencyValue = (
  value,
) => {
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

  const headers = Array.isArray(
    masterFile.headers,
  )
    ? [...masterFile.headers]
    : [];

  headers.sort(
    (firstHeader, secondHeader) =>
      firstHeader.columnIndex -
      secondHeader.columnIndex,
  );

  const currencyColumnIndexes =
    new Set(
      headers
        .filter(
          isCurrencyHeader,
        )
        .map(
          (header) =>
            Number(
              header.columnIndex,
            ),
        ),
    );

  const headerRow =
    worksheet.getRow(
      headerRowNumber,
    );

  headers.forEach((header) => {
    if (
      !Number.isInteger(
        header.columnIndex,
      ) ||
      header.columnIndex < 1
    ) {
      return;
    }

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

  activeRecords.forEach((record) => {
    if (
      !Number.isInteger(
        record.sourceRow,
      ) ||
      record.sourceRow <=
        headerRowNumber
    ) {
      return;
    }

    const row = worksheet.getRow(
      record.sourceRow,
    );

    const rawCells = Array.isArray(
      record.rawCells,
    )
      ? record.rawCells
      : [];

    rawCells.forEach((rawCell) => {
      if (
        !Number.isInteger(
          rawCell.columnIndex,
        ) ||
        rawCell.columnIndex < 1
      ) {
        return;
      }

      const exportValue =
        currencyColumnIndexes.has(
          Number(
            rawCell.columnIndex,
          ),
        )
          ? normalizeExportCurrencyValue(
              rawCell.value,
            )
          : rawCell.value;

      row.getCell(
        rawCell.columnIndex,
      ).value =
        normalizeExportCellValue(
          exportValue,
        );
    });
  });

  worksheet.views = [
    {
      state: "frozen",
      ySplit: headerRowNumber,
    },
  ];

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