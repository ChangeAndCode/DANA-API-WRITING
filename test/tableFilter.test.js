const test = require("node:test");
const assert = require("node:assert/strict");

const {
  filterTableItems,
  normalizeTableFilterText,
} = require("../utils/tableFilter");

const columns = [
  {
    key: "partNumber",
    label: "Part Number",
  },
  {
    key: "description",
    label: "Description",
  },
  {
    key: "country",
    label: "Country of origin",
  },
];

const rows = [
  {
    id: 1,
    partNumber: "SUB:RGD:CP:3A94.5",
    description: "Conector pequeno",
    country: "Mexico",
  },
  {
    id: 2,
    partNumber: "FG-200",
    description: "Lamina de acero",
    country: "Estados Unidos",
  },
  {
    id: 3,
    partNumber: "BOM-300",
    description: "Empaque",
    country: "Canada",
  },
];

const getValue = (row, key) => row[key];

test(
  "normaliza mayusculas y acentos sin interpretar caracteres especiales",
  () => {
    assert.equal(
      normalizeTableFilterText(
        "  M\u00c9XICO: (NORTE)  ",
      ),
      "mexico: (norte)",
    );
  },
);

test(
  "busca coincidencias parciales en varias columnas seleccionadas",
  () => {
    const result = filterTableItems({
      items: rows,
      columns,
      selectedColumnKeys: [
        "partNumber",
        "description",
      ],
      query: "ACERO",
      getValue,
    });

    assert.deepEqual(
      result.map((row) => row.id),
      [2],
    );
  },
);

test(
  "trata los caracteres especiales como texto literal",
  () => {
    const result = filterTableItems({
      items: rows,
      columns,
      selectedColumnKeys: [
        "partNumber",
      ],
      query: "SUB:RGD:CP:",
      getValue,
    });

    assert.deepEqual(
      result.map((row) => row.id),
      [1],
    );
  },
);

test(
  "conserva todos los registros con busqueda vacia y no muta el arreglo fuente",
  () => {
    const result = filterTableItems({
      items: rows,
      columns,
      selectedColumnKeys: [],
      query: "",
      getValue,
    });

    assert.equal(result.length, 3);
    assert.equal(rows.length, 3);
    assert.notEqual(result, rows);
  },
);

test(
  "sin columnas seleccionadas una busqueda activa no produce coincidencias",
  () => {
    const result = filterTableItems({
      items: rows,
      columns,
      selectedColumnKeys: [],
      query: "FG",
      getValue,
    });

    assert.deepEqual(result, []);
  },
);
