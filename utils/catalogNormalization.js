const normalizeCatalogLookup = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const normalizeAliases = (aliases) => {
  const values = Array.isArray(aliases)
    ? aliases
    : String(aliases ?? "").split(/[,;\n]/);
  const seen = new Set();

  return values
    .map((value) => String(value ?? "").trim())
    .filter((value) => {
      const key = normalizeCatalogLookup(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

module.exports = { normalizeCatalogLookup, normalizeAliases };
