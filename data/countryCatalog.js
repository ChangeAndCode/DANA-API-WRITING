// data/countryCatalog.js
const path = require("path");
const fs = require("fs");

let xlsx = null;
try {
  xlsx = require("xlsx");
} catch (_) {
  console.warn(
    "[CountryCatalog] Paquete 'xlsx' no instalado; se usara solo el catalogo estatico."
  );
}

const DEFAULT_COUNTRY_FILES = [
  "Country_of_Origin_catalog.xlsx",
  "Country of Origin catalog.xlsx",
];

const DISABLE_EXCEL =
  (process.env.COUNTRY_CATALOG_DISABLE_EXCEL || "false").toLowerCase() ===
  "true";
const CATALOG_SIGNATURE_TTL_MS = Number(
  process.env.CATALOG_SIGNATURE_TTL_MS || 1000
);

let cache = null;

const COUNTRY_BY_CODE = {
  AD: "ANDORRA",
  AE: "EMIRATOS ARABES UNIDOS",
  AF: "AFGANISTAN",
  AG: "ANTIGUA Y BARBUDA",
  AI: "ANGUILA",
  AL: "ALBANIA",
  AM: "ARMENIA",
  AN: "ANTILLAS HOLANDESAS",
  AO: "ANGOLA",
  AQ: "ANTARTIDA",
  AR: "ARGENTINA",
  AS: "SAMOA AMERICANA",
  AT: "AUSTRIA",
  AU: "AUSTRALIA",
  AW: "ARUBA",
  AX: "ALAND, ISLAS",
  AZ: "AZERBAIYAN",
  BA: "BOSNIA Y HERZEGOVINA",
  BB: "BARBADOS",
  BD: "BANGLADESH",
  BE: "BELGICA",
  BF: "BURKINA FASO",
  BG: "BULGARIA",
  BH: "BAHREIN",
  BI: "BURUNDI",
  BJ: "BENIN",
  BL: "SAN BARTOLOME",
  BM: "BERMUDAS",
  BN: "BRUNEI",
  BO: "BOLIVIA, ESTADO PLURINACIONAL DE",
  BQ: "BONAIRE, SAN EUSTAQUIO Y SABA",
  BR: "BRASIL",
  BS: "BAHAMAS",
  BT: "BHUTAN",
  BV: "BOUVET, ISLA",
  BW: "BOTSWANA",
  BY: "BELARUS",
  BZ: "BELICE",
  CA: "CANADA",
  CC: "COCOS (KEELING), ISLAS",
  CD: "CONGO, LA REPUBLICA DEMOCRATICA DEL",
  CF: "AFRICA CENTRAL, REPUBLICA DE",
  CG: "CONGO",
  CH: "SUIZA",
  CI: "COSTA DE MARFIL",
  CK: "COOK, ISLAS",
  CL: "CHILE",
  CM: "CAMERUN",
  CN: "CHINA",
  CO: "COLOMBIA",
  CR: "COSTA RICA",
  CU: "CUBA",
  CV: "CABO VERDE",
  CW: "CURACAO",
  CX: "NAVIDAD, ISLA",
  CY: "CHIPRE",
  CZ: "REPUBLICA CHECA",
  DE: "ALEMANIA",
  DJ: "DJIBOUTI",
  DK: "DINAMARCA",
  DM: "DOMINICA",
  DO: "REPUBLICA DOMINICANA",
  DZ: "ARGELIA",
  EC: "ECUADOR",
  EE: "ESTONIA",
  EG: "EGIPTO",
  EH: "SAHARA OCCIDENTAL",
  ER: "ERITREA",
  ES: "ESPANA",
  ET: "ETIOPIA",
  FI: "FINLANDIA",
  FJ: "FIYI",
  FK: "MALVINAS, ISLAS (FALKLAND)",
  FM: "MICRONESIA, ESTADOS FEDERADOS DE",
  FO: "FEROE, ISLAS",
  FR: "FRANCIA",
  GA: "GABON",
  GB: "REINO UNIDO",
  GD: "GRANADA",
  GE: "GEORGIA",
  GF: "GUAYANA FRANCESA",
  GG: "GUERNSEY",
  GH: "GHANA",
  GI: "GIBRALTAR",
  GL: "GROENLANDIA",
  GM: "GAMBIA",
  GN: "GUINEA",
  GP: "GUADELUPE",
  GQ: "GUINEA ECUATORIAL",
  GR: "GRECIA",
  GS: "GEORGIA DEL SUR E ISLAS SANDWICH DEL SUR",
  GT: "GUATEMALA",
  GU: "GUAM",
  GW: "GUINEA-BISSAU",
  GY: "GUYANA",
  HK: "HONG KONG",
  HM: "HEARD Y MCDONALD, ISLAS",
  HN: "HONDURAS",
  HR: "CROACIA",
  HT: "HAITI",
  HU: "HUNGRIA",
  ID: "INDONESIA",
  IE: "IRLANDA",
  IL: "ISRAEL",
  IM: "ISLA DE MAN",
  IN: "INDIA",
  IO: "TERRITORIO BRITANICO DEL OCEANO INDICO",
  IQ: "IRAQ",
  IR: "IRAN, REPUBLICA ISLAMICA DE",
  IS: "ISLANDIA",
  IT: "ITALIA",
  JE: "JERSEY",
  JM: "JAMAICA",
  JO: "JORDANIA",
  JP: "JAPON",
  KE: "KENIA",
  KG: "KIRGUISTAN",
  KH: "CAMBOYA",
  KI: "KIRIBATI",
  KM: "COMORAS",
  KN: "SAN CRISTOBAL Y NIEVES",
  KP: "COREA, REPUBLICA POPULAR DEMOCRATICA DE",
  KR: "COREA, REPUBLICA DE",
  KW: "KUWAIT",
  KY: "CAIMAN, ISLAS",
  KZ: "KAZAJSTAN",
  LA: "LAO, REPUBLICA DEMOCRATICA POPULAR",
  LB: "LIBANO",
  LC: "SANTA LUCIA",
  LI: "LIECHTENSTEIN",
  LK: "SRI LANKA",
  LR: "LIBERIA",
  LS: "LESOTHO",
  LT: "LITUANIA",
  LU: "LUXEMBURGO",
  LV: "LETONIA",
  LY: "LIBIA",
  MA: "MARRUECOS",
  MC: "MONACO",
  MD: "MOLDAVIA, REPUBLICA DE",
  ME: "MONTENEGRO",
  MF: "SAN MARTIN (PARTE FRANCESA)",
  MG: "MADAGASCAR",
  MH: "MARSHALL, ISLAS",
  MK: "MACEDONIA DEL NORTE",
  ML: "MALI",
  MM: "MYANMAR",
  MN: "MONGOLIA",
  MO: "MACAO",
  MP: "MARIANAS DEL NORTE, ISLAS",
  MQ: "MARTINICA",
  MR: "MAURITANIA",
  MS: "MONTSERRAT",
  MT: "MALTA",
  MU: "MAURICIO",
  MV: "MALDIVAS",
  MW: "MALAWI",
  MX: "MEXICO",
  MY: "MALASIA",
  MZ: "MOZAMBIQUE",
  NA: "NAMIBIA",
  NC: "NUEVA CALEDONIA",
  NE: "NIGER",
  NF: "NORFOLK, ISLA",
  NG: "NIGERIA",
  NI: "NICARAGUA",
  NL: "PAISES BAJOS",
  NO: "NORUEGA",
  NP: "NEPAL",
  NR: "NAURU",
  NU: "NIUE",
  NZ: "NUEVA ZELANDA",
  OM: "OMAN",
  PA: "PANAMA",
  PE: "PERU",
  PF: "POLINESIA FRANCESA",
  PG: "PAPUA NUEVA GUINEA",
  PH: "FILIPINAS",
  PK: "PAKISTAN",
  PL: "POLONIA",
  PM: "SAN PEDRO Y MIQUELON",
  PN: "PITCAIRN",
  PR: "PUERTO RICO",
  PS: "TERRITORIO PALESTINO OCUPADO",
  PT: "PORTUGAL",
  PW: "PALAU",
  PY: "PARAGUAY",
  QA: "QATAR",
  RE: "REUNION",
  RO: "RUMANIA",
  RS: "SERBIA",
  RU: "FEDERACION DE RUSIA",
  RW: "RUANDA",
  SA: "ARABIA SAUDITA",
  SB: "SALOMON, ISLAS",
  SC: "SEYCHELLES",
  SD: "SUDAN",
  SE: "SUECIA",
  SG: "SINGAPUR",
  SH: "SANTA ELENA, ASCENSION Y TRISTAN DE CUNHA",
  SI: "ESLOVENIA",
  SJ: "SVALBARD Y JAN MAYEN",
  SK: "ESLOVAQUIA",
  SL: "SIERRA LEONA",
  SM: "SAN MARINO",
  SN: "SENEGAL",
  SO: "SOMALIA",
  SR: "SURINAM",
  SS: "SUDAN DEL SUR",
  ST: "SANTO TOME Y PRINCIPE",
  SV: "EL SALVADOR",
  SX: "SINT MAARTEN (PARTE HOLANDESA)",
  SY: "REPUBLICA ARABE SIRIA",
  SZ: "ESWATINI",
  TC: "TURCAS Y CAICOS, ISLAS",
  TD: "CHAD",
  TF: "TERRITORIOS AUSTRALES FRANCESES",
  TG: "TOGO",
  TH: "TAILANDIA",
  TJ: "TAYIKISTAN",
  TK: "TOKELAU",
  TL: "TIMOR-LESTE",
  TM: "TURKMENISTAN",
  TN: "TUNEZ",
  TO: "TONGA",
  TR: "TURQUIA",
  TT: "TRINIDAD Y TOBAGO",
  TV: "TUVALU",
  TW: "TAIWAN, PROVINCIA DE CHINA",
  TZ: "TANZANIA, REPUBLICA UNIDA DE",
  UA: "UCRANIA",
  UG: "UGANDA",
  UM: "ISLAS MENORES ALEJADAS DE LOS ESTADOS UNIDOS",
  US: "ESTADOS UNIDOS",
  UY: "URUGUAY",
  UZ: "UZBEKISTAN",
  VA: "SANTA SEDE (CIUDAD DEL VATICANO)",
  VC: "SAN VICENTE Y LAS GRANADINAS",
  VE: "VENEZUELA, REPUBLICA BOLIVARIANA DE",
  VG: "ISLAS VIRGENES (BRITANICAS)",
  VI: "ISLAS VIRGENES (EE.UU.)",
  VN: "VIET NAM",
  VU: "VANUATU",
  WF: "WALLIS Y FUTUNA",
  WS: "SAMOA",
  YE: "YEMEN",
  YT: "MAYOTTE",
  ZA: "SUDAFRICA",
  ZM: "ZAMBIA",
  ZW: "ZIMBABWE",
};

