const test = require("node:test");
const assert = require("node:assert/strict");
const { withTimeout } = require("../utils/promiseTimeout");

test("withTimeout devuelve el resultado cuando la operación termina a tiempo", async () => {
  assert.equal(await withTimeout(Promise.resolve("ok"), 50), "ok");
});

test("withTimeout rechaza y ejecuta la limpieza cuando la operación se bloquea", async () => {
  let cleaned = false;
  await assert.rejects(
    withTimeout(new Promise(() => {}), 10, {
      code: "SFTP_OPERATION_TIMEOUT",
      message: "timeout",
      onTimeout: () => { cleaned = true; },
    }),
    (error) => error.code === "SFTP_OPERATION_TIMEOUT" && error.message === "timeout",
  );
  assert.equal(cleaned, true);
});