Okay, here is a comprehensive plan for your Cursor AI agent to implement `electron-log` for controlled console logging in your PasteMax application.

---

## Implementation Plan: Integrate `electron-log` for Controlled Console Logging

**1. Goal:**

Replace the current ad-hoc `console.log/warn/error` usage with the `electron-log` library. This will provide a structured, configurable logging system with distinct log levels (`error`, `warn`, `info`, `debug`, etc.) and allow different logging verbosity between development and production environments. Initially, logging will be directed **only to the console**, with file logging explicitly disabled but easy to enable later.

**2. Rationale (`Why this approach?`):**

- **Structured Logging:** Moves away from basic `console.log` to standard logging levels (info, debug, warn, error), making logs more meaningful and filterable.
- **Centralized Control:** Configuration happens once in the main process (`main.js`), simplifying management. Renderer process logs are automatically routed to the main process for handling based on the central configuration.
- **Environment Control:** Easily set different log levels for development (more verbose, e.g., `debug`) and production (less verbose, e.g., `info`), preventing excessive noise for end-users while retaining crucial warnings and errors.
- **Cleanliness & Consistency:** Provides a consistent way to log messages across both JavaScript (`main.js`) and TypeScript (`*.ts`/`*.tsx`) parts of the application. Overriding `console` functions (optional step) ensures even legacy `console.log` calls adhere to the new system.
- **Extensibility:** While we're starting with console-only logging (`log.transports.file.level = false`), enabling file logging in the future requires changing only one configuration line in `main.js`.
- **Electron Native:** `electron-log` is specifically designed for Electron, handling IPC and process differences automatically.

**3. Prerequisites:**

- The AI agent needs access to modify the specified project files.
- The `electron-log` package needs to be installed.

**4. Step-by-Step Implementation:**

**Step 4.1: Install `electron-log` Dependency**

- **Target File:** `package.json`
- **Action:** Add `electron-log` to the project's dependencies.
- **Instruction:** Execute the following command in the project's root directory:
  ```bash
  npm install electron-log
  ```
  _(Verify that `electron-log` is added under "dependencies" in `package.json`)_

**Step 4.2: Configure `electron-log` in the Main Process**

- **Target File:** `main.js`
- **Action:** Initialize and configure `electron-log` early in the script, setting up transports, levels based on environment, and error catching. Disable file transport for now.
- **Code Changes:**

  - Add the `require` statement at the top:
    ```javascript
    const log = require("electron-log");
    const path = require("path"); // Ensure path is required if needed later
    ```
  - Add the configuration block _after_ other initial requires and the `isDev` determination, but _before_ any significant application logic or window creation:

    ```javascript
    // --- Configure electron-log ---
    const isDev = process.env.NODE_ENV === "development";

    // === CONSOLE TRANSPORT ===
    // Log to console: 'debug' level in development, 'info' level in production.
    log.transports.console.level = isDev ? "debug" : "info";
    // Optional: Customize console format if desired later
    // log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}';

    // === FILE TRANSPORT (DISABLED) ===
    // Disable file logging for now by setting level to false.
    // To enable later, set a level like 'info', 'warn', or 'error'.
    log.transports.file.level = false;
    // Example of future enabling: log.transports.file.level = 'info';
    // Optional: Customize file path when enabled later
    // log.transports.file.resolvePath = () => path.join(app.getPath('userData'), 'logs', 'main.log');

    // === ERROR CATCHING ===
    // Catch unhandled errors/rejections from the main process
    log.catchErrors({
      showDialog: !isDev, // Only show error dialog in production
    });

    // === (Optional but Recommended) OVERRIDE CONSOLE METHODS ===
    // Redirect standard console.log/warn/error calls to electron-log
    // This makes logging consistent even if some old console calls remain.
    Object.assign(console, log.functions);
    // --- End electron-log Configuration ---

    // Initial confirmation logs (will now use electron-log via console override)
    console.info("Main process started."); // Use console.info/warn/error or log.* directly
    console.info(
      `electron-log configured. Console level: ${log.transports.console.level}, File level: ${log.transports.file.level}`
    );
    // Note: The log file path won't be relevant until file logging is enabled.
    // console.info(`Log file transport is currently disabled.`);
    ```

