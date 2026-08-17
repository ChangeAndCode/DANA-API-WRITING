const fs = require("fs/promises");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");

const resolveConfiguredPath = (configuredPath, fallbackName) =>
  path.resolve(configuredPath || path.join(PROJECT_ROOT, fallbackName));

const getRuntimeDirectories = () => [
  resolveConfiguredPath(null, "temp_uploads"),
  resolveConfiguredPath(null, "temp_converted_files"),
  resolveConfiguredPath(null, "temp_error_reports"),
  resolveConfiguredPath(process.env.MASTER_IMPORT_TEMP_DIR, "temp_master_imports"),
];

const ensureRuntimeDirectories = async () => {
  const directories = getRuntimeDirectories();
  await Promise.all(
    directories.map((directory) => fs.mkdir(directory, { recursive: true })),
  );
  return directories;
};

module.exports = { ensureRuntimeDirectories, getRuntimeDirectories };