// electron/windowManager.js
const { BrowserWindow, Menu, MenuItem } = require("electron");
const path = require("path");
const log = require("electron-log"); // Assuming console is redirected

/**
 * Creates and configures the main application window.
 *
 * @param {boolean} isDev - Flag indicating if the app is running in development mode.
 * @returns {BrowserWindow} The created browser window instance.
 */
function createWindow(isDev) {
  log.debug("Creating main application window...");

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // Important for security
      contextIsolation: true, // Important for security
      preload: path.join(__dirname, "..", "preload.js"), // Correct path from electron/ to root then preload.js
      // Setting devTools explicitly can help avoid some default behaviors or warnings
      devTools: isDev, // Enable DevTools only in development
    },
    // Optional: Add window title, icon etc.
    // title: 'PasteMax',
    // icon: path.join(__dirname, '..', 'public', 'favicon.png'), // Example icon path
    // Optional: Hide menu bar (usually done via Menu.setApplicationMenu(null) later)
    // autoHideMenuBar: true,
  });

  log.debug(`Main window created. Development mode: ${isDev}`);

  // --- Load Content ---
  if (isDev) {
    // Development: Load from Vite dev server
    const vitePort = process.env.ELECTRON_START_URL
      ? new URL(process.env.ELECTRON_START_URL).port
      : 3000; // Default or from env
    const devServerUrl = `http://localhost:${vitePort}`;

    log.debug(`Attempting to load from dev server: ${devServerUrl}`);

    // Add a small delay to allow Vite server to start fully
    setTimeout(() => {
      // Important: Clear cache before loading dev URL to prevent potential redirect loops or stale content issues.
      mainWindow.webContents.session.clearCache().then(() => {
        log.debug("Cache cleared, loading dev URL...");
        mainWindow.loadURL(devServerUrl).catch((err) => {
          log.error(`Failed to load URL ${devServerUrl}:`, err);
          // Optionally implement retry logic or show an error message
        });
      });
    }, 500); // 500ms delay

    // Open DevTools automatically in development
    mainWindow.webContents.once("dom-ready", () => {
      if (!mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.openDevTools({ mode: "detach" }); // Open detached
        log.debug("DevTools opened automatically.");
      }
    });

    // Add 'Inspect Element' context menu in development
    mainWindow.webContents.on("context-menu", (event, params) => {
      const menu = new Menu();
      menu.append(
        new MenuItem({
          label: "Inspect Element",
          click: () => {
            mainWindow.webContents.inspectElement(params.x, params.y);
            if (mainWindow.webContents.isDevToolsOpened()) {
              mainWindow.webContents.devToolsWebContents?.focus();
            }
          },
        })
      );
      // Optionally add reload, etc.
      // menu.append(new MenuItem({ role: 'reload' }));
      menu.popup({ window: mainWindow, x: params.x, y: params.y });
    });
  } else {
    // Production: Load the index.html file from the build output
    const indexPath = path.join(__dirname, "..", "dist", "index.html"); // Path from electron/ to root/dist/index.html
    const indexUrl = `file://${indexPath}`;

    log.info(`Loading production build from: ${indexUrl}`);

    mainWindow.loadURL(indexUrl).catch((err) => {
      log.error(`Failed to load production build at ${indexUrl}:`, err);
      // Implement fallback or error display for production if loading fails
    });
  }

  // --- Window Event Handlers (Debugging/Info) ---
  mainWindow.webContents.on("did-finish-load", () => {
    log.debug(
      `Window content finished loading for URL: ${mainWindow.webContents.getURL()}`
    );
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      log.error(
        `Window content failed to load: ${errorDescription} (Code: ${errorCode}) - URL: ${validatedURL}`
      );
      // Potentially add retry logic here, especially for dev server connections
    }
  );

  mainWindow.on("closed", () => {
    log.debug("Main window was closed.");
    // Note: Dereferencing the window object is often done in the main process
    // after this event, e.g., mainWindow = null; (but mainWindow is local here)
  });

  mainWindow.on("unresponsive", () => {
    log.warn("Window became unresponsive.");
  });

  mainWindow.on("responsive", () => {
    log.debug("Window became responsive again.");
  });

  return mainWindow; // Return the created window instance
}

module.exports = {
  createWindow,
};
