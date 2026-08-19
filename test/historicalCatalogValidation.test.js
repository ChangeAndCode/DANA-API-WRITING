const test = require("node:test");
const assert = require("node:assert/strict");

const uomCatalog = require("../data/uomCatalog");
const { validateDataIntegrity } = require("../utils/validationUtils");

const validateRows = (rows, allowances = {}) =>
  validateDataIntegrity(
    { Sheet1: rows },
    "rawMaterial",
    {
      allowEmptyMandatoryFields: true,
      historicalCatalogAllowances: {
        unitOfMeasure: allowances,
      },
    },
  );

test("permite conservar una UOM histórica inactiva dentro de su cantidad original", () => {
  uomCatalog.setDatabaseCatalog([
    { code: "EA", description: "Each", isActive: true },
  ]);

  const result = validateRows(
    [{ "Unit of measure": "OLD" }],
    { OLD: 1 },
  );

  assert.equal(result.isValid, true);
});

test("rechaza apariciones adicionales de una UOM histórica inactiva", () => {
  uomCatalog.setDatabaseCatalog([
    { code: "EA", description: "Each", isActive: true },
  ]);

  const result = validateRows(
    [
      { "Unit of measure": "OLD" },
      { "Unit of measure": "OLD" },
    ],
    { OLD: 1 },
  );

  assert.equal(result.isValid, false);
  assert.equal(result.errors.some((error) => error.value === "OLD"), true);
});

test("rechaza un código inexistente cuando no tiene excepción histórica", () => {
  uomCatalog.setDatabaseCatalog([
    { code: "EA", description: "Each", isActive: true },
  ]);

  const result = validateRows([{ "Unit of measure": "DEL" }]);

  assert.equal(result.isValid, false);
  assert.equal(result.errors.some((error) => error.value === "DEL"), true);
});
