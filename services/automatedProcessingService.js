// services/automatedProcessingService.js
const fs = require("fs/promises");
const path = require("path");
const { fork } = require("child_process");
const fileConversionService = require("./fileConversionService");
const sftpService = require("./sftpService");
const conversionJobRepository = require("../repositories/conversionJobRepository");
const { getDocumentTypeByPrefix } = require("../data/documentTypeRegistry");
const { detectDocumentType } = require("../utils/documentDetector");
const { getDefaultFormat } = require("../utils/documentFormatRules");

const INPUT_DIR =
  process.env.SFTP_LOCAL_INPUT_DIR ||
  path.join(__dirname, "..", "sftp_input_watch");
const PROCESSED_DIR =
  process.env.SFTP_LOCAL_PROCESSED_DIR ||
  path.join(__dirname, "..", "sftp_processed");
const FAILED_DIR =
  process.env.SFTP_LOCAL_FAILED_DIR ||
  path.join(__dirname, "..", "sftp_failed");
const TEMP_OUTPUT_DIR = path.join(__dirname, "..", "temp_converted_files");
const TEMP_ERROR_DIR = path.join(__dirname, "..", "temp_error_reports");
const WORKER_PATH = path.join(
  __dirname,
  "..",
  "workers",
  "automatedFileWorker.js",
);
const WORKER_TIMEOUT_MINUTES = Number.parseInt(
  process.env.WORKER_TIMEOUT_MINUTES || "30",
  10,
);
const WORKER_TIMEOUT_MS =
  Number.isFinite(WORKER_TIMEOUT_MINUTES) && WORKER_TIMEOUT_MINUTES > 0
    ? WORKER_TIMEOUT_MINUTES * 60 * 1000
    : null;

let activeWorker = null;

const handleWorkerTimeout = async (filePath, fileName) => {
  const displayName = fileName || path.basename(filePath);
  console.error(
    `[Automated Service] Worker timeout after ${WORKER_TIMEOUT_MINUTES} minutes for ${displayName}.`,
  );

  try {
    await fs.access(filePath, fs.constants.F_OK);
    const targetPath = path.join(FAILED_DIR, displayName);
    await fs.rename(filePath, targetPath);
    console.log(
      `[Automated Service] Moved timed out file ${displayName} to ${FAILED_DIR}`,
    );
  } catch {
    // The file may already have been moved or removed.
  }

  try {
    const latestJob =
      await conversionJobRepository.getLatestAutomatedJobByFileName(displayName);
    if (latestJob?._id) {
      await conversionJobRepository.updateConversionJobStatus(
        latestJob._id,
        "failed",
        {
          errorMessage: `Worker timeout after ${WORKER_TIMEOUT_MINUTES} minutes`,
        },
      );
    }
  } catch (err) {
    console.error(
      `[Automated Service] Failed to update job status after timeout for ${displayName}:`,
      err,
    );
  }
};

const spawnWorkerForFile = (filePath, fileName) => {
  if (activeWorker) return false;

  const displayName = fileName || path.basename(filePath);
  console.log(`[Automated Service] Spawning worker for: ${displayName}`);

  let timeoutHandle = null;

  const worker = fork(WORKER_PATH, [filePath], {
    env: { ...process.env },
    stdio: "inherit",
  });
  activeWorker = worker;

  worker.on("exit", (code, signal) => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    console.log(
      `[Automated Service] Worker finished ${displayName} (code=${code}, signal=${signal || "none"})`,
    );
    if (activeWorker === worker) {
      activeWorker = null;
    }
  });

  worker.on("error", (err) => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    console.error(`[Automated Service] Worker error for ${displayName}:`, err);
    if (activeWorker === worker) {
      activeWorker = null;
    }
  });

  if (WORKER_TIMEOUT_MS) {
    timeoutHandle = setTimeout(() => {
      if (activeWorker !== worker) return;
      try {
        worker.kill("SIGKILL");
      } catch {}
      activeWorker = null;
      handleWorkerTimeout(filePath, displayName).catch(() => {});
    }, WORKER_TIMEOUT_MS);
  }

  return true;
};

const ALLOW_UPLOAD_ON_VALIDATION_ERROR =
  (process.env.ALLOW_UPLOAD_ON_VALIDATION_ERROR || "false").toLowerCase() ===
  "true";

