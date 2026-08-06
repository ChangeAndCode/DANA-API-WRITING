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

const createTestEnvironment = () => ({
  SFTP_HOST: "gaiim.test",
  SFTP_PORT: "22",
  SFTP_USERNAME: "gaiim-user",
  SFTP_PASSWORD: "gaiim-password",
  SFTP_REMOTE_UPLOAD_DIR: "/gaiim/inbox",
  SFTP_2_HOST: "p1a.test",
  SFTP_2_PORT: "2222",
  SFTP_2_USERNAME: "p1a-user",
  SFTP_2_PASSWORD: "p1a-password",
  SFTP_2_REMOTE_UPLOAD_DIR: "/p1a/inbox",
});

test("valida configuraciones SFTP independientes para GAIIM y P1A", () => {
  const env = createTestEnvironment();

  assert.equal(validateSiteConfiguration("gaiim", env).valid, true);
  assert.equal(validateSiteConfiguration("p1a", env).valid, true);

  const gaiim = getSiteConfiguration("gaiim", env);
  const p1a = getSiteConfiguration("p1a", env);

  assert.equal(gaiim.remoteUploadDir, "/gaiim/inbox");
  assert.equal(p1a.remoteUploadDir, "/p1a/inbox");
  assert.notEqual(gaiim.host, p1a.host);
  assert.notEqual(gaiim.username, p1a.username);
});

test("marca una sede como incompleta sin autenticacion o ruta remota", () => {
  const env = createTestEnvironment();
  delete env.SFTP_2_PASSWORD;
  delete env.SFTP_2_REMOTE_UPLOAD_DIR;

  const result = validateSiteConfiguration("p1a", env);

  assert.equal(result.valid, false);
  assert.deepEqual(
    result.missing.sort(),
    ["authentication", "remoteUploadDir"].sort(),
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
    FinishedProduct,
    RawMaterial,
    BillOfMaterials,
    SPLScrap,
  ];

  models.forEach((Model) => {
    const document = new Model();
    assert.equal(document.sftpDelivery.status, "not_sent");
    assert.equal(document.sftpDelivery.attempts, 0);
  });
});

