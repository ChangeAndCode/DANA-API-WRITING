const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const {
  pathToFileURL,
} = require("url");

const {
  execFile,
} = require("child_process");

const CONVERT_OUT_DIR =
  process.env.XLS_CONVERT_OUT_DIR ||
  path.join(
    __dirname,
    "..",
    "temp_uploads",
  );

const CONVERT_TIMEOUT_MS =
  Number.parseInt(
    process.env
      .XLS_CONVERT_TIMEOUT_MS ||
      "600000",
    10,
  );

const execFileAsync = (
  command,
  args,
  options,
) => {
  return new Promise(
    (resolve, reject) => {
      execFile(
        command,
        args,
        options,
        (
          error,
          stdout,
          stderr,
        ) => {
          if (error) {
            error.stdout = stdout;
            error.stderr = stderr;
            reject(error);
            return;
          }

          resolve({
            stdout,
            stderr,
          });
        },
      );
    },
  );
};

const ensureDir = async (
  directoryPath,
) => {
  await fs.mkdir(
    directoryPath,
    {
      recursive: true,
    },
  );
};

const getSofficeCandidates = () => {
  const configuredBinary =
    String(
      process.env.SOFFICE_BIN ||
      "",
    ).trim();

  const candidates = [
    configuredBinary,
    "soffice",
    "libreoffice",
  ];

  if (
    process.platform === "win32"
  ) {
    candidates.push(
      "C:\\Program Files\\LibreOffice\\program\\soffice.com",
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    );
  }

  return [
    ...new Set(
      candidates.filter(Boolean),
    ),
  ];
};

const findConvertedOutput =
  async (possiblePaths) => {
    for (
      const possiblePath
      of possiblePaths
    ) {
      try {
        await fs.access(
          possiblePath,
        );

        return possiblePath;
      } catch {
        // Probamos la siguiente variante.
      }
    }

    return "";
  };

const convertXlsToXlsx =
  async (inputPath) => {
    await ensureDir(
      CONVERT_OUT_DIR,
    );

    const baseName =
      path.parse(inputPath).name;

    const outputPath =
      path.join(
        CONVERT_OUT_DIR,
        `${baseName}.xlsx`,
      );

    const outputPathUpper =
      path.join(
        CONVERT_OUT_DIR,
        `${baseName}.XLSX`,
      );

    /*
     * Evita confundir una conversión nueva
     * con un archivo temporal anterior.
     */
    await fs.unlink(
      outputPath,
    ).catch(() => {});

    await fs.unlink(
      outputPathUpper,
    ).catch(() => {});

    /*
     * Cada conversión usa su propio perfil.
     * Esto permite convertir aunque el usuario
     * tenga LibreOffice abierto.
     */
    const profileDirectory =
      await fs.mkdtemp(
        path.join(
          os.tmpdir(),
          "dana-libreoffice-",
        ),
      );

    const profileUrl =
      pathToFileURL(
        profileDirectory,
      ).href;

    const args = [
      `-env:UserInstallation=${profileUrl}`,
      "--headless",
      "--nologo",
      "--nodefault",
      "--nofirststartwizard",
      "--convert-to",
      "xlsx",
      "--outdir",
      CONVERT_OUT_DIR,
      inputPath,
    ];

    let lastError = null;

    try {
      for (
        const command
        of getSofficeCandidates()
      ) {
        try {
          await execFileAsync(
            command,
            args,
            {
              timeout:
                CONVERT_TIMEOUT_MS,

              windowsHide: true,
            },
          );

          const convertedPath =
            await findConvertedOutput(
              [
                outputPath,
                outputPathUpper,
              ],
            );

          if (convertedPath) {
            return convertedPath;
          }

          lastError =
            new Error(
              "LibreOffice terminó sin generar el archivo .xlsx.",
            );
        } catch (error) {
          lastError = error;
        }
      }
    } finally {
      await fs.rm(
        profileDirectory,
        {
          recursive: true,
          force: true,
        },
      ).catch(() => {});
    }

    const conversionError =
      new Error(
        "No fue posible convertir el archivo .xls a .xlsx. " +
        (
          lastError?.message ||
          "LibreOffice no está disponible."
        ),
      );

    conversionError.code =
      "XLS_CONVERSION_FAILED";

    conversionError.statusCode = 422;

    throw conversionError;
  };

const convertXlsBufferToXlsx =
  async (fileBuffer) => {
    if (
      !Buffer.isBuffer(
        fileBuffer,
      ) ||
      fileBuffer.length === 0
    ) {
      const bufferError =
        new Error(
          "El archivo .xls está vacío.",
        );

      bufferError.code =
        "XLS_BUFFER_INVALID";

      bufferError.statusCode = 400;

      throw bufferError;
    }

    await ensureDir(
      CONVERT_OUT_DIR,
    );

    const temporaryId =
      crypto.randomUUID();

    const inputPath =
      path.join(
        CONVERT_OUT_DIR,
        `${temporaryId}.xls`,
      );

    const possibleOutputPaths = [
      path.join(
        CONVERT_OUT_DIR,
        `${temporaryId}.xlsx`,
      ),
      path.join(
        CONVERT_OUT_DIR,
        `${temporaryId}.XLSX`,
      ),
    ];

    let convertedPath = "";

    try {
      await fs.writeFile(
        inputPath,
        fileBuffer,
      );

      convertedPath =
        await convertXlsToXlsx(
          inputPath,
        );

      return await fs.readFile(
        convertedPath,
      );
    } finally {
      await fs.unlink(
        inputPath,
      ).catch(() => {});

      for (
        const possibleOutputPath
        of possibleOutputPaths
      ) {
        await fs.unlink(
          possibleOutputPath,
        ).catch(() => {});
      }

      if (
        convertedPath &&
        !possibleOutputPaths.includes(
          convertedPath,
        )
      ) {
        await fs.unlink(
          convertedPath,
        ).catch(() => {});
      }
    }
  };

module.exports = {
  convertXlsToXlsx,
  convertXlsBufferToXlsx,
  ensureDir,
};