const ensureDirectoriesExist = async () => {
  await fs.mkdir(INPUT_DIR, { recursive: true });
  await fs.mkdir(PROCESSED_DIR, { recursive: true });
  await fs.mkdir(FAILED_DIR, { recursive: true });
  await fs.mkdir(path.join(__dirname, "..", "temp_uploads"), {
    recursive: true,
  });
  await fs.mkdir(TEMP_OUTPUT_DIR, { recursive: true });
  await fs.mkdir(TEMP_ERROR_DIR, { recursive: true });
  console.log(
    `[Automated Service] Ensured directories: ${INPUT_DIR}, ${PROCESSED_DIR}, ${FAILED_DIR}, ${path.join(
      __dirname,
      "..",
      "temp_uploads",
    )}, ${TEMP_OUTPUT_DIR}, ${TEMP_ERROR_DIR}`,
  );
};

const processSingleFile = async ({
  filePath,
  originalName = path.basename(filePath),
  readPath = filePath,
}) => {
  let documentType = null;
  let fileBuffer;
  let newJob = null;
  let convertedFilePath = null;
  let errorReportPath = null;

  try {
    fileBuffer = await fs.readFile(readPath);

    documentType = await detectDocumentType(fileBuffer, originalName);
    if (documentType) {
      console.log(
        `[Automated Service] Detected document type via content analysis: "${documentType}"`,
      );
    } else {
      console.log(
        "[Automated Service] Content detection failed or was inconclusive. Falling back to filename prefix.",
      );
      const filePrefix = originalName.substring(0, 2).toUpperCase();
      const registryEntry = getDocumentTypeByPrefix(filePrefix);
      if (registryEntry) {
        documentType = registryEntry.docType;
        console.log(
          `[Automated Service] Resolved prefix "${filePrefix}" to documentType "${documentType}"`,
        );
      }
    }

    if (!documentType) {
      console.warn(
        `[Automated Service] Could not determine document type for file: ${originalName}. Skipping.`,
      );
      const newPath = path.join(FAILED_DIR, originalName);
      await fs.rename(filePath, newPath);
      console.log(
        `[Automated Service] Moved unknown file type ${originalName} to ${FAILED_DIR}`,
      );
      return;
    }

    const outputFormat = getDefaultFormat(documentType) || "txt";
    const conversionOptions = { documentType };

    console.log(`[Automated Service] Processing file: ${originalName}`);

    newJob = await conversionJobRepository.createConversionJob({
      userId: null,
      fileName: originalName,
      originalFilePath: filePath,
      outputFormat,
      conversionOptions,
      status: "processing",
      isAutomated: true,
    });

    const previousJob =
      await conversionJobRepository.getLatestAutomatedJobByFileNameAndDocType(
        originalName,
        documentType,
      );
    const previousRemotePath = previousJob?.remoteConvertedPath || null;

    const processingResult =
      await fileConversionService.processFileForConversion(
        fileBuffer,
        originalName,
        outputFormat,
        conversionOptions,
        null,
        true,
      );

    convertedFilePath = processingResult.convertedFilePath;
    errorReportPath = processingResult.errorReportPath;
    const jobStatus = processingResult.status;

    console.log(
      `[Automated Service] Job result for ${originalName} -> status=${jobStatus}, convertedFilePath=${
        convertedFilePath || "null"
      }, errorReportPath=${errorReportPath || "null"}`,
    );

    const sftpRemoteUploadDir =
      process.env.SFTP_REMOTE_UPLOAD_DIR || "/converted_files";
    const sftpRemoteErrorDir =
      process.env.SFTP_REMOTE_ERROR_DIR || "/error_reports";

    const fileExists = async (candidatePath) => {
      try {
        await fs.access(candidatePath, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    };

    const toPosix = (candidatePath) => candidatePath.replace(/\\/g, "/");
    const uploads = [];

    const hasErrors = jobStatus !== "completed";
    const canUploadTxt =
      !hasErrors || (hasErrors && ALLOW_UPLOAD_ON_VALIDATION_ERROR);

    let remoteConvertedPath = null;
    let remoteErrorPath = null;

    if (
      canUploadTxt &&
      convertedFilePath &&
      (await fileExists(convertedFilePath))
    ) {
      const remoteBase = path
        .basename(convertedFilePath)
        .replace(/\.txt$/i, "");
      remoteConvertedPath = toPosix(
        path.join(sftpRemoteUploadDir, remoteBase),
      );
      uploads.push({
        local: convertedFilePath,
        remote: remoteConvertedPath,
      });
    }

    if (errorReportPath && (await fileExists(errorReportPath))) {
      remoteErrorPath = toPosix(
        path.join(sftpRemoteErrorDir, path.basename(errorReportPath)),
      );
      uploads.push({
        local: errorReportPath,
        remote: remoteErrorPath,
      });
    }

    if (uploads.length) {
      const uploadResults = await sftpService.uploadFilesViaSftp(uploads);
      const convertedUpload = uploadResults.find(
        (result) => result.local === convertedFilePath,
      );
      const errorUpload = uploadResults.find(
        (result) => result.local === errorReportPath,
      );
      if (convertedUpload) remoteConvertedPath = convertedUpload.remote;
      if (errorUpload) remoteErrorPath = errorUpload.remote;

      if (
        previousRemotePath &&
        remoteConvertedPath &&
        previousRemotePath !== remoteConvertedPath
      ) {
        await sftpService.deleteRemoteFile(previousRemotePath);
      }
    } else {
      console.log(
        "[SFTP] No files queued for upload (no TXT permitido/creado y/o no hubo reporte de error).",
      );
    }

    await conversionJobRepository.updateConversionJobStatus(
      newJob._id,
      jobStatus,
      {
        convertedFilePath,
        errorReportPath,
        remoteConvertedPath,
        remoteErrorPath,
        completedAt: new Date(),
      },
    );

    const tryUnlink = async (candidatePath) => {
      if (!candidatePath) return;
      try {
        await fs.unlink(candidatePath);
      } catch (err) {
        console.error(
          `[Automated Service] Error deleting local file ${candidatePath}:`,
          err,
        );
      }
    };
    await tryUnlink(convertedFilePath);
    await tryUnlink(errorReportPath);

    const succeeded = jobStatus === "completed";
    const targetDir = succeeded ? PROCESSED_DIR : FAILED_DIR;

    const newPath = path.join(targetDir, originalName);
    await fs.rename(filePath, newPath);
    console.log(
      `[Automated Service] Moved ${originalName} to ${targetDir} (status=${jobStatus})`,
    );
  } catch (error) {
    console.error(
      `[Automated Service] Error processing file ${originalName}:`,
      error,
    );
    try {
      const newPath = path.join(FAILED_DIR, originalName);
      await fs.rename(filePath, newPath);
      console.log(
        `[Automated Service] Moved failed file ${originalName} to ${FAILED_DIR}`,
      );
    } catch (moveErr) {
      console.error(
        `[Automated Service] Could not move failed file ${originalName} to ${FAILED_DIR}:`,
        moveErr,
      );
    }

    if (newJob && newJob._id) {
      await conversionJobRepository.updateConversionJobStatus(
        newJob._id,
        "failed",
        { errorMessage: error.message },
      );
    }

    try {
      if (convertedFilePath) {
        await fs.unlink(convertedFilePath).catch(() => {});
      }
      if (errorReportPath) {
        await fs.unlink(errorReportPath).catch(() => {});
      }
    } catch {}
  }
};

const processWatchedFiles = async () => {
  if (activeWorker) {
    console.log(
      "[Automated Service] Worker is still running. Skipping this tick.",
    );
    return;
  }

  console.log(`[Automated Service] Checking for new files in: ${INPUT_DIR}`);
  let files;
  try {
    files = await fs.readdir(INPUT_DIR);
    if (files.length === 0) {
      console.log("[Automated Service] No new files to process.");
      return;
    }
  } catch (readDirError) {
    console.error(
      `[Automated Service] Error reading input directory ${INPUT_DIR}:`,
      readDirError,
    );
    return;
  }

  const candidates = [];
  for (const fileName of files) {
    const filePath = path.join(INPUT_DIR, fileName);
    let stats;
    try {
      stats = await fs.stat(filePath);
    } catch (err) {
      console.warn(
        `[Automated Service] Could not stat ${fileName}, skipping.`,
        err,
      );
      continue;
    }
    if (
      !stats.isFile() ||
      fileName.startsWith(".") ||
      fileName.endsWith(".tmp") ||
      fileName.endsWith(".partial")
    ) {
      console.log(
        `[Automated Service] Skipping non-file/temp/partial entry: ${fileName}`,
      );
      continue;
    }
    candidates.push({ fileName, filePath, stats });
  }

  if (!candidates.length) {
    console.log("[Automated Service] No valid files to process.");
    return;
  }

  candidates.sort((a, b) => {
    const aTime = a.stats.birthtimeMs ?? a.stats.mtimeMs;
    const bTime = b.stats.birthtimeMs ?? b.stats.mtimeMs;
    if (aTime !== bTime) return aTime - bTime;
    return a.stats.mtimeMs - b.stats.mtimeMs;
  });

  const { fileName, filePath } = candidates[0];
  console.log(
    `[Automated Service] Queued files: ${candidates.length}. Processing oldest first: ${fileName}`,
  );

  spawnWorkerForFile(filePath, fileName);
};

module.exports = {
  processWatchedFiles,
  ensureDirectoriesExist,
  processSingleFile,
};
