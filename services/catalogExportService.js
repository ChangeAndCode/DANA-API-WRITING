const ExcelJS = require("exceljs");
const catalogRepository = require("../repositories/catalogRepository");

const addSheet = (workbook, name, rows, columns) => {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns;
  rows.forEach((entry) => sheet.addRow(entry));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B67B1" } };
  sheet.getRow(1).alignment = { vertical: "middle" };
  sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + columns.length)}1` };
  sheet.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });
};

const buildCatalogWorkbook = async () => {
  const [uom, countries] = await Promise.all([
    catalogRepository.list("uom", { includeInactive: true }),
    catalogRepository.list("countries", { includeInactive: true }),
  ]);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DANA API Writing";
  workbook.created = new Date();

  addSheet(workbook, "Unit of Measure", uom.map((entry) => ({
    code: entry.code,
    description: entry.description,
    origin: entry.origin || "",
    decimals: entry.allowsDecimals ? "Yes" : "No",
    aliases: (entry.aliases || []).join(" | "),
    status: entry.isActive ? "Active" : "Inactive",
    updatedAt: entry.updatedAt || "",
  })), [
    { header: "Code", key: "code", width: 12 },
    { header: "Description", key: "description", width: 32 },
    { header: "Origin", key: "origin", width: 12 },
    { header: "Decimals", key: "decimals", width: 12 },
    { header: "Aliases", key: "aliases", width: 48 },
    { header: "Status", key: "status", width: 12 },
    { header: "Last Updated", key: "updatedAt", width: 22, style: { numFmt: "yyyy-mm-dd hh:mm" } },
  ]);

  addSheet(workbook, "Country of Origin", countries.map((entry) => ({
    code: entry.code,
    description: entry.description,
    aliases: (entry.aliases || []).join(" | "),
    status: entry.isActive ? "Active" : "Inactive",
    updatedAt: entry.updatedAt || "",
  })), [
    { header: "CVE_PAIS", key: "code", width: 14 },
    { header: "Description", key: "description", width: 36 },
    { header: "Aliases", key: "aliases", width: 55 },
    { header: "Status", key: "status", width: 12 },
    { header: "Last Updated", key: "updatedAt", width: 22, style: { numFmt: "yyyy-mm-dd hh:mm" } },
  ]);

  return workbook.xlsx.writeBuffer();
};

module.exports = { buildCatalogWorkbook };
