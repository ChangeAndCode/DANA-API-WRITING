// /data/uomCatalog.js
const path = require("path");
const fs = require("fs");

let xlsx = null;
try {
  xlsx = require("xlsx");
} catch (_) {
  console.warn(
    "[UOMCatalog] Paquete 'xlsx' no instalado; se usara solo el catalogo estatico."
  );
}

const DEFAULT_UOM_FILES = [
  "Unit Of Measure catalog.xlsx",
  "Unit Of Measure Feb24.xlsx",
];

const DISABLE_EXCEL =
  (process.env.UOM_CATALOG_DISABLE_EXCEL || "false").toLowerCase() === "true";
const CATALOG_SIGNATURE_TTL_MS = Number(
  process.env.CATALOG_SIGNATURE_TTL_MS || 1000
);

const STATIC_UOM = {
  EA: { description: "Each", decimals: 0 },
  PCS: { description: "Pieces", decimals: 0 },
  KG: { description: "Kilogram", decimals: 3 },
  LB: { description: "Pound", decimals: 3 },
  MT: { description: "Metric Ton", decimals: 3 },
  L: { description: "Liter", decimals: 3 },
  M: { description: "Meter", decimals: 3 },
  FT: { description: "Foot", decimals: 3 },
  PK: { description: "Pack", decimals: 0 },
};

let cache = null;

const resolveCatalogPath = () => {
  const envPath = process.env.UOM_CATALOG_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  for (const name of DEFAULT_UOM_FILES) {
    const candidate = path.join(__dirname, name);
    if (fs.existsSync(candidate)) return candidate;
  }

  return path.join(__dirname, DEFAULT_UOM_FILES[0]);
};

const normalizeName = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();

const getCatalogSignature = (filePath) => {
  const parts = [
    filePath || "",
    DISABLE_EXCEL ? "excel-disabled" : "excel-enabled",
    xlsx ? "xlsx-present" : "xlsx-missing",
  ];

  try {
    if (filePath && fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      parts.push(`${stats.size}:${stats.mtimeMs}`);
    } else {
      parts.push("missing");
    }
  } catch (error) {
    parts.push(`stat-error:${error.message}`);
  }

  return parts.join("|");
};

const buildUOMOptions = (codeToInfo) =>
  Array.from(codeToInfo.entries())
    .map(([code, info]) => ({
      code,
      description: info && info.description ? info.description : code,
      decimals: info && Number.isFinite(info.decimals) ? info.decimals : 0,
      label:
        info && info.description && info.description !== code
          ? `${code} - ${info.description}`
          : code,
    }))
    .sort((left, right) => left.code.localeCompare(right.code));

function loadUOMOnce() {
  const now = Date.now();
  if (
    cache &&
    Number.isFinite(cache.checkedAt) &&
    now - cache.checkedAt < CATALOG_SIGNATURE_TTL_MS
  ) {
    return cache;
  }

  const catalogPath = resolveCatalogPath();
  const signature = getCatalogSignature(catalogPath);
  if (cache && cache.signature === signature) {
    cache.checkedAt = now;
    return cache;
  }

  const codeToInfo = new Map(Object.entries(STATIC_UOM));
  const nameToCode = new Map(
    Object.entries(STATIC_UOM).map(([code, info]) => [
      normalizeName(info.description),
      code,
    ])
  );

  let sourceMsg = `[UOMCatalog] Usando catalogo estatico (${codeToInfo.size} UOM).`;

  try {
    if (!DISABLE_EXCEL && xlsx && fs.existsSync(catalogPath)) {
      const wb = xlsx.readFile(catalogPath);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });

      let added = 0;
      for (const row of rows) {
        const code = String(row.Code || row.CODE || "")
          .trim()
          .toUpperCase();
        const desc = String(row.Description || row.DESCRIPTION || "").trim();
        const decRaw = row.Decimals ?? row.DECIMALS ?? row.decimals ?? "";
        let decimals = 0;
        if (decRaw !== "") {
          const parsed = Number(decRaw);
          if (Number.isFinite(parsed)) decimals = parsed;
          else if (String(decRaw).trim().toLowerCase() === "yes") decimals = 3;
        }
        if (!code) continue;

        codeToInfo.set(code, { description: desc || code, decimals });
        if (desc) nameToCode.set(normalizeName(desc), code);
        added += 1;
      }

      sourceMsg = `[UOMCatalog] Catalogo estatico (${
        Object.keys(STATIC_UOM).length
      }) + Excel (${added}) desde ${catalogPath}`;
    } else {
      if (DISABLE_EXCEL) sourceMsg += " Lectura Excel desactivada por env.";
      else if (!xlsx) sourceMsg += " Paquete 'xlsx' no instalado.";
      else if (!fs.existsSync(catalogPath)) {
        sourceMsg += ` Excel no encontrado en ${catalogPath}`;
      }
    }
  } catch (error) {
    sourceMsg += ` (error leyendo Excel: ${error.message})`;
  }

  console.log(sourceMsg);
  cache = {
    codeToInfo,
    nameToCode,
    options: buildUOMOptions(codeToInfo),
    signature,
    checkedAt: now,
  };
  return cache;
}

function isValidUOMCode(code) {
  const { codeToInfo } = loadUOMOnce();
  return codeToInfo.has(
    String(code || "")
      .trim()
      .toUpperCase()
  );
}

function codeToDescription(code) {
  const { codeToInfo } = loadUOMOnce();
  const info = codeToInfo.get(
    String(code || "")
      .trim()
      .toUpperCase()
  );
  return info ? info.description : null;
}

function nameToUOMCode(name) {
  if (!name) return null;
  const { nameToCode } = loadUOMOnce();
  return nameToCode.get(normalizeName(name)) || null;
}

function getUOMDecimals(code) {
  const { codeToInfo } = loadUOMOnce();
  const info = codeToInfo.get(
    String(code || "")
      .trim()
      .toUpperCase()
  );
  return info ? info.decimals : 0;
}

function normalizeUOM(value) {
  if (value == null) return value;
  const raw = String(value).trim();
  if (raw === "") return raw;

  const up = raw.toUpperCase();
  if (isValidUOMCode(up)) return up;

  const byName = nameToUOMCode(raw);
  if (byName) return byName;

  const tokens = up.split(/[\s\/-]+/).filter(Boolean);
  for (const token of tokens) {
    if (isValidUOMCode(token)) return token;
    const byTokenName = nameToUOMCode(token);
    if (byTokenName) return byTokenName;
  }

  const compact = up.replace(/[^A-Z0-9]/g, "");
  if (isValidUOMCode(compact)) return compact;

  return up;
}

function getUOMOptions() {
  const { options } = loadUOMOnce();
  return options.map((option) => ({ ...option }));
}

module.exports = {
  loadUOMOnce,
  isValidUOMCode,
  codeToDescription,
  nameToUOMCode,
  getUOMDecimals,
  normalizeUOM,
  getUOMOptions,
};
