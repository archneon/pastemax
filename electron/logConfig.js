// electron/logConfig.js
const path = require("path");
const log = require("electron-log");

/**
 * Configures electron-log for main process logging.
 * Sets console and file transport levels based on development/production mode.
 * Overrides console methods to use electron-log.
 * Starts catching unhandled errors/rejections.
 *
 * @param {boolean} isDev - Indicates if the app is running in development mode.
 * @param {string} userDataPath - Path to the application's user data directory (for log files).
 */
function configureLogging(isDev, userDataPath) {
  try {
    // === CONSOLE TRANSPORT ===
    log.transports.console.level = isDev ? "debug" : "info";
    log.transports.console.format =
      "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [Main] [{level}] {text}";

    // === FILE TRANSPORT (DISABLED BY DEFAULT) ===
    // To enable, change level to 'info', 'warn', 'error', etc.
    log.transports.file.level = false;
    // Resolve log file path within the userData directory
    // This ensures logs are stored in a standard location per platform.
    log.transports.file.resolvePath = (vars, message) => {
      // Use default file name format (e.g., main.log) or customize if needed
      const fileName = vars.fileName || "main.log";
      return path.join(userDataPath, "logs", fileName);
    };
    // Optional: Set max log file size (e.g., 5MB)
    // log.transports.file.maxSize = 5 * 1024 * 1024;
    // Optional: Set format for file logs if needed
    // log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

    // === ERROR HANDLING ===
    log.errorHandler.startCatching({
      showDialog: !isDev, // Show dialog only in production
      onError({ createIssue, error, processType, versions }) {
        // Custom actions on error, e.g., logging extra details
        log.error(`Unhandled error in ${processType}:`, error);
        // Example: createIssue('https://github.com/my-repo/issues/new', { /* issue details */ });
      },
    });

    // === OVERRIDE CONSOLE METHODS ===
    // Redirect console.log, console.warn, etc., to electron-log
    Object.assign(console, log.functions);

    log.info(
      `electron-log configured. Console level: ${log.transports.console.level}, File level: ${log.transports.file.level}`
    );
  } catch (error) {
    // Fallback to plain console if logger configuration fails
    console.error("FATAL: Failed to configure electron-log:", error);
  }
}

module.exports = { configureLogging };