const CODE_KEYS = [
  "CVE_PAIS",
  "CLAVE",
  "CODE",
  "ISO2",
  "ISO_2",
  "ISO ALPHA-2",
  "ALPHA2",
  "PAIS_COD",
  "CODIGO",
].map((value) => value.toUpperCase());

const NAME_KEYS = [
  "DESCRIP",
  "PAIS",
  "COUNTRY",
  "DESCRIPTION",
  "NAME",
  "NOMBRE",
  "DESCRIPCION",
].map((value) => value.toUpperCase());

const resolveCatalogPath = () => {
  const envPath = process.env.COUNTRY_CATALOG_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  for (const name of DEFAULT_COUNTRY_FILES) {
    const candidate = path.join(__dirname, name);
    if (fs.existsSync(candidate)) return candidate;
  }

  return path.join(__dirname, DEFAULT_COUNTRY_FILES[0]);
};

const pickColumn = (row, candidatesUpper) => {
  const keys = Object.keys(row);
  for (const key of keys) {
    if (candidatesUpper.includes(key.toUpperCase())) return key;
  }
  return null;
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

const buildCountryOptions = (codeToName) =>
  Array.from(codeToName.keys()).sort((left, right) => left.localeCompare(right));

function loadCatalogOnce() {
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

  const codeToName = new Map(Object.entries(COUNTRY_BY_CODE));
  const nameToCode = new Map(
    Object.entries(COUNTRY_BY_CODE).map(([code, name]) => [
      normalizeName(name),
      code,
    ])
  );

  let sourceMsg = `[CountryCatalog] Usando catalogo estatico (${codeToName.size} paises).`;

  try {
    if (!DISABLE_EXCEL && xlsx && fs.existsSync(catalogPath)) {
      const wb = xlsx.readFile(catalogPath);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });

      if (rows.length) {
        const codeKey = pickColumn(rows[0], CODE_KEYS);
        const nameKey = pickColumn(rows[0], NAME_KEYS);

        if (codeKey && nameKey) {
          let overrides = 0;
          for (const row of rows) {
            const code = String(row[codeKey] || "")
              .trim()
              .toUpperCase();
            const name = String(row[nameKey] || "").trim();
            if (!code) continue;

            codeToName.set(code, name);
            nameToCode.set(normalizeName(name), code);
            overrides += 1;
          }

          sourceMsg = `[CountryCatalog] Catalogo estatico (${
            Object.keys(COUNTRY_BY_CODE).length
          }) + Excel (${overrides} entradas) desde ${catalogPath}`;
        } else {
          sourceMsg += ` Excel encontrado pero sin columnas reconocibles en ${catalogPath}`;
        }
      } else {
        sourceMsg += ` Excel vacio en ${catalogPath}`;
      }
    } else if (DISABLE_EXCEL) {
      sourceMsg +=
        " Lectura de Excel desactivada por env (COUNTRY_CATALOG_DISABLE_EXCEL=true).";
    } else if (!xlsx) {
      sourceMsg += " Paquete 'xlsx' no instalado.";
    } else if (!fs.existsSync(catalogPath)) {
      sourceMsg += ` Excel no encontrado en ${catalogPath}`;
    }
  } catch (error) {
    sourceMsg += ` (no se pudo leer Excel: ${error.message})`;
  }

  console.log(sourceMsg);
  cache = {
    codeToName,
    nameToCode,
    options: buildCountryOptions(codeToName),
    signature,
    checkedAt: now,
  };
  return cache;
}

function isValidCountryCode(code) {
  const { codeToName } = loadCatalogOnce();
  return codeToName.has(
    String(code || "")
      .toUpperCase()
      .trim()
  );
}

function codeToNameFn(code) {
  const { codeToName } = loadCatalogOnce();
  return (
    codeToName.get(
      String(code || "")
        .toUpperCase()
        .trim()
    ) || null
  );
}

function nameToCodeFn(name) {
  if (!name) return null;
  const { nameToCode } = loadCatalogOnce();
  return nameToCode.get(normalizeName(name)) || null;
}

function getCountryOptions() {
  const { options } = loadCatalogOnce();
  return options.slice();
}

module.exports = {
  COUNTRY_BY_CODE,
  loadCatalogOnce,
  isValidCountryCode,
  codeToName: codeToNameFn,
  nameToCode: nameToCodeFn,
  getCountryOptions,
};
