const Client = require("ssh2-sftp-client");
const fs = require("fs");
const path = require("path");
const { VALID_SITES } = require("../data/siteConfig");
const { withTimeout } = require("../utils/promiseTimeout");

const DEFAULT_PORT = 22;
const DEFAULT_READY_TIMEOUT = 20000;
const DEFAULT_KEEPALIVE_INTERVAL = 10000;
const DEFAULT_KEEPALIVE_COUNT = 5;
const DEFAULT_MAX_CONNECTION_ATTEMPTS = 2;
const DEFAULT_OPERATION_TIMEOUT_MS = 30000;
const DEFAULT_CLOSE_TIMEOUT_MS = 3000;
const VALID_NAME_STRATEGIES = new Set([
  "overwrite",
  "none",
  "counter",
  "timestamp",
]);

const SITE_ENV_KEYS = Object.freeze({
  gaiim: Object.freeze({
    host: "SFTP_HOST",
    port: "SFTP_PORT",
    username: "SFTP_USERNAME",
    password: "SFTP_PASSWORD",
    privateKeyPath: "SFTP_PRIVATE_KEY_PATH",
    passphrase: "SFTP_PRIVATE_KEY_PASSPHRASE",
    remoteUploadDir: "SFTP_REMOTE_UPLOAD_DIR",
    remoteErrorDir: "SFTP_REMOTE_ERROR_DIR",
    nameStrategy: "SFTP_NAME_CONFLICT_STRATEGY",
    maxAttempts: "SFTP_MAX_CONNECTION_ATTEMPTS",
  }),
  p1a: Object.freeze({
    host: "SFTP_2_HOST",
    port: "SFTP_2_PORT",
    username: "SFTP_2_USERNAME",
    password: "SFTP_2_PASSWORD",
    privateKeyPath: "SFTP_2_PRIVATE_KEY_PATH",
    passphrase: "SFTP_2_PRIVATE_KEY_PASSPHRASE",
    remoteUploadDir: "SFTP_2_REMOTE_UPLOAD_DIR",
    remoteErrorDir: "SFTP_2_REMOTE_ERROR_DIR",
    nameStrategy: "SFTP_2_NAME_CONFLICT_STRATEGY",
    maxAttempts: "SFTP_2_MAX_CONNECTION_ATTEMPTS",
  }),
});

const createSftpError = (code, message, cause) => {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
};

const normalizeSite = (site) => {
  const normalized = String(site || "").trim().toLowerCase();
  return VALID_SITES.includes(normalized) ? normalized : "";
};

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeRemoteDirectory = (value) => {
  const normalized = String(value || "").trim().replace(/\\/g, "/");
  return normalized ? path.posix.normalize(normalized) : "";
};

const getSiteConfiguration = (site, env = process.env) => {
  const normalizedSite = normalizeSite(site);
  const keys = SITE_ENV_KEYS[normalizedSite];

  if (!keys) {
    throw createSftpError(
      "SFTP_SITE_INVALID",
      "La sede SFTP solicitada no es valida.",
    );
  }

  const rawStrategy = String(
    env[keys.nameStrategy] || env.SFTP_NAME_CONFLICT_STRATEGY || "overwrite",
  )
    .trim()
    .toLowerCase();

  return {
    site: normalizedSite,
    host: String(env[keys.host] || "").trim(),
    port: parsePositiveInteger(env[keys.port], DEFAULT_PORT),
    username: String(env[keys.username] || "").trim(),
    password: env[keys.password] || "",
    privateKeyPath: String(env[keys.privateKeyPath] || "").trim(),
    passphrase: env[keys.passphrase] || "",
    remoteUploadDir: normalizeRemoteDirectory(env[keys.remoteUploadDir]),
    remoteErrorDir: normalizeRemoteDirectory(env[keys.remoteErrorDir]),
    nameStrategy: VALID_NAME_STRATEGIES.has(rawStrategy)
      ? rawStrategy
      : "overwrite",
    maxConnectionAttempts: Math.min(
      parsePositiveInteger(
        env[keys.maxAttempts],
        DEFAULT_MAX_CONNECTION_ATTEMPTS,
      ),
      5,
    ),
    operationTimeoutMs: parsePositiveInteger(
      env.SFTP_OPERATION_TIMEOUT_MS,
      DEFAULT_OPERATION_TIMEOUT_MS,
    ),
    closeTimeoutMs: parsePositiveInteger(
      env.SFTP_CLOSE_TIMEOUT_MS,
      DEFAULT_CLOSE_TIMEOUT_MS,
    ),
  };
};

