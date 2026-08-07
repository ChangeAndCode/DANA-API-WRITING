const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildMasterSyncRecords,
  buildMasterSyncAuditFields,
  planMasterRecordSync,
  prepareAdminFileMasterSync,
} = require("../services/masterFileService");

const toExistingRecord = (entry, id) => ({
  _id: id,
  ...entry.record,
});

test("FG y RM clasifican altas, cambios y filas sin cambios por Part Number", () => {
  const incomingRecords = buildMasterSyncRecords({
    masterType: "rawMaterial",
    rows: [
      {
        "Part Number": "RM-100",
        Description: "Descripcion nueva",
        "Unit of Measure": "EA",
      },
      {
        "Part Number": "RM-200",
        Description: "Registro nuevo",
        "Unit of Measure": "EA",
      },
      {
        "Part Number": "RM-300",
        Description: "Sin cambios",
        "Unit of Measure": "EA",
      },
    ],
  });
  const previousChanged = buildMasterSyncRecords({
    masterType: "rawMaterial",
    rows: [
      {
        "Part Number": "RM-100",
        Description: "Descripcion anterior",
        "Unit of Measure": "EA",
      },
    ],
  })[0];
  const previousUnchanged = buildMasterSyncRecords({
    masterType: "rawMaterial",
    rows: [
      {
        "Part Number": "RM-300",
        Description: "Sin cambios",
        "Unit of Measure": "EA",
      },
    ],
  })[0];

  const plan = planMasterRecordSync({
    masterType: "rawMaterial",
    incomingRecords,
    existingRecords: [
      toExistingRecord(previousChanged, "changed-id"),
      toExistingRecord(previousUnchanged, "unchanged-id"),
    ],
  });

  assert.deepEqual(plan.summary, {
    total: 3,
    added: 1,
    updated: 1,
    unchanged: 1,
  });
  assert.equal(plan.added[0].key, "RM-200");
  assert.equal(plan.updated[0].key, "RM-100");
  assert.equal(plan.unchanged[0].key, "RM-300");
});

test("B.O.M. usa Finished Good y Component Part Number como llave compuesta", () => {
  const incomingRecords = buildMasterSyncRecords({
    masterType: "billOfMaterials",
    rows: [
      {
        "Finished Good Part Number": "FG-1",
        "Component Part Number": "COMP-A",
        Type: "P",
        Quantity: 1,
        "Unit of Measure": "EA",
      },
      {
        "Finished Good Part Number": "FG-1",
        "Component Part Number": "COMP-B",
        Type: "P",
        Quantity: 2,
        "Unit of Measure": "EA",
      },
    ],
  });

  const plan = planMasterRecordSync({
    masterType: "billOfMaterials",
    incomingRecords,
    existingRecords: [
      toExistingRecord(incomingRecords[0], "existing-bom-id"),
    ],
  });

  assert.equal(incomingRecords[0].key, "FG-1||COMP-A");
  assert.equal(incomingRecords[1].key, "FG-1||COMP-B");
  assert.deepEqual(plan.summary, {
    total: 2,
    added: 1,
    updated: 0,
    unchanged: 1,
  });
});

test("rechaza una llave repetida con valores diferentes en el archivo enviado", () => {
  assert.throws(
    () =>
      buildMasterSyncRecords({
        masterType: "finishedProduct",
        rows: [
          {
            "Part Number": "FG-100",
            Description: "Primera descripcion",
          },
          {
            "Part Number": "fg-100",
            Description: "Segunda descripcion",
          },
        ],
      }),
    (error) =>
      error.code === "MASTER_SYNC_SOURCE_DUPLICATE_CONFLICT" &&
      error.statusCode === 409,
  );
});

test("deduplica una llave repetida cuando sus valores normalizados son iguales", () => {
  const records = buildMasterSyncRecords({
    masterType: "finishedProduct",
    rows: [
      {
        "Part Number": "FG-200",
        Description: "Mismo valor",
      },
      {
        "Part Number": "fg-200",
        Description: "Mismo valor",
      },
    ],
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].key, "FG-200");
});

test("Packing List no prepara ninguna actualizacion de archivo madre", async () => {
  const result = await prepareAdminFileMasterSync({
    documentType: "splScrap",
    rows: [{ "Part Number": "PACK-1" }],
    site: "gaiim",
    user: null,
  });

  assert.deepEqual(result, {
    required: false,
  });
});

test("la auditoria MF conserva solo los campos que realmente cambiaron", () => {
  const beforeRecord = buildMasterSyncRecords({
    masterType: "rawMaterial",
    rows: [
      {
        "Part Number": "RM-AUDIT",
        Description: "Descripcion anterior",
        "Unit of Measure": "EA",
      },
    ],
  })[0].record;
  const afterRecord = buildMasterSyncRecords({
    masterType: "rawMaterial",
    rows: [
      {
        "Part Number": "RM-AUDIT",
        Description: "Descripcion nueva",
        "Unit of Measure": "EA",
      },
    ],
  })[0].record;

  const changes = buildMasterSyncAuditFields({
    masterType: "rawMaterial",
    beforeRecord,
    afterRecord,
  });

  assert.deepEqual(changes, [
    {
      field: "Description",
      before: "Descripcion anterior",
      after: "Descripcion nueva",
    },
  ]);
});
