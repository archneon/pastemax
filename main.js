// main.js - Main entry point for the Electron application
const { app } = require("electron");
const path = require("path"); // Needed for app.getPath

// Import modules for specific functionalities
const { configureLogging } = require("./electron/logConfig");
const { createWindow } = require("./electron/windowManager");
const { registerIpcHandlers } = require("./electron/ipcHandlers");

// Determine if running in development or production
// Ensure NODE_ENV is properly set (usually by scripts in package.json or tools like cross-env)
// Fallback to checking electron's isPackaged flag if NODE_ENV is unreliable
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

// --- 1. Configure Logging Early ---
// Pass isDev flag and userData path for log file location
try {
  const userDataPath = app.getPath("userData");
  configureLogging(isDev, userDataPath);
  // Now we can use console.log etc. and it will go through electron-log
  console.log(
    `Application starting in ${isDev ? "development" : "production"} mode.`
  );
  console.log(`User data path: ${userDataPath}`);
} catch (e) {
  // Minimal fallback logging if configuration fails catastrophically
  console.error("CRITICAL: Failed to configure logging.", e);
  // Consider exiting if logging is essential? process.exit(1);
}

// --- Global variable to hold the main window instance (optional but common) ---
// This prevents the window from being garbage-collected prematurely.
// However, since createWindow returns the instance, it might not be strictly
// necessary if we don't need to access mainWindow from elsewhere in this specific file.
// Let's keep it simple for now and not use a global mainWindow here.

// --- 2. Application Ready Event ---
// This is the main entry point after Electron initialization.
app
  .whenReady()
  .then(() => {
    console.log("App is ready, setting up...");

    // Create the main browser window
    // The createWindow function now handles loading URL, DevTools, etc.
    const mainWindow = createWindow(isDev); // Pass isDev flag

    // Register IPC handlers to listen for messages from the renderer
    registerIpcHandlers();

    // Optional: Set up application menu (if needed)
    // Menu.setApplicationMenu(null); // Example: Remove default menu

    console.log("Window created and IPC handlers registered.");
  })
  .catch((error) => {
    console.error("Error during app.whenReady:", error);
    // Consider quitting the app on critical startup errors
    // app.quit();
  });

// --- 3. Application Lifecycle Event Handlers ---

// Quit when all windows are closed (except on macOS)
app.on("window-all-closed", () => {
  console.log("All windows closed.");
  // On macOS it's common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    console.log("Quitting application (not macOS).");
    app.quit();
  }
});

// Re-create window when dock icon is clicked (macOS)
app.on("activate", () => {
  console.log("Application activated.");
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    console.log("No windows open, creating a new one.");
    createWindow(isDev); // Re-create the window
  }
});

// --- Optional: Handle Quit Events for Cleanup ---
app.on("before-quit", (event) => {
  console.log("Application is about to quit...");
  // Perform any necessary cleanup here before windows are closed
});

app.on("will-quit", (event) => {
  console.log("Application will quit now.");
  // Last chance cleanup after windows might be closed
});

app.on("quit", (event, exitCode) => {
  console.log(`Application quit with exit code: ${exitCode}.`);
});

// --- Optional: Handle Renderer Process Crashes ---
app.on("render-process-gone", (event, webContents, details) => {
  console.error(
    `Renderer process gone! Reason: ${details.reason}, Exit Code: ${details.exitCode}`
  );
  // Potentially try to reload the window or inform the user
});

// --- Optional: Handle GPU Process Crashes ---
app.on("child-process-gone", (event, details) => {
  if (details.type === "GPU") {
    console.error(
      `GPU process gone! Reason: ${details.reason}, Exit Code: ${details.exitCode}`
    );
    // GPU issues might require restarting the app or disabling hardware acceleration
    // app.disableHardwareAcceleration();
    // app.relaunch();
  }
});

console.log("Main process script execution finished setup."); // Log that the main script has run