const validateSiteConfiguration = (site, env = process.env) => {
  let config;
  try {
    config = getSiteConfiguration(site, env);
  } catch (error) {
    return {
      valid: false,
      site: normalizeSite(site),
      missing: ["site"],
      code: error.code || "SFTP_CONFIGURATION_INVALID",
    };
  }

  const missing = [];
  if (!config.host) missing.push("host");
  if (!config.username) missing.push("username");
  if (!config.password && !config.privateKeyPath) {
    missing.push("authentication");
  }
  if (!config.remoteUploadDir) missing.push("remoteUploadDir");
  if (!config.remoteErrorDir) missing.push("remoteErrorDir");

  return {
    valid: missing.length === 0,
    site: config.site,
    missing,
    code: missing.length ? "SFTP_CONFIGURATION_INCOMPLETE" : null,
  };
};

const requireSiteConfiguration = (site) => {
  const config = getSiteConfiguration(site);
  const validation = validateSiteConfiguration(site);

  if (!validation.valid) {
    throw createSftpError(
      validation.code,
      "La configuracion SFTP de la sede esta incompleta.",
    );
  }

  return config;
};

const readPrivateKey = (privateKeyPath) => {
  if (!privateKeyPath) return undefined;
  try {
    return fs.readFileSync(privateKeyPath);
  } catch (error) {
    throw createSftpError(
      "SFTP_PRIVATE_KEY_UNAVAILABLE",
      "No se pudo leer la llave privada configurada.",
      error,
    );
  }
};

const createConnectionOptions = (config) => ({
  host: config.host,
  port: config.port,
  username: config.username,
  password: config.password || undefined,
  privateKey: readPrivateKey(config.privateKeyPath),
  passphrase: config.passphrase || undefined,
  readyTimeout: DEFAULT_READY_TIMEOUT,
  keepaliveInterval: DEFAULT_KEEPALIVE_INTERVAL,
  keepaliveCountMax: DEFAULT_KEEPALIVE_COUNT,
});

const splitExtension = (fileName) => {
  const extensionIndex = fileName.lastIndexOf(".");
  if (extensionIndex <= 0) return { name: fileName, extension: "" };
  return {
    name: fileName.slice(0, extensionIndex),
    extension: fileName.slice(extensionIndex),
  };
};

