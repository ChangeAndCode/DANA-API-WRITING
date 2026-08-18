const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SFTP_IN_PROGRESS_STATUSES,
  createSftpAvailableFilter,
  createSftpOperationId,
  createSftpOwnerFilter,
  createSftpSendAcquisitionFilter,
  getSftpLeaseExpiry,
  isSftpOperationActive,
  shouldDeletePreviousRemoteFile,
} = require("../utils/sftpOperationLock");

const TIMEOUT_MS = 60000;
const NOW = new Date("2026-08-17T12:00:00.000Z");

test("genera un operationId unico para cada intento SFTP", () => {
  const first = createSftpOperationId();
  const second = createSftpOperationId();
  assert.match(first, /^[0-9a-f-]{36}$/i);
  assert.notEqual(first, second);
});

test("calcula el vencimiento del lease desde el instante indicado", () => {
  assert.equal(
    getSftpLeaseExpiry(TIMEOUT_MS, NOW).toISOString(),
    "2026-08-17T12:01:00.000Z",
  );
});

test("considera activo un envio con lease vigente aunque su intento sea antiguo", () => {
  assert.equal(
    isSftpOperationActive(
      {
        status: "sending",
        lastAttemptAt: new Date(NOW.getTime() - TIMEOUT_MS * 10),
        lockExpiresAt: new Date(NOW.getTime() + 1000),
      },
      TIMEOUT_MS,
      NOW,
    ),
    true,
  );
});

test("considera recuperable un envio cuyo lease ya vencio", () => {
  assert.equal(
    isSftpOperationActive(
      {
        status: "sending",
        lockExpiresAt: new Date(NOW.getTime() - 1),
      },
      TIMEOUT_MS,
      NOW,
    ),
    false,
  );
});

test("mantiene compatibilidad con locks antiguos basados en lastAttemptAt", () => {
  assert.equal(
    isSftpOperationActive(
      {
        status: "pending",
        lastAttemptAt: new Date(NOW.getTime() - 1000),
      },
      TIMEOUT_MS,
      NOW,
    ),
    true,
  );
  assert.equal(
    isSftpOperationActive(
      {
        status: "pending",
        lastAttemptAt: new Date(NOW.getTime() - TIMEOUT_MS - 1),
      },
      TIMEOUT_MS,
      NOW,
    ),
    false,
  );
});

test("el filtro disponible contempla estados libres, leases vencidos y locks antiguos", () => {
  const filter = createSftpAvailableFilter({
    id: "document-id",
    timeoutMs: TIMEOUT_MS,
    now: NOW,
  });
  assert.equal(filter._id, "document-id");
  assert.deepEqual(filter.$or[0], {
    "sftpDelivery.status": { $nin: SFTP_IN_PROGRESS_STATUSES },
  });
  assert.deepEqual(filter.$or[1], {
    "sftpDelivery.lockExpiresAt": { $lte: NOW },
  });
  assert.deepEqual(
    filter.$or[2].$and[2]["sftpDelivery.lastAttemptAt"].$lt,
    new Date(NOW.getTime() - TIMEOUT_MS),
  );
});

test("el filtro propietario exige el operationId del intento actual", () => {
  assert.deepEqual(
    createSftpOwnerFilter({
      id: "document-id",
      operationId: "attempt-b",
      statuses: ["sending"],
    }),
    {
      _id: "document-id",
      "sftpDelivery.operationId": "attempt-b",
      "sftpDelivery.status": { $in: ["sending"] },
    },
  );
});
test("el filtro de envio impide adquirir documentos ya enviados", () => {
  const filter = createSftpSendAcquisitionFilter({
    id: "document-id",
    timeoutMs: TIMEOUT_MS,
    now: NOW,
  });
  assert.deepEqual(filter["sftpDelivery.status"], { $ne: "sent" });
  assert.deepEqual(filter["masterFileSync.status"], { $ne: "applying" });
});

test("no elimina el remoto anterior cuando se sobrescribe la misma ruta", () => {
  assert.equal(
    shouldDeletePreviousRemoteFile({
      previousSite: "gaiim",
      previousPath: "/out/PI171727_0826.csv",
      nextSite: "gaiim",
      nextPath: "/out/PI171727_0826.csv",
    }),
    false,
  );
});

test("elimina el remoto anterior cuando cambia nomenclatura o sede", () => {
  assert.equal(
    shouldDeletePreviousRemoteFile({
      previousSite: "gaiim",
      previousPath: "/out/PI171727_0826.csv",
      nextSite: "gaiim",
      nextPath: "/out/PI181030_0826.csv",
    }),
    true,
  );
  assert.equal(
    shouldDeletePreviousRemoteFile({
      previousSite: "gaiim",
      previousPath: "/out/PI171727_0826.csv",
      nextSite: "p1a",
      nextPath: "/out/PI171727_0826.csv",
    }),
    true,
  );
});

test("no intenta eliminar un remoto anterior inexistente", () => {
  assert.equal(
    shouldDeletePreviousRemoteFile({
      previousSite: "gaiim",
      previousPath: "",
      nextSite: "gaiim",
      nextPath: "/out/PI181030_0826.csv",
    }),
    false,
  );
});