MOJ PROMPT GEMINI 2.5 MODELU - ZACETEK:

To je moj electron projekt za copy pasting za AI.
Rabim tvojo pomoc. Ko v sidebar-u checkboxam datoteke (selected files) in pritisnem refresh, se osvezi file tree, hkrati pa se iz local storage nalozijo prej izbrane datoteke ,tako da se ne izgubijo!

Ce pa kliknem na "reload" button:
<button class="select-folder-btn" title="Reload">...</button>
...pa se checkboxi ne ohranijo.

Tudi ce izberem sistemski "view / reload", se checkboxi (selected files oz. v storageu se to imenuje "pastemax-selected-files") ne ohranijo.

Jaz bi si zelel, da se vedno ohranijo.

Slabost trenutne implementacije je tudi to, da ce uporabim "exit" button
<button class="select-folder-btn" title="Exit">....</button>
...in pridem na zacetek kjer lahko preklapljam med razlicnimi projekti, je v bistvu "pastemax-recent-folders" vedno vezan samo na en projekt. Ce izberem drugi projekt se zadeva povozi.

Ali bi lahko sestavili logiko in json tako, da bi imel vsak projekt (vsak direktorij projekta) svoj prostor za "selected_files"?

Globoko razmisli ,pripravi nacrt za implementacijo. Koda mora biti elegantna, DRY, lepa, delujoca in enostavna kolikor se le da.

MOJ PROMPT GEMINI 2.5 MODELU - KONEC:

ODGOVOR GEMINI 2.5 MODELA - ZACETEK:

Okay, let's break this down. You want two main things:

1.  **Consistent Selection Preservation:** Selected files (`selectedFiles`) should be remembered across "Refresh", "Reload", and system reloads (like Cmd/Ctrl+R or View -> Reload) for the _currently open project_.
2.  **Per-Project State:** The `selectedFiles` (and potentially other settings like `expandedNodes`, `sortOrder`, etc.) should be stored _separately_ for each project folder, rather than globally.

This requires changing how state is persisted in `localStorage`. Instead of individual global keys, we'll use a single key containing an object where each top-level property is a project folder path, and the value is an object holding the state for that specific project.

**Plan:**

1.  **Define New Storage Structure:** Create a single `localStorage` key (e.g., `pastemax-project-states`). The value will be an object mapping folder paths to their respective states:
    ```json
    // Key: "pastemax-project-states"
    {
      "/path/to/project/A": {
        "selectedFiles": ["..."],
        "expandedNodes": { ... },
        "sortOrder": "path-asc",
        "searchTerm": "",
        "fileListView": "structured",
        "lastAccessed": 1678886400000 // Optional: Timestamp
      },
      "/path/to/project/B": {
        // ... state for project B
      }
    }
    ```
2.  **Create Storage Utility Functions:** Add helper functions (e.g., in `src/utils/storageUtils.ts`) to manage reading and writing to this nested structure in `localStorage`. This keeps `App.tsx` cleaner.
    - `loadProjectStates()`: Reads the entire object from `localStorage`.
    - `getProjectState(folderPath)`: Retrieves the state object for a specific folder path.
    - `saveProjectState(folderPath, state)`: Updates the state for a specific folder path and saves the entire object back to `localStorage`.
    - `updateProjectProperty(folderPath, propertyName, value)`: A more granular way to update a single property for a project.
3.  **Modify `App.tsx` State Initialization:**
    - On mount, load the _currently selected folder path_ (using the _old_ `STORAGE_KEYS.SELECTED_FOLDER` for backward compatibility or a new dedicated key if preferred).
    - Use the utility functions to load the specific state (`selectedFiles`, `expandedNodes`, etc.) for _that_ folder from the main `pastemax-project-states` object. Provide defaults if no state exists for that folder yet.
4.  **Modify `App.tsx` State Persistence:**
    - Change the `useEffect` hooks that currently save individual items (`selectedFiles`, `sortOrder`, etc.) to `localStorage`.
    - These hooks will now call `updateProjectProperty` (or `saveProjectState`) to update the relevant property _within the current `selectedFolder`'s entry_ in the main `pastemax-project-states` object.
5.  **Update Folder Handling Logic:**
    - `handleFolderSelected`: When a new folder is selected, save the _current_ project's state (if any), update `selectedFolder`, and then load the state for the _new_ folder using `getProjectState`. Reset `allFiles`, `displayedFiles`, etc. as before. Send `request-file-list`. Crucially, _do not_ reset `selectedFiles` here; let the loaded state dictate it.
    - `refreshFolder`: The logic is almost correct. It needs to save/restore the selection _using the per-project state mechanism_.
    - `reloadFolder`: **Modify this function.** It should _not_ reset `selectedFiles` to `[]`. Instead, it should behave like `refreshFolder`: save the current selection (for the _current project_), request the file list, and then restore the selection based on the files that still exist in the reloaded list.
    - `handleExitFolder`: Reset the `selectedFolder` state variable to `null`. Clear `allFiles`, `displayedFiles`. _Do not_ clear the entire `pastemax-project-states` object. Optionally, clear the temporary "last selected folder" key if you use one.
6.  **Update Recent Folders:**
    - The `recentFolders` list itself can remain global (`pastemax-recent-folders`).
    - When selecting a recent folder (`selectRecentFolder`), the logic correctly calls `handleFolderSelected` (implicitly via state changes and effects), which will now load the _correct_ per-project state.
