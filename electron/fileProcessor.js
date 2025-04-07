// electron/fileProcessor.js
const fs = require("fs");
const path = require("path");
const log = require("electron-log");
const ignore = require("ignore");

// Import utilities and constants
const { countTokens } = require("./tokenUtils");
const {
  MAX_FILE_SIZE,
  PASTEMAX_DIR,
  PROMPT_OVERVIEW_FILENAME,
  PROMPT_SECTIONS,
} = require("../constants"); // Goes up one level
const {
  excludedFiles,
  binaryExtensions: userBinaryExtensions,
} = require("../excluded-files"); // Goes up one level
const {
  BINARY_EXTENSIONS: defaultBinaryExtensions,
} = require("./config/binaryExtensions");

// Combine default binary extensions with those from excluded-files.js
const ALL_BINARY_EXTENSIONS = [
  ...new Set([
    ...defaultBinaryExtensions,
    ...(Array.isArray(userBinaryExtensions) ? userBinaryExtensions : []),
  ]),
];
log.debug(
  `Combined list of ${ALL_BINARY_EXTENSIONS.length} binary extensions loaded.`
);

/**
 * Normalizes a file path to use forward slashes.
 * @param {string} filePath - The file path to normalize.
 * @returns {string} The normalized path.
 */
function normalizePath(filePath) {
  if (!filePath) return filePath;
  return filePath.replace(/\\/g, "/");
}

/**
 * Loads ignore rules from .gitignore and default patterns.
 * @param {string} rootDir - The root directory to look for .gitignore.
 * @returns {object} An ignore instance from the 'ignore' library.
 */
function loadGitignore(rootDir) {
  const ig = ignore();
  const gitignorePath = path.join(rootDir, ".gitignore");

  // Add standard git ignores first
  ig.add([".git"]);

  // Add patterns from excluded-files.js
  if (Array.isArray(excludedFiles)) {
    ig.add(excludedFiles);
  } else {
    log.warn("excludedFiles is not an array, skipping user exclusions.");
  }

  // Add rules from the project's .gitignore file, if it exists
  if (fs.existsSync(gitignorePath)) {
    try {
      const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
      ig.add(gitignoreContent);
      log.debug(`Loaded .gitignore rules from ${gitignorePath}`);
    } catch (err) {
      log.error(`Error reading .gitignore file at ${gitignorePath}:`, err);
    }
  } else {
    log.debug(`.gitignore not found in ${rootDir}`);
  }

  return ig;
}

/**
 * Checks if a file is likely binary based on its extension using the combined list.
 * @param {string} filePath - The path to the file.
 * @returns {boolean} True if the extension is in the binary list.
 */
function isBinaryFile(filePath) {
  const ext = path.extname(filePath || "").toLowerCase();
  return ALL_BINARY_EXTENSIONS.includes(ext);
}

/**
 * Recursively reads files and directories, applying ignore rules and processing files.
 * @param {string} dir - The current directory being scanned.
 * @param {string} rootDir - The root directory of the project.
 * @param {object} ignoreFilter - The ignore instance.
 * @param {object} eventSender - The IPC event sender to report progress/status (optional).
 * @returns {Array<object>} An array of FileData objects.
 */