const sanitizeRemoteFileName = (value) => {
  const baseName = path.posix.basename(
    String(value || "archivo")
      .replace(/\\/g, "/")
      .replace(/[<>:"|?*\u0000-\u001f]/g, "_"),
  );
  return baseName.trim() || "archivo";
};

const safeExists = async (client, remotePath) => {
  try {
    return Boolean(await client.exists(remotePath));
  } catch {
    return false;
  }
};

const resolveRemotePath = async (
  client,
  remotePath,
  nameStrategy,
) => {
  if (!(await safeExists(client, remotePath))) return remotePath;
  if (nameStrategy === "overwrite" || nameStrategy === "none") {
    return remotePath;
  }

  const directory = path.posix.dirname(remotePath);
  const baseName = path.posix.basename(remotePath);
  const { name, extension } = splitExtension(baseName);

  if (nameStrategy === "counter") {
    let counter = 1;
    while (counter <= 9999) {
      const candidate = path.posix.join(
        directory,
        name + "_v" + String(counter).padStart(2, "0") + extension,
      );
      if (!(await safeExists(client, candidate))) return candidate;
      counter += 1;
    }
    throw createSftpError(
      "SFTP_REMOTE_NAME_EXHAUSTED",
      "No se pudo generar un nombre remoto disponible.",
    );
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  let counter = 0;
  while (counter <= 9999) {
    const suffix = counter ? "_" + counter : "";
    const candidate = path.posix.join(
      directory,
      name + "." + timestamp + suffix + extension,
    );
    if (!(await safeExists(client, candidate))) return candidate;
    counter += 1;
  }

  throw createSftpError(
    "SFTP_REMOTE_NAME_EXHAUSTED",
    "No se pudo generar un nombre remoto disponible.",
  );
};

const getErrorText = (error) =>
  String((error && (error.code || error.message)) || "").toUpperCase();

const isTransientConnectionError = (error) => {
  const text = getErrorText(error);
  return /ECONNRESET|ECONNREFUSED|ETIMEDOUT|TIMED OUT|SFTP_CONNECTION_TIMEOUT|SOCKET CLOSED|CONNECTION LOST/.test(
    text,
  );
};

const createSftpClient = (name = "site-sftp") =>
  new Client(name, {
    error: (error) => {
      if (getErrorText(error).includes("ECONNRESET")) {
        console.info(
          "[SFTP] Conexión cerrada por el servidor después de completar la operación.",
        );
        return;
      }
      console.error("[SFTP] Error de conexión no controlado.", {
        code: error?.code || "SFTP_ERROR",
        message: error?.message || "Error desconocido.",
      });
    },
    end: () => {},
    close: () => {},
  });

const terminateClient = (client) => {
  try {
    client?.client?.end();
  } catch {
    // Ending a stuck socket is best effort.
  }
};

const closeClient = async (client, timeoutMs) => {
  try {
    await withTimeout(client.end(), timeoutMs, {
      code: "SFTP_CLOSE_TIMEOUT",
      message: "SFTP connection close timed out.",
      onTimeout: () => terminateClient(client),
    });
  } catch {
    terminateClient(client);
    // Closing errors must never hide the transfer result or original error.
  }
};

const runWithConnectionRetries = async (config, operation) => {
  let lastError;

  for (
    let attempt = 1;
    attempt <= config.maxConnectionAttempts;
    attempt += 1
  ) {
    const client = createSftpClient(`site-sftp-${config.site}`);
    let stage = "connect";

    try {
      await withTimeout(
        client.connect(createConnectionOptions(config)),
        Math.min(DEFAULT_READY_TIMEOUT, config.operationTimeoutMs),
        {
          code: "SFTP_CONNECTION_TIMEOUT",
          message: "SFTP connection timed out.",
          onTimeout: () => terminateClient(client),
        },
      );
      stage = "operation";
      const result = await withTimeout(
        operation(client, config),
        config.operationTimeoutMs,
        {
          code: "SFTP_OPERATION_TIMEOUT",
          message: "SFTP operation timed out.",
          onTimeout: () => terminateClient(client),
        },
      );
      await closeClient(client, config.closeTimeoutMs);
      return { ...result, connectionAttempts: attempt };
    } catch (error) {
      lastError = error;
      await closeClient(client, config.closeTimeoutMs);

      const canRetry =
        stage === "connect" &&
        attempt < config.maxConnectionAttempts &&
        isTransientConnectionError(error);

      if (!canRetry) {
        error.sftpStage = stage;
        error.connectionAttempts = attempt;
        throw error;
      }
    }
  }

  throw lastError;
};

const testSiteConnection = async (site) => {
  const config = requireSiteConfiguration(site);
  return runWithConnectionRetries(config, async (client) => {
    const [remoteDirectoryExists, remoteErrorDirectoryExists] =
      await Promise.all([
        safeExists(client, config.remoteUploadDir),
        safeExists(client, config.remoteErrorDir),
      ]);

    if (!remoteDirectoryExists || !remoteErrorDirectoryExists) {
      throw createSftpError(
        "SFTP_REMOTE_DIRECTORY_UNAVAILABLE",
        "Una carpeta remota SFTP configurada no esta disponible.",
      );
    }

    return {
      site: config.site,
      remoteDirectoryExists,
      remoteErrorDirectoryExists,
    };
  });
};

const uploadFileToDirectoryForSite = async ({
  site,
  localPath,
  fileName,
  directoryKey,
}) => {
  if (!localPath) {
    throw createSftpError(
      "SFTP_LOCAL_FILE_REQUIRED",
      "No se proporciono un archivo para enviar.",
    );
  }

  const config = requireSiteConfiguration(site);
  const remoteDirectory = config[directoryKey];
  const safeFileName = sanitizeRemoteFileName(fileName);
  const requestedRemotePath = path.posix.join(
    remoteDirectory,
    safeFileName,
  );

  return runWithConnectionRetries(config, async (client) => {
    const remoteDirectoryExists = await client.exists(remoteDirectory);
    if (!remoteDirectoryExists) {
      await client.mkdir(remoteDirectory, true);
    }
    const finalRemotePath = await resolveRemotePath(
      client,
      requestedRemotePath,
      config.nameStrategy,
    );
    await client.put(localPath, finalRemotePath);

    return {
      site: config.site,
      remotePath: finalRemotePath,
      remoteFileName: path.posix.basename(finalRemotePath),
    };
  });
};

const uploadFileForSite = (options) =>
  uploadFileToDirectoryForSite({
    ...options,
    directoryKey: "remoteUploadDir",
  });

const uploadErrorFileForSite = (options) =>
  uploadFileToDirectoryForSite({
    ...options,
    directoryKey: "remoteErrorDir",
  });

const deleteRemoteFileForSite = async ({ site, remotePath }) => {
  if (!remotePath) return { deleted: false };
  const config = requireSiteConfiguration(site);

  return runWithConnectionRetries(config, async (client) => {
    if (!(await safeExists(client, remotePath))) {
      return { site: config.site, deleted: false };
    }
    await client.delete(remotePath);
    return { site: config.site, deleted: true };
  });
};

const sanitizeSftpError = (error) => {
  const text = getErrorText(error);

  if (
    error?.code === "SFTP_CONFIGURATION_INCOMPLETE" ||
    error?.code === "SFTP_SITE_INVALID"
  ) {
    return {
      code: error.code,
      message: "La configuracion SFTP de la sede esta incompleta.",
    };
  }
  if (error?.code === "SFTP_REMOTE_DIRECTORY_UNAVAILABLE") {
    return {
      code: error.code,
      message: "Una carpeta remota SFTP configurada no esta disponible.",
    };
  }
  if (error?.code === "SFTP_PRIVATE_KEY_UNAVAILABLE") {
    return {
      code: error.code,
      message: "La llave privada SFTP configurada no esta disponible.",
    };
  }
  if (/AUTH|AUTHENTICATION|ALL CONFIGURED AUTHENTICATION METHODS FAILED/.test(text)) {
    return {
      code: "SFTP_AUTHENTICATION_FAILED",
      message: "No se pudo autenticar con el servidor SFTP.",
    };
  }
  if (error?.code === "SFTP_CONNECTION_TIMEOUT") {
    return {
      code: error.code,
      message: "El servidor SFTP no respondio dentro del tiempo esperado.",
    };
  }
  if (error?.code === "SFTP_OPERATION_TIMEOUT") {
    return {
      code: error.code,
      message: "La operacion SFTP excedio el tiempo maximo permitido.",
    };
  }
  if (/ETIMEDOUT|TIMED OUT/.test(text)) {
    return {
      code: "SFTP_CONNECTION_TIMEOUT",
      message: "El servidor SFTP no respondio dentro del tiempo esperado.",
    };
  }
  if (/ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ECONNRESET|SOCKET CLOSED/.test(text)) {
    return {
      code: "SFTP_CONNECTION_FAILED",
      message: "No se pudo establecer la conexion con el servidor SFTP.",
    };
  }
  if (/PERMISSION DENIED|EACCES|FORBIDDEN/.test(text)) {
    return {
      code: "SFTP_PERMISSION_DENIED",
      message: "El servidor SFTP rechazo la operacion solicitada.",
    };
  }

  return {
    code: "SFTP_OPERATION_FAILED",
    message: "No se pudo completar la operacion SFTP.",
  };
};

module.exports = {
  deleteRemoteFileForSite,
  getSiteConfiguration,
  sanitizeRemoteFileName,
  sanitizeSftpError,
  testSiteConnection,
  uploadErrorFileForSite,
  uploadFileForSite,
  validateSiteConfiguration,
};
