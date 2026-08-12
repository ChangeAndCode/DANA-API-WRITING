const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyRowsByValidation,
} = require("../utils/validationUtils");
const {
  prioritizeRowsByValidation,
} = require("../utils/rowReadiness");

const validBomRow = {
  "Finished Good Part Number": "FG-100",
  "Component Part Number": "RM-100",
  Type: "P",
  Quantity: "2",
  "Unit of Measure": "PCS",
  "Component classification": "",
};

test(
  "clasifica cada fila con las reglas DANA y conserva su numero original",
  async () => {
    const rows = [
      {
        ...validBomRow,
        Quantity: "",
      },
      validBomRow,
      {
        ...validBomRow,
        Type: "X",
      },
    ];

    const result = await classifyRowsByValidation(
      { Sheet1: rows },
      "billOfMaterials",
      { allowEmptyMandatoryFields: false },
    );

    assert.deepEqual(
      result.map(({ row, isValid }) => ({
        row,
        isValid,
      })),
      [
        { row: 2, isValid: false },
        { row: 3, isValid: true },
        { row: 4, isValid: false },
      ],
    );
    assert.equal(
      result[0].errors.some(
        (error) =>
          error.field === "Quantity" &&
          error.row === 2,
      ),
      true,
    );
    assert.equal(
      result[2].errors.some(
        (error) =>
          error.field === "Type" &&
          error.row === 4,
      ),
      true,
    );
  },
);

test(
  "prioriza invalidas y mantiene el orden relativo de ambos grupos",
  () => {
    const rows = [
      { id: "valid-1" },
      { id: "invalid-1" },
      { id: "valid-2" },
      { id: "invalid-2" },
    ];
    const validation = [
      { index: 0, isValid: true },
      { index: 1, isValid: false },
      { index: 2, isValid: true },
      { index: 3, isValid: false },
    ];

    const result = prioritizeRowsByValidation(
      rows,
      validation,
    );

    assert.deepEqual(
      result.map(({ row }) => row.id),
      [
        "invalid-1",
        "invalid-2",
        "valid-1",
        "valid-2",
      ],
    );
    assert.deepEqual(
      result.map(({ validation: item }) => item.isValid),
      [false, false, true, true],
    );
  },
);