7.  **Address System Reload:** By storing state per-project, a system reload (which restarts the renderer) will cause `App.tsx` to remount. It will load the last `selectedFolder` path and then correctly load the state associated _with that specific folder_ from `pastemax-project-states`, thus preserving the selection automatically.

**Implementation:**

**1. Create `src/utils/storageUtils.ts`:**

```typescript
// src/utils/storageUtils.ts
import { normalizePath } from "./pathUtils";

const PROJECT_STATES_KEY = "pastemax-project-states";

// Define the structure for a single project's state
interface ProjectState {
  selectedFiles?: string[];
  expandedNodes?: Record<string, boolean>;
  sortOrder?: string;
  searchTerm?: string;
  fileListView?: "structured" | "flat";
  lastAccessed?: number;
}

// Define the structure for the entire storage object
type AllProjectStates = Record<string, ProjectState>;

// --- Default values ---
const defaultProjectState: ProjectState = {
  selectedFiles: [],
  expandedNodes: {},
  sortOrder: "path-asc",
  searchTerm: "",
  fileListView: "structured",
};

// --- Helper Functions ---

/**
 * Loads all project states from localStorage.
 * @returns The object containing states for all projects.
 */
export function loadProjectStates(): AllProjectStates {
  try {
    const storedStates = localStorage.getItem(PROJECT_STATES_KEY);
    return storedStates ? JSON.parse(storedStates) : {};
  } catch (error) {
    console.error("Error loading project states from localStorage:", error);
    return {}; // Return empty object on error
  }
}

/**
 * Saves the entire project states object to localStorage.
 * @param states The complete project states object to save.
 */
function saveAllProjectStates(states: AllProjectStates): void {
  try {
    localStorage.setItem(PROJECT_STATES_KEY, JSON.stringify(states));
  } catch (error) {
    console.error("Error saving project states to localStorage:", error);
  }
}

/**
 * Retrieves the state for a specific project folder.
 * Merges stored state with defaults.
 * @param folderPath The normalized path of the project folder.
 * @returns The state object for the specified project.
 */
export function getProjectState(folderPath: string | null): ProjectState {
  if (!folderPath) {
    return { ...defaultProjectState }; // Return defaults if no folder path
  }
  const normalized = normalizePath(folderPath);
  const allStates = loadProjectStates();
  const projectState = allStates[normalized] || {};

  // Merge with defaults to ensure all keys are present
  return {
    ...defaultProjectState,
    ...projectState,
    // Ensure arrays/objects are properly defaulted if missing
    selectedFiles: projectState.selectedFiles ?? [],
    expandedNodes: projectState.expandedNodes ?? {},
  };
}

/**
 * Updates a specific property for a project and saves it.
 * @param folderPath The normalized path of the project folder.
 * @param propertyName The key of the property to update.
 * @param value The new value for the property.
 */
export function updateProjectProperty<K extends keyof ProjectState>(
  folderPath: string | null,
  propertyName: K,
  value: ProjectState[K]
): void {
  if (!folderPath) return; // Don't save if no folder is selected

  const normalized = normalizePath(folderPath);
  const allStates = loadProjectStates();

  // Ensure the project entry exists
  if (!allStates[normalized]) {
    allStates[normalized] = { ...defaultProjectState };
  }

  // Update the specific property
  allStates[normalized][propertyName] = value;
  // Update last accessed time
  allStates[normalized].lastAccessed = Date.now();

  saveAllProjectStates(allStates);
}

/**
 * Saves the complete state object for a specific project.
 * Use this if you need to update multiple properties at once.
 * @param folderPath The normalized path of the project folder.
 * @param newState The complete new state object for the project.
 */
export function saveProjectState(
  folderPath: string | null,
  newState: Partial<ProjectState> // Allow partial updates
): void {
  if (!folderPath) return;

  const normalized = normalizePath(folderPath);
  const allStates = loadProjectStates();

  // Merge the new state with existing or default state
  allStates[normalized] = {
    ...(allStates[normalized] || defaultProjectState),
    ...newState,
    lastAccessed: Date.now(),
  };

  saveAllProjectStates(allStates);
}

// --- Specific Helpers for App.tsx ---

export const loadInitialState = (
  folderPath: string | null
): Required<ProjectState> => {
  // Use getProjectState which includes defaults
  const state = getProjectState(folderPath);
  // Ensure all properties are present (even if default)
  return {
    selectedFiles: state.selectedFiles!,
    expandedNodes: state.expandedNodes!,
    sortOrder: state.sortOrder!,
    searchTerm: state.searchTerm!,
    fileListView: state.fileListView!,
    lastAccessed: state.lastAccessed, // Can be undefined if never accessed
  };
};
```

**2. Modify `App.tsx`:**

