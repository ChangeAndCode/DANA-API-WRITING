const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const ExcelJS = require("exceljs");

const {
  parseMasterFileBuffer,
} = require("../utils/masterFileParser");
const {
  parseMasterFileStream,
} = require("../utils/masterFileStreamParser");

const createP1aBomWorkbook = async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");

  worksheet.getCell("C3").value = "Finish Goods";
  worksheet.getCell("D3").value = "PN";
  worksheet.getCell("E3").value = "Type";
  worksheet.getCell("F3").value = "QTY";
  worksheet.getCell("G3").value = "Unit of Measure";

  worksheet.getCell("C4").value = "167209AC";
  worksheet.getCell("D4").value = "GEAROIL80W90ML";
  worksheet.getCell("E4").value = "P";
  worksheet.getCell("F4").value = 1;
  worksheet.getCell("G4").value = "OZ";

  worksheet.getCell("C5").value = "212858AA";
  worksheet.getCell("D5").value = "212858AA_NP";
  worksheet.getCell("E5").value = "P";
  worksheet.getCell("F5").value = 2;
  worksheet.getCell("G5").value = "EA";

  return workbook.xlsx.writeBuffer();
};

const assertP1aResult = (metadata, records) => {
  assert.equal(metadata.masterType, "billOfMaterials");
  assert.equal(metadata.sourceSheet, "Sheet1");
  assert.equal(metadata.headerRow, 3);
  assert.equal(metadata.partNumberColumn, "C");
  assert.equal(records.length, 2);
  assert.ok(
    metadata.headers.some(
      (header) =>
        header.originalName ===
        "Component classification",
    ),
  );
  assert.equal(records[0].partNumber, "167209AC");
  assert.deepEqual(
    records[0].normalizedValues,
    {
      componentPartNumber: "GEAROIL80W90ML",
      bomType: "P",
      quantity: 1,
      unitOfMeasure: "OZ",
    },
  );
};

test(
  "B.O.M. P1A detecta alias, fila 3 y columnas C-G sin depender de la hoja",
  async () => {
    const buffer = Buffer.from(
      await createP1aBomWorkbook(),
    );
    const result = await parseMasterFileBuffer(
      buffer,
      {
        expectedMasterType: "billOfMaterials",
      },
    );

    assertP1aResult(
      result.metadata,
      result.records,
    );
  },
);

test(
  "B.O.M. P1A conserva la deteccion al importar por streaming",
  async (t) => {
    const temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "dana-bom-p1a-"),
    );
    const filePath = path.join(
      temporaryDirectory,
      "bom-p1a.xlsx",
    );
    const records = [];
    let metadata = null;

    t.after(async () => {
      await fs.rm(
        temporaryDirectory,
        { recursive: true, force: true },
      );
    });

    await fs.writeFile(
      filePath,
      Buffer.from(await createP1aBomWorkbook()),
    );

    const result = await parseMasterFileStream(
      filePath,
      {
        expectedMasterType: "billOfMaterials",
        onMetadata: async (value) => {
          metadata = value;
        },
        onBatch: async (batch) => {
          records.push(...batch);
        },
      },
    );

    assert.equal(result.recordCount, 2);
    assertP1aResult(metadata, records);
  },
);
