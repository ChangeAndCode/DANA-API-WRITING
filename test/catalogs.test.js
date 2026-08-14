const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeCatalogLookup, normalizeAliases } = require("../utils/catalogNormalization");
const uomCatalog = require("../data/uomCatalog");
const countryCatalog = require("../data/countryCatalog");
const { sanitize } = require("../services/catalogService");

test("normaliza acentos, signos y espacios para búsquedas", () => {
  assert.equal(normalizeCatalogLookup("  Estados  Unidos de América. "), "ESTADOS UNIDOS DE AMERICA");
});

test("limpia y elimina alias duplicados", () => {
  assert.deepEqual(normalizeAliases("USA, United States; usa\nEEUU"), ["USA", "United States", "EEUU"]);
});

test("UOM resuelve código, descripción y alias desde el caché", () => {
  uomCatalog.setDatabaseCatalog([{ code: "KG", description: "Kilogram", origin: "USA", allowsDecimals: true, aliases: ["Kilo", "Kilogramo"] }]);
  assert.equal(uomCatalog.normalizeUOM("kg"), "KG");
  assert.equal(uomCatalog.normalizeUOM("kilógramo"), "KG");
  assert.equal(uomCatalog.getUOMDecimals("KG"), 3);
});

test("país resuelve nombres multilingües y alias al mismo código", () => {
  countryCatalog.setDatabaseCatalog([{ code: "US", description: "Estados Unidos", aliases: ["United States", "United States of America", "Estados Unidos de América"] }]);
  assert.equal(countryCatalog.nameToCode("United States"), "US");
  assert.equal(countryCatalog.nameToCode("estados unidos de america"), "US");
  assert.equal(countryCatalog.isValidCountryCode("us"), true);
});

test("valida límites y normaliza entradas administrativas", () => {
  assert.deepEqual(sanitize("uom", { code: " kg ", description: " Kilogram ", origin: "usa", decimals: true, alias: "Kilo, Kilogramo" }), {
    code: "KG", description: "Kilogram", aliases: ["Kilo", "Kilogramo"], origin: "USA", allowsDecimals: true,
  });
  assert.throws(() => sanitize("countries", { code: "USA", description: "Estados Unidos" }), /exactamente 2/);
  assert.throws(() => sanitize("uom", { code: "LONG", description: "Invalid" }), /1 y 3/);
});
