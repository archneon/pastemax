// electron/ipcHandlers.js
const { ipcMain, dialog } = require("electron");
const log = require("electron-log");

// Import functionalities from other modules
const { processFileList } = require("./fileProcessor"); // Get the file processing function
const { IPC_CHANNELS } = require("../constants"); // Get IPC channel names

// State variables to prevent duplicate processing (could be moved to fileProcessor if preferred)
let isProcessing = false;
let lastProcessedFolder = null;
let lastProcessedFiles = null; // Cache the last successfully processed file list

/**
 * Registers all IPC handlers for the main process.
 * Listens for messages from the renderer process and acts accordingly.
 * @param {import('electron').BrowserWindow} mainWindow - The main application window instance.
 */
function registerIpcHandlers(mainWindow) {
  log.debug("Registering IPC handlers...");

  // --- Handler for OPEN_FOLDER ---
  ipcMain.on(IPC_CHANNELS.OPEN_FOLDER, async (event) => {
    log.info(`IPC Received: ${IPC_CHANNELS.OPEN_FOLDER}`);
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
      });

      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        // Reset processing state when a new folder is selected via dialog
        isProcessing = false;
        lastProcessedFolder = null;
        lastProcessedFiles = null;
        log.info(`Folder selected via dialog: ${selectedPath}`);
        // Send the selected path back to the renderer
        event.sender.send(IPC_CHANNELS.FOLDER_SELECTED, selectedPath);
        // Note: We now expect the renderer to send REQUEST_FILE_LIST subsequently
      } else {
        log.debug("Folder selection dialog cancelled.");
      }
    } catch (error) {
      log.error("Error showing open directory dialog:", error);
      // Optionally inform the renderer about the error
      event.sender.send(IPC_CHANNELS.FILE_PROCESSING_STATUS, {
        status: "error",
        message: `Failed to open folder dialog: ${error.message}`,
      });
    }
  });

  // --- Handler for REQUEST_FILE_LIST ---
  ipcMain.on(IPC_CHANNELS.REQUEST_FILE_LIST, async (event, options) => {
    // Handle both old format (string path) and new format ({ path: string, forceRefresh: boolean })
    const targetPath = typeof options === "object" ? options.path : options;
    const forceRefresh =
      typeof options === "object" ? options.forceRefresh || false : false;

    log.info(
      `IPC Received: ${IPC_CHANNELS.REQUEST_FILE_LIST} for path "${targetPath}" (forceRefresh: ${forceRefresh})`
    );

    if (!targetPath) {
      log.warn("Received request-file-list without a valid path.");
      event.sender.send(IPC_CHANNELS.FILE_PROCESSING_STATUS, {
        status: "error",
        message: "Invalid folder path received.",
      });
      return;
    }

    // --- Duplicate Request / Caching Logic ---
    if (isProcessing && !forceRefresh) {
      log.warn(
        "Ignoring request - already processing a folder and not a forced refresh."
      );
      event.sender.send(IPC_CHANNELS.FILE_PROCESSING_STATUS, {
        status: "processing", // Inform renderer it's busy
        message: "Already processing previous request...",
      });
      return;
    }

    // Check cache only if NOT forcing refresh
    if (
      !forceRefresh &&
      lastProcessedFolder === targetPath &&
      lastProcessedFiles
    ) {
      log.info(
        `Cache hit for folder: ${targetPath}. Sending cached file list.`
      );
      event.sender.send(IPC_CHANNELS.FILE_PROCESSING_STATUS, {
        status: "complete", // Send complete immediately as it's cached
        message: `Using cached data for ${lastProcessedFiles.length} files.`,
      });
      event.sender.send(IPC_CHANNELS.FILE_LIST_DATA, lastProcessedFiles);
      return;
    }

    // If we reach here, we need to process (either new folder, forced refresh, or no cache)
    isProcessing = true;
    lastProcessedFolder = targetPath; // Update last processed folder immediately
    lastProcessedFiles = null; // Clear cache while processing

    try {
      // Delegate the actual file processing work to the fileProcessor module
      // Pass the event.sender so fileProcessor can send progress updates
      const files = await processFileList(targetPath, event.sender);

      // Cache the successful result
      lastProcessedFiles = files;
      log.info(
        `Successfully processed and cached ${files.length} files for ${targetPath}.`
      );

      // Send the final file data list
      event.sender.send(IPC_CHANNELS.FILE_LIST_DATA, files);
    } catch (error) {
      log.error(`Error processing file list for ${targetPath}:`, error);
      // Ensure cache is cleared on error
      lastProcessedFolder = null;
      lastProcessedFiles = null;
      // Send final error status (processFileList might have sent intermediate errors)
      event.sender.send(IPC_CHANNELS.FILE_PROCESSING_STATUS, {
        status: "error",
        message: `Failed to process folder: ${error.message}`,
      });
    } finally {
      // Ensure processing flag is reset regardless of success or failure
      isProcessing = false;
      log.debug(
        `Finished processing request for ${targetPath}. isProcessing set to false.`
      );
    }
  });

  // --- Handler for DEBUG_FILE_SELECTION (Optional) ---
  // Kept from original code if needed for debugging from renderer
  ipcMain.on("debug-file-selection", (event, data) => {
    log.debug("IPC Received: debug-file-selection", data);
    // Add any specific debugging logic here if required
  });

  // *** New Handler for Setting the Window Title ***
  ipcMain.on("set-window-title", (event, newTitle) => {
    log.info(`IPC Received: set-window-title with title: "${newTitle}"`);
    // Check if the mainWindow instance exists and hasn't been destroyed
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Set the window title, using a default if newTitle is empty/null
      mainWindow.setTitle(newTitle || "PasteMax");
      log.debug(`Window title set to: "${mainWindow.getTitle()}"`);
    } else {
      log.warn(
        "Attempted to set window title, but mainWindow is not available or destroyed."
      );
    }
  });
  // *** End of New Handler ***

  log.info("IPC handlers registered successfully.");
}

module.exports = {
  registerIpcHandlers,
};
