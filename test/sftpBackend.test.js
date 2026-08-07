const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getSiteConfiguration,
  sanitizeRemoteFileName,
  sanitizeSftpError,
  validateSiteConfiguration,
} = require("../services/siteSftpService");
const FinishedProduct = require("../models/FinishedProduct");
const RawMaterial = require("../models/RawMaterial");
const BillOfMaterials = require("../models/BOM");
const SPLScrap = require("../models/SPLScrap");
const {
  formatExpectedArrivalDateForDisplay,
} = require("../services/fileConversionService");

const createTestEnvironment = () => ({
  SFTP_HOST: "gaiim.test",
  SFTP_PORT: "22",
  SFTP_USERNAME: "gaiim-user",
  SFTP_PASSWORD: "gaiim-password",
  SFTP_REMOTE_UPLOAD_DIR: "/gaiim/inbox",
  SFTP_REMOTE_ERROR_DIR: "/gaiim/errors",
  SFTP_2_HOST: "p1a.test",
  SFTP_2_PORT: "2222",
  SFTP_2_USERNAME: "p1a-user",
  SFTP_2_PASSWORD: "p1a-password",
  SFTP_2_REMOTE_UPLOAD_DIR: "/p1a/inbox",
  SFTP_2_REMOTE_ERROR_DIR: "/p1a/errors",
});

test("valida configuraciones SFTP independientes para GAIIM y P1A", () => {
  const env = createTestEnvironment();

  assert.equal(validateSiteConfiguration("gaiim", env).valid, true);
  assert.equal(validateSiteConfiguration("p1a", env).valid, true);

  const gaiim = getSiteConfiguration("gaiim", env);
  const p1a = getSiteConfiguration("p1a", env);

  assert.equal(gaiim.remoteUploadDir, "/gaiim/inbox");
  assert.equal(gaiim.remoteErrorDir, "/gaiim/errors");
  assert.equal(p1a.remoteUploadDir, "/p1a/inbox");
  assert.equal(p1a.remoteErrorDir, "/p1a/errors");
  assert.notEqual(gaiim.host, p1a.host);
  assert.notEqual(gaiim.username, p1a.username);
});

test("marca una sede como incompleta sin autenticacion o ruta remota", () => {
  const env = createTestEnvironment();
  delete env.SFTP_2_PASSWORD;
  delete env.SFTP_2_REMOTE_UPLOAD_DIR;
  delete env.SFTP_2_REMOTE_ERROR_DIR;

  const result = validateSiteConfiguration("p1a", env);

  assert.equal(result.valid, false);
  assert.deepEqual(
    result.missing.sort(),
    ["authentication", "remoteErrorDir", "remoteUploadDir"].sort(),
  );
});

test("sanea nombres remotos para impedir rutas proporcionadas por el archivo", () => {
  assert.equal(
    sanitizeRemoteFileName("../folder\\unsafe?.txt"),
    "unsafe_.txt",
  );
});

test("los errores publicos SFTP no exponen el mensaje interno", () => {
  const internalError = new Error(
    "unexpected password=do-not-expose privateKey=do-not-expose",
  );
  const publicError = sanitizeSftpError(internalError);

  assert.equal(publicError.code, "SFTP_OPERATION_FAILED");
  assert.equal(
    publicError.message,
    "No se pudo completar la operacion SFTP.",
  );
  assert.equal(publicError.message.includes("do-not-expose"), false);
});

test("los cuatro modelos inician sin envio SFTP", () => {
  const models = [
    [FinishedProduct, "pending"],
    [RawMaterial, "pending"],
    [BillOfMaterials, "pending"],
    [SPLScrap, "not_applicable"],
  ];

  models.forEach(([Model, expectedMfStatus]) => {
    const document = new Model();
    assert.equal(document.sftpDelivery.status, "not_sent");
    assert.equal(document.sftpDelivery.attempts, 0);
    assert.equal(document.masterFileSync.status, expectedMfStatus);
    assert.equal(document.masterFileSync.attempts, 0);
  });
});

test("muestra Expected date of arrival con guiones sin cambiar sus ocho digitos", () => {
  assert.equal(
    formatExpectedArrivalDateForDisplay("20260805"),
    "2026-08-05",
  );
  assert.equal(
    formatExpectedArrivalDateForDisplay("2026-08-05"),
    "2026-08-05",
  );
  assert.equal(
    formatExpectedArrivalDateForDisplay("2026-08-05T00:00:00.000Z"),
    "2026-08-05",
  );
});

