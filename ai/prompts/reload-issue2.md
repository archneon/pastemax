Seveda, tukaj je prompt, ki ga lahko kopiraš in prilepiš v Cursor ali podobnega AI asistenta. Prompt vključuje kontekst, opis težave, vzrok, želeno obnašanje in predlagano rešitev, o kateri sva se pogovarjala.

````prompt
**Project:** PasteMax (Electron + React with Vite)

**Context:**
The application allows users to select a folder, view its file structure in a sidebar (`src/components/Sidebar.tsx`), select files using checkboxes, and see the selected files listed in the main content area (`src/components/FileList.tsx`). The main state management and IPC communication happen in `src/App.tsx`. State like `selectedFolder` and `selectedFiles` (an array of file paths) is persisted in `localStorage`. IPC calls (`request-file-list`) are sent to `main.js` to get file data, and responses (`folder-selected`, `file-list-data`, `file-processing-status`) are received via `preload.js`.

**Problem:**
When using Electron's native "View / Reload" or "View / Force Reload" menu actions while a folder and some files are selected:
1. The file tree in the sidebar disappears.
2. The list of selected files in the main content area disappears.
3. However, the UI element showing the count of selected files (which reads `selectedFiles.length`) still displays the number of files selected *before* the reload.
This indicates that the `selectedFiles` state is restored from `localStorage`, but the `allFiles` state (which drives the tree and list rendering) is not being repopulated after the reload.

**Desired Behavior for Electron "View / Reload":**
The application should behave as if it's being freshly loaded for the currently selected folder. This means:
1. The file tree should be reloaded and displayed correctly based on the `selectedFolder`.
2. Any previously selected files should be **cleared** (`selectedFiles` should become an empty array).
3. The selected file count should show 0.
This behavior should mirror the functionality of the existing custom "Reload" button implemented in the app.

**Important Note on Existing Custom Buttons:**
The application has two custom buttons with specific behaviors that **must remain unchanged**:
*   **"Reload" Button (`reloadFolder` function):** Correctly reloads the file list for the current folder and *clears* the selection. This works as intended.
*   **"Refresh" Button (`refreshFolder` function):** Correctly reloads the file list but *preserves* the current selection (updating it if files were removed). This also works as intended.
These buttons use temporary, specific IPC listeners for their logic.

**Root Cause Analysis:**
The issue with Electron's "View / Reload" stems from a `useEffect` hook in `src/App.tsx` responsible for loading initial data when the component mounts or `selectedFolder` changes. This hook contains a check using `sessionStorage.getItem("hasLoadedInitialData")`. Because Electron's reload action often preserves `sessionStorage` for the session, this check evaluates to `true` after a reload, causing the hook to `return` early and **preventing the `window.electron.ipcRenderer.send("request-file-list", selectedFolder)` call**. Consequently, `allFiles` remains empty.

Furthermore, there is another `useEffect` hook that sets up *permanent* IPC listeners, including one for `file-list-data` (`handleFileListData`). This permanent handler *already contains* the logic `setSelectedFiles([])`. If the data *were* loaded after an Electron reload, this handler would correctly clear the selection, achieving the desired behavior.

**Proposed Solution:**
The most elegant solution is to remove the `sessionStorage` check from the initial data loading `useEffect`. This will ensure that `request-file-list` is always sent after an Electron reload (assuming `selectedFolder` is set). The subsequent `file-list-data` response will then be handled by the *permanent* `handleFileListData` listener, which will populate `allFiles` and correctly clear the selection via `setSelectedFiles([])`. This achieves the desired behavior for Electron's reload without affecting the custom "Refresh" and "Reload" buttons, as they use their own temporary listeners.

**Action Request:**
Please modify the `src/App.tsx` file. Locate the `useEffect` hook responsible for loading initial data (around line 115, dependent on `[isElectron, selectedFolder]`). Remove the lines related to checking and setting `sessionStorage.getItem("hasLoadedInitialData")`.

Specifically, remove these lines from within that `useEffect`:
```javascript
    // Use a flag in sessionStorage to ensure we only load data once per session
    const hasLoadedInitialData = sessionStorage.getItem("hasLoadedInitialData");
    if (hasLoadedInitialData === "true") return;
````

And also remove this line from the same hook:

```javascript
// Mark that we've loaded the initial data
sessionStorage.setItem("hasLoadedInitialData", "true");
```

Ensure the rest of the logic within that hook (checking `isElectron` and `selectedFolder`, setting processing status, and sending `request-file-list`) remains intact. Also, verify that the permanent `handleFileListData` listener (in the other main `useEffect`) still contains `setSelectedFiles([])`.

Thank you!

```

```