**Step 4.3: Refactor Logging in the Main Process**

- **Target File:** `main.js`
- **Action:** Replace existing `console.log`, `console.warn`, `console.error` calls with the corresponding `log.*` functions (`log.debug`, `log.info`, `log.warn`, `log.error`). Choose the level semantically. Remove previous `if (isDev)` checks around logs if the level (`log.debug`) handles it automatically.
- **Examples:**
  - Replace `if (isDev) console.log('Loading config...');` with `log.debug('Loading config...');`
  - Replace `console.log('Scan complete...');` with `log.info('Scan complete for folder: %s', folderPath);` (using format placeholder)
  - Replace `console.warn('Missing file...');` with `log.warn('Missing file...');`
  - Replace `console.error('Failed to load module...');` with `log.error('Failed to load module...');` or `log.error('Failed to load module:', errorVariable);`
- **Instruction:** Systematically go through `main.js` and convert all relevant `console.*` calls used for application logging to `log.*` calls with appropriate levels. Remove the `[Main]`, `[IPC]` prefixes previously added, as `electron-log` can be configured for formats if needed.

**Step 4.4: Implement Logging in the Renderer Process**

- **Target Files:** `src/App.tsx` (and any other `.ts`/`.tsx` files needing logging)
- **Action:** Import `electron-log` and replace `console.*` calls with `log.*` calls.
- **Code Changes (`src/App.tsx`):**

  - Add the import statement:
    ```typescript
    import log from "electron-log";
    ```
  - Replace `console.log`, `console.warn`, `console.error` calls:

    ```typescript
    // Example inside a useEffect or function
    // Replace: console.log('[Renderer] App mounted...');
    // With:    log.info('Renderer: App mounted...');

    // Replace: console.log('Building file tree...');
    // With:    log.debug('Renderer: Building file tree...'); // Debug level for verbose operations

    // Replace: console.warn('Some warning...');
    // With:    log.warn('Renderer: Some warning...');

    // Replace: console.error('Some error...');
    // With:    log.error('Renderer: Some error...', errorVariable);
    ```

- **Instruction:** Go through `src/App.tsx` and other relevant components. Import `log` and replace `console.*` calls with the appropriate `log.*` level calls. Prefixing with "Renderer:" is good practice within the log message itself for clarity when reading combined logs.

**Step 4.5: Clean Up (If Console Override Wasn't Used)**

- **Target Files:** `main.js`, `src/**/*.ts`, `src/**/*.tsx`
- **Action:** If you chose _not_ to override the global `console` object in Step 4.2, ensure all intended logging goes through `log.*` and remove any remaining application-level `console.*` calls to avoid confusion. If you _did_ override `console`, this step is less critical but converting calls explicitly improves clarity.

**Step 4.6: Verification**

- **Action:** Run the application in development and, if possible, create a test production build.
- **Checks (Development - `npm run dev:electron`):**
  - Open the terminal where you ran the command. Observe logs from the main process. You should see messages with levels `debug`, `info`, `warn`, `error`.
  - Open the Electron application's DevTools (usually possible in dev mode). Check the Console tab. You should see logs from _both_ the main process and the renderer process, again according to the `debug` level set for the console transport.
- **Checks (Production - after building/packaging):**
  - Run the packaged application.
  - Check the terminal (if applicable) or system logs. You should _only_ see logs with level `info`, `warn`, `error` (or whatever non-dev level was set for the console transport). `debug` logs should be absent.
  - Verify _no_ log files (`main.log`, etc.) are created in the application's user data directory, as file logging is disabled.
  - Trigger a known warning or error condition to ensure those still get logged to the console.

---