function readFilesRecursively(dir, rootDir, ignoreFilter, eventSender) {
  let results = [];
  let scannedCount = 0;

  try {
    const dirents = fs.readdirSync(dir, { withFileTypes: true });

    for (const dirent of dirents) {
      const currentPath = path.join(dir, dirent.name);
      const normalizedFullPath = normalizePath(currentPath);
      const relativePath = normalizePath(path.relative(rootDir, currentPath));

      // Exclusion Check
      if (relativePath && ignoreFilter.ignores(relativePath)) {
        continue;
      }

      if (dirent.isDirectory()) {
        results = results.concat(
          readFilesRecursively(currentPath, rootDir, ignoreFilter, eventSender)
        );
      } else if (dirent.isFile()) {
        scannedCount++;
        // Process File
        let fileData = {
          name: dirent.name,
          path: normalizedFullPath,
          content: "",
          tokenCount: 0,
          size: 0,
          isBinary: false,
          isSkipped: false,
          error: null,
          fileKind: null,
          sectionId: null,
        };

        try {
          const stats = fs.statSync(currentPath);
          fileData.size = stats.size;

          if (fileData.size > MAX_FILE_SIZE) {
            fileData.isSkipped = true;
            fileData.error = `File size (${(
              fileData.size /
              1024 /
              1024
            ).toFixed(2)}MB) exceeds limit (${(
              MAX_FILE_SIZE /
              1024 /
              1024
            ).toFixed(0)}MB)`;
            log.warn(
              `Skipping large file: ${relativePath} (${fileData.error})`
            );
          } else if (isBinaryFile(currentPath)) {
            fileData.isBinary = true;
          } else {
            fileData.content = fs.readFileSync(currentPath, "utf8");
            fileData.tokenCount = countTokens(fileData.content);
          }

          // Identify Special Files & Assign sectionId
          const parentDirRelative = normalizePath(path.dirname(relativePath));

          if (parentDirRelative === PASTEMAX_DIR) {
            // No special sectionId assignment here anymore
            if (dirent.name === PROMPT_OVERVIEW_FILENAME) {
              fileData.fileKind = "regular"; // Keep as regular file
              // Allow sectionId to be determined by the fallback logic below
            } else {
              fileData.isSkipped = true;
              fileData.error =
                "Only prompt-overview is currently processed in .pastemax directory";
              fileData.fileKind = "regular"; // Keep regular
            }
            // No sectionId assignment here for prompt-overview
          }

          // Always assign fileKind and sectionId AFTER the PASTEMAX_DIR check (if not already assigned)
          if (fileData.fileKind === null) {
            fileData.fileKind = "regular";
          }

          // Assign sectionId if not already assigned
          if (fileData.sectionId === null) {
            let assignedSection = false;
            for (const section of PROMPT_SECTIONS) {
              // Check section.directory before using startsWith
              if (
                section.directory &&
                relativePath.startsWith(section.directory + "/")
              ) {
                fileData.sectionId = section.id;
                assignedSection = true;
                break;
              }
            }
            if (!assignedSection) {
              // Find the default section (directory: null)
              const defaultSection = PROMPT_SECTIONS.find(
                (s) => s.directory === null
              );
              fileData.sectionId = defaultSection
                ? defaultSection.id
                : "project_files";
            }
          }
        } catch (err) {
          log.error(`Error processing file ${currentPath}:`, err);
          fileData.isSkipped = true;
          fileData.error = `Could not process file: ${err.message}`;
        }

        // DEBUG LOGGING START
        if (fileData.path.includes(PROMPT_OVERVIEW_FILENAME)) {
          log.debug(
            `[FileProcessor] Data for ${PROMPT_OVERVIEW_FILENAME}:`,
            JSON.stringify(fileData, null, 2) // Log the whole object
          );
        }
        // DEBUG LOGGING END

        results.push(fileData);

        // Optional: Report progress
        if (eventSender && scannedCount > 0 && scannedCount % 100 === 0) {
          eventSender.send("file-processing-status", {
            status: "processing",
            message: `Scanned ${scannedCount} files...`,
          });
        }
      }
    }
  } catch (err) {
    log.error(`Error reading directory ${dir}:`, err);
    if (eventSender) {
      eventSender.send("file-processing-status", {
        status: "error",
        message: `Error reading directory ${path.basename(dir)}: ${
          err.message
        }`,
      });
    }
  }

  return results;
}

/**
 * Processes the file list for a given folder path.
 * Orchestrates reading, filtering, and processing.
 *
 * @param {string} folderPath - The absolute path to the folder to process.
 * @param {object} eventSender - The IPC event sender object (from ipcMain event).
 * @returns {Promise<Array<object>>} A promise that resolves with the array of processed FileData objects.
 */
async function processFileList(folderPath, eventSender) {
  log.info(`Starting file processing for folder: ${folderPath}`);
  const rootDir = normalizePath(folderPath);
  let ignoreFilter;

  eventSender.send("file-processing-status", {
    status: "processing",
    message: "Loading ignore rules...",
  });

  try {
    ignoreFilter = loadGitignore(rootDir);
  } catch (err) {
    log.error("Failed to load ignore rules:", err);
    eventSender.send("file-processing-status", {
      status: "error",
      message: `Failed to load ignore rules: ${err.message}`,
    });
    ignoreFilter = ignore(); // Fallback to dummy filter
    log.warn("Proceeding without effective ignore rules.");
  }

  eventSender.send("file-processing-status", {
    status: "processing",
    message: "Scanning directory structure...",
  });

  return new Promise((resolve, reject) => {
    try {
      const files = readFilesRecursively(
        rootDir,
        rootDir,
        ignoreFilter,
        eventSender
      );
      log.info(
        `Found ${files.length} files (after exclusions) in ${folderPath}`
      );

      const serializableFiles = files.map((file) => ({
        name: file.name || "",
        path: file.path,
        content: !file.isBinary && !file.isSkipped ? file.content || "" : "",
        tokenCount: typeof file.tokenCount === "number" ? file.tokenCount : 0,
        size: typeof file.size === "number" ? file.size : 0,
        isBinary: Boolean(file.isBinary),
        isSkipped: Boolean(file.isSkipped),
        error: file.error ? String(file.error) : null,
        fileKind: file.fileKind || "regular",
        sectionId: file.sectionId || null,
      }));

      log.debug(
        `Prepared ${serializableFiles.length} serializable file objects.`
      );

      eventSender.send("file-processing-status", {
        status: "complete",
        message: `Processed ${serializableFiles.length} files.`,
      });

      resolve(serializableFiles);
    } catch (err) {
      log.error("Critical error during file processing:", err);
      eventSender.send("file-processing-status", {
        status: "error",
        message: `File processing failed: ${err.message}`,
      });
      reject(err);
    }
  });
}

module.exports = {
  processFileList,
};
