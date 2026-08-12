const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildAccentInsensitiveLiteralPattern,
  buildMasterEditorSearchExpression,
  parseMasterEditorColumnIndexes,
} = require("../utils/masterEditorSearch");

test(
  "la busqueda madre trata simbolos como texto literal",
  () => {
    const pattern =
      buildAccentInsensitiveLiteralPattern(
        "SUB:RGD:(A.1)",
      );
    const expression = new RegExp(
      pattern,
      "i",
    );

    assert.equal(
      expression.test(
        "xx-SUB:RGD:(A.1)-yy",
      ),
      true,
    );
    assert.equal(
      expression.test(
        "SUB:RGD:XA01",
      ),
      false,
    );
  },
);

test(
  "la busqueda madre ignora acentos y mayusculas",
  () => {
    const pattern =
      buildAccentInsensitiveLiteralPattern(
        "MEXICO",
      );
    const expression = new RegExp(
      pattern,
      "i",
    );

    assert.equal(
      expression.test(
        "M\u00e9xico",
      ),
      true,
    );
  },
);

test(
  "normaliza y deduplica columnas solicitadas",
  () => {
    assert.deepEqual(
      parseMasterEditorColumnIndexes([
        "3, 1",
        "3",
        "invalida",
      ]),
      [3, 1],
    );
  },
);

test(
  "la expresion Mongo limita la busqueda a las columnas elegidas",
  () => {
    const expression =
      buildMasterEditorSearchExpression({
        search: "FG-100",
        columnIndexes: [2, 5],
      });

    const conditions =
      expression.$expr.$gt[0].$size
        .$filter.cond.$and;

    assert.deepEqual(
      conditions[0].$in[1],
      [2, 5],
    );
    assert.equal(
      conditions[1].$regexMatch
        .options,
      "i",
    );
  },
);