```typescript
import React, { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import FileList from "./components/FileList";
import CopyButton from "./components/CopyButton";
import FileTreeToggle from "./components/FileTreeToggle";
import { FileData } from "./types/FileTypes";
import { ThemeProvider } from "./context/ThemeContext";
import ThemeToggle from "./components/ThemeToggle";
import FileListToggle from "./components/FileListToggle";
import {
  generateAsciiFileTree,
  normalizePath,
  arePathsEqual,
  comparePaths,
  basename,
} from "./utils/pathUtils";
// Import new storage utils
import {
  loadInitialState,
  updateProjectProperty,
  getProjectState,
  saveProjectState, // If needed for multi-property updates
} from "./utils/storageUtils"; // Adjust path if needed
import {
  X,
  FolderOpen,
  RefreshCw,
  LogOut,
  ChartNoAxesColumnIncreasingIcon,
  ChartNoAxesColumnDecreasingIcon,
  SortAsc,
  SortDesc,
  ArrowUpDown,
  FolderUp,
  FolderDown,
} from "lucide-react";

console.log("--- App.tsx component function starting ---");

// Access the electron API from the window object
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send: (channel: string, data?: any) => void;
        on: (channel: string, func: (...args: any[]) => void) => void;
        removeListener: (
          channel: string,
          func: (...args: any[]) => void
        ) => void;
      };
    };
  }
}

// Key for storing the *path* of the last selected folder globally
const LAST_SELECTED_FOLDER_KEY = "pastemax-last-selected-folder";
const RECENT_FOLDERS_KEY = "pastemax-recent-folders"; // Keep this global

const MAX_RECENT_FOLDERS = 10;

const App = () => {
  // --- State ---
  const [selectedFolder, setSelectedFolder] = useState<string | null>(() => {
    // Load the *path* of the last folder on startup
    return localStorage.getItem(LAST_SELECTED_FOLDER_KEY);
  });

  // Load initial project-specific state based on selectedFolder
  const initialProjectState = loadInitialState(selectedFolder);

  const [allFiles, setAllFiles] = useState<FileData[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>(
    initialProjectState.selectedFiles
  );
  const [sortOrder, setSortOrder] = useState<string>(
    initialProjectState.sortOrder
  );
  const [searchTerm, setSearchTerm] = useState<string>(
    initialProjectState.searchTerm
  );
  const [fileListView, setFileListView] = useState<"structured" | "flat">(
    initialProjectState.fileListView
  );
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(
    initialProjectState.expandedNodes
  );
  const [displayedFiles, setDisplayedFiles] = useState<FileData[]>([]);
  const [processingStatus, setProcessingStatus] = useState({
    status: "idle",
    message: "",
  } as {
    status: "idle" | "processing" | "complete" | "error";
    message: string;
  });
  const [includeFileTree, setIncludeFileTree] = useState(false);
  const [recentFolders, setRecentFolders] = useState<string[]>(() => {
    const saved = localStorage.getItem(RECENT_FOLDERS_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  const isElectron = window.electron !== undefined;

  // --- Effects for Persistence ---

  // Persist *last selected folder path* globally
  useEffect(() => {
    if (selectedFolder) {
      localStorage.setItem(LAST_SELECTED_FOLDER_KEY, selectedFolder);
    } else {
      localStorage.removeItem(LAST_SELECTED_FOLDER_KEY);
    }
  }, [selectedFolder]);

  // Persist selected files (per project)
  useEffect(() => {
    updateProjectProperty(selectedFolder, "selectedFiles", selectedFiles);
  }, [selectedFiles, selectedFolder]);

  // Persist sort order (per project)
  useEffect(() => {
    updateProjectProperty(selectedFolder, "sortOrder", sortOrder);
  }, [sortOrder, selectedFolder]);

  // Persist search term (per project)
  useEffect(() => {
    updateProjectProperty(selectedFolder, "searchTerm", searchTerm);
  }, [searchTerm, selectedFolder]);

  // Persist file list view (per project)
  useEffect(() => {
    updateProjectProperty(selectedFolder, "fileListView", fileListView);
  }, [fileListView, selectedFolder]);

  // Persist expanded nodes (per project)
  useEffect(() => {
    // Avoid saving empty object unnecessarily on initial load if defaults are used
    if (
      Object.keys(expandedNodes).length > 0 ||
      getProjectState(selectedFolder).expandedNodes !== undefined
    ) {
      updateProjectProperty(selectedFolder, "expandedNodes", expandedNodes);
    }
  }, [expandedNodes, selectedFolder]);

  // Persist recent folders (globally)
  useEffect(() => {
    localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(recentFolders));
  }, [recentFolders]);

  // --- Utility Functions ---

  // Memoize applyFiltersAndSort to avoid re-creating it on every render
  const applyFiltersAndSort = useCallback(
    (
      files: FileData[],
      currentSortOrder: string,
      currentSearchTerm: string
    ) => {
      console.log(
        `Applying filter '${currentSearchTerm}' and sort '${currentSortOrder}' to ${files.length} files`
      );
      let filtered = files;

      // Apply filter
      if (currentSearchTerm) {
        const lowerFilter = currentSearchTerm.toLowerCase();
        filtered = files.filter(
          (file) =>
            !file.isBinary && // Exclude binary files from search results matching
            !file.isSkipped &&
            (file.name.toLowerCase().includes(lowerFilter) ||
              normalizePath(file.path).toLowerCase().includes(lowerFilter))
        );
      } else {
        // When no search term, still filter out binary/skipped unless explicitly needed elsewhere
        filtered = files.filter((file) => !file.isBinary && !file.isSkipped);
      }

      // Apply sort
      const [sortKey, sortDir] = currentSortOrder.split("-");
      const sorted = [...filtered].sort((a, b) => {
        let comparison = 0;
        if (sortKey === "name") comparison = a.name.localeCompare(b.name);
        else if (sortKey === "tokens") comparison = a.tokenCount - b.tokenCount;
        else if (sortKey === "size") comparison = a.size - b.size;
        else if (sortKey === "path") comparison = comparePaths(a.path, b.path);
        return sortDir === "asc" ? comparison : -comparison;
      });

      setDisplayedFiles(sorted);
    },
    [] // No dependencies, relies on arguments
  );

  // Update recent folders list
  const updateRecentFolders = useCallback((folderPath: string) => {
    if (!folderPath) return;
    setRecentFolders((prev) => {
      const filtered = prev.filter((path) => !arePathsEqual(path, folderPath));
      const updated = [normalizePath(folderPath), ...filtered];
      return updated.slice(0, MAX_RECENT_FOLDERS);
    });
  }, []); // Add dependencies if needed, here none.

  // --- Effects for Loading Data & IPC ---

  // Load initial file list if a folder was selected previously
  useEffect(() => {
    if (isElectron && selectedFolder) {
      console.log("Requesting file list for initial folder:", selectedFolder);
      setProcessingStatus({
        status: "processing",
        message: "Loading files...",
      });
      window.electron.ipcRenderer.send("request-file-list", selectedFolder);
      updateRecentFolders(selectedFolder); // Ensure it's in recents
    }
    // If no folder is selected initially, ensure state reflects defaults
    if (!selectedFolder) {
      const defaultState = loadInitialState(null);
      setSelectedFiles(defaultState.selectedFiles);
      setExpandedNodes(defaultState.expandedNodes);
      setSortOrder(defaultState.sortOrder);
      setSearchTerm(defaultState.searchTerm);
      setFileListView(defaultState.fileListView);
      setAllFiles([]);
      setDisplayedFiles([]);
    }
  }, [isElectron]); // Run only once on mount based on initial selectedFolder

  // IPC Listener Setup
  useEffect(() => {
    if (!isElectron) {
      console.warn("Not running in Electron environment");
      return;
    }

    // Handler for when a folder is *chosen* via the dialog
    const handleFolderSelectedIPC = (folderPath: string) => {
      if (typeof folderPath !== "string") {
        console.error("Invalid folder path received:", folderPath);
        setProcessingStatus({
          status: "error",
          message: "Invalid folder path",
        });
        return;
      }

      const normalizedPath = normalizePath(folderPath);
      console.log("Folder selected via IPC:", normalizedPath);

      // --- This is the crucial part for switching projects ---
      // 1. (Optional but good practice) Save state for the *previous* folder if there was one
      //    saveProjectState(selectedFolder, { selectedFiles, expandedNodes, ... }); // Example

      // 2. Update the selected folder state
      setSelectedFolder(normalizedPath);

      // 3. Load state for the *new* folder
      const newState = loadInitialState(normalizedPath);
      setSelectedFiles(newState.selectedFiles);
      setExpandedNodes(newState.expandedNodes);
      setSortOrder(newState.sortOrder);
      setSearchTerm(newState.searchTerm);
      setFileListView(newState.fileListView);

      // 4. Reset file lists and request new data
      setAllFiles([]);
      setDisplayedFiles([]);
      setProcessingStatus({
        status: "processing",
        message: "Requesting file list...",
      });
      window.electron.ipcRenderer.send("request-file-list", normalizedPath);

      // 5. Update recent folders
      updateRecentFolders(normalizedPath);
    };

    // Handler for receiving file list data
    const handleFileListData = (files: FileData[]) => {
      console.log(`Received file list data: ${files.length} files`);

      // --- Preserve selection logic (used by refresh/reload) ---
      // Check if we have a saved selection *before* this update
      const currentProjectState = getProjectState(selectedFolder);
      const previousSelection = currentProjectState.selectedFiles || [];

      // Filter the previous selection to keep only files that still exist
      const validPaths = new Set(files.map((f) => normalizePath(f.path)));
      const restoredSelection = previousSelection.filter((p) =>
        validPaths.has(normalizePath(p))
      );
      // --- End of preservation logic ---

      setAllFiles(files); // Update the full file list

      // Apply current filters and sort (using the state values)
      applyFiltersAndSort(files, sortOrder, searchTerm);

      // Set the selection state (either restored or potentially empty if it's a fresh load)
      // We rely on the `refresh` and `reload` functions to manage the selection state *before* this handler runs.
      // If this handler is triggered by initial load or folder change, the selection state is already set correctly.
      // If triggered by refresh/reload, they manage temporary storage. Let's refine refresh/reload instead.
      // setSelectedFiles(restoredSelection); NO - let refresh/reload handle this transition.

      setProcessingStatus({
        status: "complete",
        message: `Loaded ${files.length} files`,
      });
    };

    // Handler for status updates
    const handleProcessingStatus = (status: {
      status: any;
      message: string;
    }) => {
      console.log("Processing status:", status);
      setProcessingStatus(status);
    };

    // Register listeners
    window.electron.ipcRenderer.on("folder-selected", handleFolderSelectedIPC);
    window.electron.ipcRenderer.on("file-list-data", handleFileListData);
    window.electron.ipcRenderer.on(
      "file-processing-status",
      handleProcessingStatus
    );

    // Cleanup listeners
    return () => {
      window.electron.ipcRenderer.removeListener(
        "folder-selected",
        handleFolderSelectedIPC
      );
      window.electron.ipcRenderer.removeListener(
        "file-list-data",
        handleFileListData
      );
      window.electron.ipcRenderer.removeListener(
        "file-processing-status",
        handleProcessingStatus
      );
    };
    // Re-run if isElectron changes (unlikely), or when sort/search/filter utils change
  }, [
    isElectron,
    applyFiltersAndSort,
    updateRecentFolders,
    sortOrder,
    searchTerm,
    selectedFolder,
  ]); // Added selectedFolder dependency for context

  // --- Action Handlers ---

  const openFolder = () => {
    if (isElectron) {
      console.log("Opening folder dialog");
      setProcessingStatus({ status: "idle", message: "Select a folder..." });
      window.electron.ipcRenderer.send("open-folder");
    } else {
      console.warn("Folder selection not available in browser");
    }
  };

  // Generic function for refresh/reload behavior (preserves selection)
  const refreshOrReloadFolder = (action: "refresh" | "reload") => {
    if (!selectedFolder || !isElectron) return;

    console.log(
      `${
        action === "refresh" ? "Refreshing" : "Reloading"
      } folder: ${selectedFolder}`
    );
    setProcessingStatus({
      status: "processing",
      message: `${action === "refresh" ? "Refreshing" : "Reloading"} folder...`,
    });

    // *** IMPORTANT: Use the current state directly ***
    const selectionToPreserve = [...selectedFiles];

    // Define a *one-time* listener specifically for this refresh/reload operation
    const handleDataForRefresh = (refreshedFiles: FileData[]) => {
      console.log(
        `Received data for ${action}: ${refreshedFiles.length} files`
      );

      // Restore selection based on the preserved list and the new file list
      const validPaths = new Set(
        refreshedFiles.map((f) => normalizePath(f.path))
      );
      const restoredSelection = selectionToPreserve.filter((p) =>
        validPaths.has(normalizePath(p))
      );

      setAllFiles(refreshedFiles);
      applyFiltersAndSort(refreshedFiles, sortOrder, searchTerm); // Use current sort/search
      setSelectedFiles(restoredSelection); // *** Apply the restored selection ***

      setProcessingStatus({
        status: "complete",
        message: `Folder ${action}ed`,
      });

      // *** CRUCIAL: Remove this specific listener ***
      window.electron.ipcRenderer.removeListener(
        "file-list-data",
        handleDataForRefresh
      );
    };

    // Add the specific listener *before* sending the request
    window.electron.ipcRenderer.on("file-list-data", handleDataForRefresh);

    // Request the file list update
    window.electron.ipcRenderer.send("request-file-list", selectedFolder);
  };

  const refreshFolder = () => refreshOrReloadFolder("refresh");
  const reloadFolder = () => refreshOrReloadFolder("reload"); // Now uses the preserving logic

  const handleSortChange = (newSort: string) => {
    setSortOrder(newSort);
    applyFiltersAndSort(allFiles, newSort, searchTerm);
    setSortDropdownOpen(false);
  };

  const handleSearchChange = (newSearch: string) => {
    setSearchTerm(newSearch);
    applyFiltersAndSort(allFiles, sortOrder, newSearch);
  };

  const handleViewChange = (newView: "structured" | "flat") => {
    setFileListView(newView);
  };

  const toggleSortDropdown = () => {
    setSortDropdownOpen(!sortDropdownOpen);
  };

  const toggleFileSelection = useCallback((filePath: string) => {
    const normalizedPath = normalizePath(filePath);
    setSelectedFiles((prev) => {
      const isSelected = prev.some((p) => arePathsEqual(p, normalizedPath));
      if (isSelected) {
        return prev.filter((p) => !arePathsEqual(p, normalizedPath));
      } else {
        // Ensure we don't add duplicates if called rapidly
        if (prev.some((p) => arePathsEqual(p, normalizedPath))) return prev;
        return [...prev, normalizedPath];
      }
    });
  }, []); // Empty dependency array as it uses setSelectedFiles updater form

  const toggleFolderSelection = useCallback(
    (folderPath: string, shouldBeSelected: boolean) => {
      const normalizedFolderPath = normalizePath(folderPath);
      const filesToToggle = allFiles
        .filter(
          (file) =>
            !file.isBinary &&
            !file.isSkipped &&
            normalizePath(file.path).startsWith(normalizedFolderPath + "/") // Ensure it's *inside*
        )
        .map((file) => normalizePath(file.path));

      setSelectedFiles((prevSelected) => {
        const currentSelectedSet = new Set(prevSelected);
        if (shouldBeSelected) {
          // Add files from the folder
          filesToToggle.forEach((path) => currentSelectedSet.add(path));
        } else {
          // Remove files from the folder
          filesToToggle.forEach((path) => currentSelectedSet.delete(path));
        }
        return Array.from(currentSelectedSet);
      });
    },
    [allFiles]
  ); // Depends on allFiles to know which files are in the folder

  const calculateTotalTokens = () => {
    const selectedSet = new Set(selectedFiles.map(normalizePath));
    return allFiles.reduce((total, file) => {
      if (
        !file.isBinary &&
        !file.isSkipped &&
        selectedSet.has(normalizePath(file.path))
      ) {
        return total + (file.tokenCount || 0);
      }
      return total;
    }, 0);
  };

  const getSelectedFilesContent = () => {
    const selectedSet = new Set(selectedFiles.map(normalizePath));
    const filesToInclude = allFiles.filter(
      (file) =>
        !file.isBinary &&
        !file.isSkipped &&
        selectedSet.has(normalizePath(file.path))
    );

    // Sort the *filtered* list according to current sort order
    const [sortKey, sortDir] = sortOrder.split("-");
    const sortedSelected = [...filesToInclude].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "name") comparison = a.name.localeCompare(b.name);
      else if (sortKey === "tokens") comparison = a.tokenCount - b.tokenCount;
      else if (sortKey === "size") comparison = a.size - b.size;
      else if (sortKey === "path") comparison = comparePaths(a.path, b.path);
      return sortDir === "asc" ? comparison : -comparison;
    });

    if (sortedSelected.length === 0) return "No files selected.";

    let concatenatedString = "";
    if (includeFileTree && selectedFolder) {
      const asciiTree = generateAsciiFileTree(sortedSelected, selectedFolder);
      concatenatedString += `Project structure:\n${normalizePath(
        selectedFolder
      )}\n${asciiTree}\n`;
    }

    sortedSelected.forEach((file) => {
      const relativePath = normalizePath(file.path).substring(
        normalizePath(selectedFolder!).length + 1
      );
      concatenatedString += `\n#### File: ${relativePath}\n\n`;
      concatenatedString += file.content;
    });

    return concatenatedString;
  };

  const selectAllFiles = () => {
    const selectablePaths = displayedFiles // Select based on *displayed* files
      .filter((file) => !file.isBinary && !file.isSkipped)
      .map((file) => normalizePath(file.path));

    setSelectedFiles((prev) => {
      const newSelected = new Set([...prev, ...selectablePaths]);
      return Array.from(newSelected);
    });
  };

  const deselectAllFiles = () => {
    const displayedPathsSet = new Set(
      displayedFiles.map((file) => normalizePath(file.path))
    );
    setSelectedFiles((prev) =>
      prev.filter((path) => !displayedPathsSet.has(normalizePath(path)))
    );
  };

  const toggleExpanded = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const newState = { ...prev, [nodeId]: !prev[nodeId] };
      // Persistence is handled by the useEffect hook for expandedNodes
      return newState;
    });
  }, []); // Depends only on setExpandedNodes

  const selectRecentFolder = (folderPath: string) => {
    if (!folderPath || !isElectron) return;
    // This will trigger the handleFolderSelectedIPC via state change & useEffect
    setSelectedFolder(normalizePath(folderPath));
  };

  const removeRecentFolder = (folderPath: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const normalizedPath = normalizePath(folderPath);
    setRecentFolders((prev) =>
      prev.filter((path) => !arePathsEqual(path, normalizedPath))
    );
  };

  const handleExitFolder = () => {
    // Save current state before exiting? Optional.
    // saveProjectState(selectedFolder, { selectedFiles, expandedNodes, ... });

    setSelectedFolder(null); // This triggers removal of the global key via useEffect
    // Reset volatile state
    setAllFiles([]);
    setDisplayedFiles([]);
    setProcessingStatus({ status: "idle", message: "" });
    // Reset states to default by loading null project state
    const defaultState = loadInitialState(null);
    setSelectedFiles(defaultState.selectedFiles);
    setExpandedNodes(defaultState.expandedNodes);
    setSortOrder(defaultState.sortOrder);
    setSearchTerm(defaultState.searchTerm);
    setFileListView(defaultState.fileListView);
  };

  // Handle clicks outside sort dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(event.target as Node)
      ) {
        setSortDropdownOpen(false);
      }
    };
    if (sortDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sortDropdownOpen]);

  // Sort options definition (moved outside render for stability)
  const sortOptions = [
    {
      value: "path-asc",
      label: "Structure (A-Z)",
      icon: <FolderUp size={16} />,
      description: "Structure (A-Z)",
    },
    {
      value: "path-desc",
      label: "Structure (Z-A)",
      icon: <FolderDown size={16} />,
      description: "Structure (Z-A)",
    },
    {
      value: "tokens-asc",
      label: "Tokens (Low-High)",
      icon: <ChartNoAxesColumnIncreasingIcon size={16} />,
      description: "Tokens (Low-High)",
    },
    {
      value: "tokens-desc",
      label: "Tokens (High-Low)",
      icon: <ChartNoAxesColumnDecreasingIcon size={16} />,
      description: "Tokens (High-Low)",
    },
    {
      value: "name-asc",
      label: "Name (A-Z)",
      icon: <SortAsc size={16} />,
      description: "Name (A-Z)",
    },
    {
      value: "name-desc",
      label: "Name (Z-A)",
      icon: <SortDesc size={16} />,
      description: "Name (Z-A)",
    },
  ];
  const currentSortIcon = sortOptions.find((opt) => opt.value === sortOrder)
    ?.icon || <ArrowUpDown size={16} />;
  const currentSortDesc =
    sortOptions.find((opt) => opt.value === sortOrder)?.description || "Sort";

  // --- Render ---
  return (
    <ThemeProvider>
      <div className="app-container">
        {/* Processing/Error Indicators */}
        {processingStatus.status === "processing" && (
          <div className="processing-indicator">
            <div className="spinner"></div>
            <span>{processingStatus.message}</span>
          </div>
        )}
        {processingStatus.status === "error" && (
          <div className="error-message">Error: {processingStatus.message}</div>
        )}

        {/* Initial Screen */}
        {!selectedFolder && processingStatus.status !== "processing" && (
          <div className="initial-prompt">
            <div className="initial-prompt-content">
              <div className="initial-header">
                <h2>PasteMax</h2>
                <div className="initial-actions">
                  <ThemeToggle />
                  <button
                    className="select-folder-btn large"
                    onClick={openFolder}
                  >
                    <FolderOpen size={16} />
                    <span>Select Folder</span>
                  </button>
                </div>
              </div>
              {recentFolders.length > 0 && (
                <div className="recent-folders-section">
                  <div className="recent-folders-title">Recent folders</div>
                  <ul className="recent-folders-list">
                    {recentFolders.map((folderPath) => (
                      <button
                        key={folderPath}
                        className="recent-folder-item"
                        onClick={() => selectRecentFolder(folderPath)}
                        title={folderPath}
                      >
                        <div className="recent-folder-content">
                          <span className="recent-folder-name">
                            {basename(folderPath)}
                          </span>
                          <span className="recent-folder-path">
                            {folderPath}
                          </span>
                        </div>
                        <button
                          className="recent-folder-delete"
                          onClick={(e) => removeRecentFolder(folderPath, e)}
                          title="Remove from recents"
                        >
                          <X size={16} />
                        </button>
                      </button>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main App View */}
        {selectedFolder && (
          <div className="main-content">
            <Sidebar
              selectedFolder={selectedFolder}
              openFolder={openFolder}
              allFiles={allFiles}
              selectedFiles={selectedFiles}
              toggleFileSelection={toggleFileSelection}
              toggleFolderSelection={toggleFolderSelection}
              searchTerm={searchTerm}
              onSearchChange={handleSearchChange}
              selectAllFiles={selectAllFiles}
              deselectAllFiles={deselectAllFiles}
              refreshFolder={refreshFolder} // Use the updated refresh
              reloadFolder={reloadFolder} // Use the updated reload
              expandedNodes={expandedNodes}
              toggleExpanded={toggleExpanded}
            />
            <div className="content-area">
              <div className="content-header">
                <h1>PasteMax</h1>
                <div className="header-actions">
                  <ThemeToggle />
                  <div className="folder-info">
                    <div className="selected-folder" title={selectedFolder}>
                      {basename(selectedFolder)}
                    </div>
                    <button
                      className="select-folder-btn"
                      onClick={openFolder}
                      disabled={processingStatus.status === "processing"}
                      title="Select Different Folder"
                    >
                      {" "}
                      <FolderOpen size={16} />{" "}
                    </button>
                    <button
                      className="select-folder-btn"
                      onClick={reloadFolder}
                      disabled={processingStatus.status === "processing"}
                      title="Reload Folder"
                    >
                      {" "}
                      <RefreshCw size={16} />{" "}
                    </button>
                    <button
                      className="select-folder-btn"
                      onClick={handleExitFolder}
                      title="Exit Folder"
                    >
                      {" "}
                      <LogOut size={16} />{" "}
                    </button>
                  </div>
                </div>
              </div>
              <div className="content-header">
                <div className="content-title">Selected Files</div>
                <div className="content-actions">
                  <FileListToggle
                    view={fileListView}
                    onChange={handleViewChange}
                  />
                  <div className="sort-dropdown" ref={sortDropdownRef}>
                    <button
                      className="sort-dropdown-button"
                      onClick={toggleSortDropdown}
                      title={`Sort by: ${currentSortDesc}`}
                    >
                      {currentSortIcon}
                      <ArrowUpDown size={13} />
                    </button>
                    {sortDropdownOpen && (
                      <div className="sort-options">
                        {sortOptions.map((option) => (
                          <div
                            key={option.value}
                            className={`sort-option ${
                              sortOrder === option.value ? "active" : ""
                            }`}
                            onClick={() => handleSortChange(option.value)}
                            title={option.description}
                          >
                            {option.icon}
                            <span>{option.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="file-stats">
                    {selectedFiles.length} files | ~
                    {calculateTotalTokens().toLocaleString()} tokens
                  </div>
                </div>
              </div>

              <FileList
                files={displayedFiles} // Pass only displayed files relevant for the card view
                selectedFiles={selectedFiles} // Still needed by FileList logic
                toggleFileSelection={toggleFileSelection} // Pass down for remove action
                selectedFolder={selectedFolder}
                view={fileListView} // Pass down the view
              />

              <div className="copy-button-container">
                <FileTreeToggle
                  checked={includeFileTree}
                  onChange={() => setIncludeFileTree(!includeFileTree)}
                />
                <CopyButton
                  text={getSelectedFilesContent()}
                  className="primary copy-files-btn"
                >
                  <span>COPY ({selectedFiles.length} files)</span>
                </CopyButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
};

export default App;
```

**3. Update `src/components/FileList.tsx` (Minor change):**

The `FileList` component should display cards for the files that are currently _selected_. We already filter `displayedFiles` based on search/sort in `App.tsx`, but `FileList` itself should filter based on `selectedFiles`.

```typescript
import React from "react";
import { FileListProps, FileData } from "../types/FileTypes";
import FileCard from "./FileCard";
import { arePathsEqual, normalizePath } from "../utils/pathUtils"; // Ensure normalizePath is imported

interface ExtendedFileListProps extends FileListProps {
  view: "structured" | "flat";
  // Pass allFiles down to find the correct file objects based on selected paths
  allFiles: FileData[];
}

const FileList = ({
  // files, // We don't need the pre-filtered displayedFiles here
  allFiles, // Use allFiles to find the selected ones
  selectedFiles,
  toggleFileSelection,
  selectedFolder,
  view,
}: ExtendedFileListProps) => {
  // Create a Set of normalized selected paths for efficient lookup
  const selectedPathsSet = new Set(selectedFiles.map(normalizePath));

  // Find the actual FileData objects corresponding to the selected paths from allFiles
  const filesToDisplay = allFiles.filter(
    (file) =>
      !file.isBinary &&
      !file.isSkipped &&
      selectedPathsSet.has(normalizePath(file.path))
  );

  // Optional: Sort the filesToDisplay based on the current sort order if needed within the FileList itself
  // (Or rely on the order preserved from the selection/sorting logic in App.tsx)

  return (
    <div className="file-list-container">
      {/* Optional: Add header back if needed
       <div className="file-list-container-header">
         {filesToDisplay.length} Selected Files ({view} view)
       </div>
       */}
      {filesToDisplay.length > 0 ? (
        <div className={`file-list view-${view}`}>
          {" "}
          {/* Add view class */}
          {filesToDisplay.map((file: FileData) => (
            <FileCard
              key={file.path} // Use path as key
              file={file}
              isSelected={true} // All files shown here are selected
              toggleSelection={toggleFileSelection} // Pass down the toggle function
              selectedFolder={selectedFolder}
            />
          ))}
        </div>
      ) : (
        <div className="file-list-empty">
          {allFiles.length > 0
            ? "No files selected. Select files from the sidebar."
            : selectedFolder
            ? "Loading files or folder is empty." // More informative message
            : "Select a folder to view files."}
        </div>
      )}
    </div>
  );
};

export default FileList;
```

**4. Update `src/components/Sidebar.tsx`:**

Ensure `SidebarProps` includes `reloadFolder` if it wasn't already there. The `Sidebar` component itself doesn't need major changes for this logic, as the state management happens in `App.tsx`. Just pass down the new `reloadFolder` function if needed by any buttons inside the Sidebar.

```typescript
// src/types/FileTypes.ts - Make sure reloadFolder is in SidebarProps
export interface SidebarProps {
  // ... other props
  refreshFolder: () => void;
  reloadFolder: () => void; // Add this if not present
  expandedNodes: Record<string, boolean>;
  toggleExpanded: (nodeId: string) => void;
}

// src/components/Sidebar.tsx - Pass reloadFolder down if used inside
const Sidebar = ({
  // ... other props
  refreshFolder,
  reloadFolder, // Destructure it
  // ... rest
}: SidebarProps) => {
    // ... existing code ...

    // Example if you add a reload button inside the sidebar:
    // <button onClick={reloadFolder}>Reload</button>

    return (
       // ... JSX ...
    );
}
```

**Explanation of Changes:**

1.  **`storageUtils.ts`:** Encapsulates all `localStorage` interactions for project states. It handles reading the main state object, getting state for a specific project (with defaults), and updating properties or the entire state for a project. Paths are normalized for consistency.
2.  **`App.tsx` State Initialization:** Reads the last selected folder path globally, then uses `loadInitialState` to get the specific state for _that_ folder, providing defaults.
3.  **`App.tsx` Persistence:** `useEffect` hooks now call `updateProjectProperty` to save state changes _under the currently selected folder's key_ within the main storage object.
4.  **Folder Switching (`handleFolderSelectedIPC`, `selectRecentFolder`):** When the folder changes, the component now loads the specific state associated with the _new_ folder from `localStorage`.
5.  **`refreshOrReloadFolder`:** This unified function handles both refresh and reload. It grabs the _current_ `selectedFiles` state, sets up a _temporary, one-time_ IPC listener (`handleDataForRefresh`), sends the request, and when the data comes back, the temporary listener restores the selection based on the preserved list and the _new_ file data, then removes itself. This ensures selections are preserved correctly.
6.  **System Reload:** Because state is loaded based on the `selectedFolder` path from the per-project storage, restarting the renderer automatically loads the correct state for the folder that was last open.
7.  **`FileList.tsx`:** Updated to filter based on `selectedFiles` directly from `allFiles` to ensure it always shows the currently selected items.
8.  **Callbacks:** Used `useCallback` for functions passed down as props (`toggleFileSelection`, `toggleFolderSelection`, etc.) where appropriate to optimize rendering.

This structure isolates project states, ensures selections persist across reloads, and keeps the `App.tsx` component focused on managing state and coordinating actions, while `storageUtils.ts` handles the persistence details.

ODGOVOR GEMINI 2.5 MODELA - KONEC:

MOJA DODATNA NAVODILA ZATE CURSOR - ZACETEK:

Gemini model je torej pripravil nacrt za implementacijo. Ti imas svojo pamet in znanje zato lahko uporabis
njegova navodila za implementacijo a hkrati ,ce bos ugotovil, da si nasel kaksno napako ali kaksno boljso resitev
jo popravi in izboljsaj.

MOJA DODATNA NAVODILA ZATE CURSOR - KONEC:
