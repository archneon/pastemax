**Instructions for Cursor Agent: Implement Dynamic Window Title**

**1. Goal & Purpose:**

We want to make the Electron application's window title more informative. Instead of just displaying the static application name ("PasteMax"), we want it to reflect the currently open project folder.

- **If a folder is selected:** The title should be `<Full Folder Path> - PasteMax` (e.g., `/home/user/projects/my-project - PasteMax`).
- **If no folder is selected:** The title should revert to the default "PasteMax".

This provides users with immediate context about the project they are working on directly in the window title bar or task switcher.

**2. High-Level Plan:**

- The currently selected folder path is managed by the Zustand store in the **Renderer Process** (React application).
- The window title can only be set by the **Main Process**.
- We need to use **Inter-Process Communication (IPC)** to send the updated folder path (or null) from the Renderer Process to the Main Process whenever it changes.
- The Main Process will listen for this IPC message and update the `BrowserWindow`'s title accordingly.

**3. Step-by-Step Implementation Plan:**

**Step 3.1: Modify Renderer Process Logic (`src/hooks/useAppLogic.ts`)**

- **Objective:** Send an IPC message to the main process whenever the `selectedFolder` state changes.
- **Action:** Add a new `useEffect` hook inside the `useAppLogic` custom hook.
  - This effect should depend on `selectedFolder`, `isElectron`, and `hasHydrated`. We wait for hydration (`hasHydrated`) to ensure we don't send the initial `null` state prematurely.
  - Inside the effect, check if `isElectron` and `window.electron.ipcRenderer` are available.
  - Construct the desired title string: If `selectedFolder` has a value, format it as `\`${selectedFolder} - PasteMax\``; otherwise, use `"PasteMax"`.
  - Use `window.electron.ipcRenderer.send('set-window-title', newTitle)` to send the constructed title to the main process. Choose `'set-window-title'` as the IPC channel name.
  - Add `debug` logging to confirm the message is being sent.

```typescript
// Add this useEffect inside the useAppLogic hook in src/hooks/useAppLogic.ts

// *** New Effect for Updating Window Title ***
useEffect(() => {
  // Check if running in Electron, IPC is available, and store is hydrated
  if (isElectron && window.electron?.ipcRenderer && hasHydrated) {
    let newTitle = "PasteMax"; // Default title
    if (selectedFolder) {
      // Use the full path for the title as requested
      newTitle = `${selectedFolder} - PasteMax`;
    }

    // Send the IPC message to the main process to update the title
    window.electron.ipcRenderer.send("set-window-title", newTitle);
    logger.debug(`Sent IPC set-window-title with: "${newTitle}"`);
  }
  // Dependencies: Trigger when folder changes, electron is confirmed, and hydration is complete
}, [selectedFolder, isElectron, hasHydrated]);
```

**Step 3.2: Modify Main Process Entry Point (`main.js`)**

- **Objective:** Pass the `BrowserWindow` instance to the IPC handler registration function so it can access the window to modify its title.
- **Action:**
  - Ensure `BrowserWindow` is required from `electron` at the top.
  - When calling `createWindow` within the `app.whenReady().then(...)` block, store the returned window instance in a constant (e.g., `const mainWindow = createWindow(isDev);`).
  - Modify the call to `registerIpcHandlers()` to pass this `mainWindow` instance as an argument: `registerIpcHandlers(mainWindow);`.

```javascript
// Modify main.js

const { app, BrowserWindow } = require("electron"); // Ensure BrowserWindow is required
const path = require("path");

// ... other requires (logConfig, windowManager, ipcHandlers)

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

// ... logging configuration ...

app
  .whenReady()
  .then(() => {
    console.log("App is ready, setting up...");

    // Create the main browser window and store the instance
    const mainWindow = createWindow(isDev); // <-- Store the instance

    // Register IPC handlers, passing the mainWindow instance
    registerIpcHandlers(mainWindow); // <-- Pass mainWindow here

    console.log("Window created and IPC handlers registered.");
  })
  .catch((error) => {
    console.error("Error during app.whenReady:", error);
  });

// ... rest of main.js ...
```

**Step 3.3: Modify Main Process IPC Handlers (`electron/ipcHandlers.js`)**

- **Objective:** Add an IPC listener in the main process to receive the title update message and modify the window title.
- **Action:**
  - Modify the `registerIpcHandlers` function definition to accept the `mainWindow` instance as a parameter: `function registerIpcHandlers(mainWindow) { ... }`.
  - Inside `registerIpcHandlers`, add a new `ipcMain.on('set-window-title', (event, newTitle) => { ... })` listener.
  - Within this new listener's callback:
    - Check if the passed `mainWindow` instance is valid (exists and is not destroyed using `!mainWindow.isDestroyed()`).
    - If valid, call `mainWindow.setTitle(newTitle || 'PasteMax')`. Provide "PasteMax" as a fallback in case `newTitle` is unexpectedly null or empty.
    - Add logging to confirm reception and action.

```javascript
// Modify electron/ipcHandlers.js

const { ipcMain, dialog } = require("electron");
const log = require("electron-log");

const { processFileList } = require("./fileProcessor");
const { IPC_CHANNELS } = require("../constants");

// ... state variables (isProcessing, etc.) ...

/**
 * Registers all IPC handlers for the main process.
 * Accepts the main application window instance to perform operations like setting the title.
 * @param {import('electron').BrowserWindow} mainWindow - The main application window instance. // Added type hint
 */
function registerIpcHandlers(mainWindow) {
  // <-- Accept mainWindow parameter
  log.debug("Registering IPC handlers...");

  // ... existing ipcMain.on(IPC_CHANNELS.OPEN_FOLDER, ...) listener ...

  // ... existing ipcMain.on(IPC_CHANNELS.REQUEST_FILE_LIST, ...) listener ...

  // ... existing ipcMain.on('debug-file-selection', ...) listener ...

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
```

**4. Summary:**

These changes establish a communication channel where the React app (renderer) informs the main Electron process about the currently selected folder. The main process then uses this information to update the application's window title, providing better context to the user. Remember to restart the Electron application after applying these changes.
