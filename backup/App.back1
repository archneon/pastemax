import React, {
  useState,
  useEffect,
  MouseEvent,
  useRef,
  RefObject,
  useCallback,
} from "react";
import Sidebar from "./components/Sidebar";
import FileList from "./components/FileList";
import CopyButton from "./components/CopyButton";
import FileTreeToggle from "./components/FileTreeToggle";
import { FileData } from "./types/FileTypes";
import { ThemeProvider } from "./context/ThemeContext";
import ThemeToggle from "./components/ThemeToggle";
import FileListToggle from "./components/FileListToggle";
import logger from "./utils/logger";
import {
  generateAsciiFileTree,
  normalizePath,
  arePathsEqual,
  comparePaths,
  comparePathsStructurally,
  basename,
  getRelativePath,
} from "./utils/pathUtils";
import {
  getLastSelectedFolder,
  saveLastSelectedFolder,
  loadInitialState,
  updateProjectProperty,
  getProjectState,
  saveProjectState,
  loadRecentFolders,
  saveRecentFolders,
} from "./utils/storageUtils";
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
import {
  MAX_RECENT_FOLDERS,
  PROMPT_SECTIONS,
  PROMPT_MARKERS,
  PROJECT_TREE_CONFIG,
  LOCAL_STORAGE_KEYS,
  DESCRIPTIONS_DIR,
  OVERVIEW_FILENAME,
  DEFAULT_INCLUDE_FILE_TREE_GLOBAL,
  DEFAULT_INCLUDE_PROMPT_OVERVIEW_GLOBAL,
} from "./constants";
import { PromptSectionDefinition } from "./types/promptConfigTypes";

// Add render counter for debugging
let renderCount = 0;
// Track session ID to distinguish between multiple module loads (hot reloading)
const APP_INSTANCE_ID = Math.random().toString(36).substring(2, 8);

logger.info(
  `App.tsx component function starting (instance: ${APP_INSTANCE_ID})`
);

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

// Define categorizeFile function outside the component to avoid reference issues
const categorizeFile = (
  file: FileData,
  currentSelectedFolder: string | null,
  sections: PromptSectionDefinition[]
): string => {
  const defaultSection = sections.find((s) => s.directory === null);
  const defaultSectionId = defaultSection?.id || "project_files";

  // Special files don't get categorized by path for content sections
  if (
    file.descriptionForSectionId ||
    file.isOverviewTemplate ||
    file.isProjectTreeDescription ||
    !currentSelectedFolder
  ) {
    return defaultSectionId; // Assign default, won't be treated as content file anyway
  }

  const relativePath = getRelativePath(file.path, currentSelectedFolder);
  if (!relativePath) {
    return defaultSectionId;
  }

  for (const section of sections) {
    if (section.directory) {
      if (
        relativePath === section.directory ||
        relativePath.startsWith(section.directory + "/")
      ) {
        return section.id;
      }
    }
  }
  return defaultSectionId;
};

const App = () => {
  // Track the number of renders for diagnostic help
  renderCount++;
  // At the beginning of each render, log data for debugging
  logger.debug(`App render #${renderCount} (instance: ${APP_INSTANCE_ID})`);

  // Define the type for lastSelectedFolder
  const lastSelectedFolder = getLastSelectedFolder();
  // Use the appropriately typed initial value without explicit typing in useState
  const [selectedFolder, setSelectedFolder] = useState(lastSelectedFolder);

  // References for tracking file loading requests
  const initialLoadTriggered = useRef(false);
  const lastRequestedFolder = useRef(null);

  // Load initial state for the currently selected folder
  const initialState = loadInitialState(selectedFolder);

  const [allFiles, setAllFiles] = useState([] as FileData[]);
  const [selectedFiles, setSelectedFiles] = useState(
    initialState.selectedFiles
  );
  const [sortOrder, setSortOrder] = useState(initialState.sortOrder);
  const [searchTerm, setSearchTerm] = useState(initialState.searchTerm);
  const [fileListView, setFileListView] = useState(
    initialState.fileListView as "structured" | "flat"
  );
  const [expandedNodes, setExpandedNodes] = useState(
    initialState.expandedNodes
  );
  const [displayedFiles, setDisplayedFiles] = useState([] as FileData[]);

  // Define the type for the status object
  type ProcessingStatus = {
    status: "idle" | "processing" | "complete" | "error";
    message: string;
  };

  // Use this type with useState
  const [processingStatus, setProcessingStatus] = useState({
    status: "idle" as const,
    message: "",
  } satisfies ProcessingStatus);

  const [includeFileTree, setIncludeFileTree] = useState(
    initialState.includeFileTree
  );
  const [includePromptOverview, setIncludePromptOverview] = useState(
    initialState.includePromptOverview
  );
  const [recentFolders, setRecentFolders] = useState(loadRecentFolders());

  // State for sort dropdown
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  // More direct use of useRef
  const sortDropdownRef = useRef(null);

  // Check if we're running in Electron or browser environment
  const isElectron = window.electron !== undefined;

  // Format marker helper function
  const formatMarker = useCallback(
    (
      template: string,
      context: { section_name?: string; file_path?: string }
    ): string => {
      let result = template;
      if (context.section_name !== undefined)
        result = result.replace("{section_name}", context.section_name);
      if (context.file_path !== undefined)
        result = result.replace("{file_path}", context.file_path);
      return result;
    },
    []
  );

  // Get selected files content
  const getSelectedFilesContent = useCallback(() => {
    // 1. Filter for *selected* files that are actual content (not binary, skipped, special)
    const contentFiles = allFiles.filter(
      (file: FileData) =>
        selectedFiles.includes(file.path) &&
        !file.isBinary &&
        !file.isSkipped &&
        !file.descriptionForSectionId &&
        !file.isOverviewTemplate &&
        !file.isProjectTreeDescription
    );

    // 2. Find special files (descriptions, overview) from *all* files
    const descriptionMap: Record<string, string> = {}; // Key: sectionId or 'project_tree'
    let overviewContent: string | null = null;
    allFiles.forEach((file: FileData) => {
      if (file.content) {
        // Ensure content exists
        if (file.descriptionForSectionId) {
          descriptionMap[file.descriptionForSectionId] = file.content;
        } else if (file.isProjectTreeDescription) {
          descriptionMap["project_tree"] = file.content; // Use special key
        } else if (file.isOverviewTemplate) {
          overviewContent = file.content;
        }
      }
    });

    // Early exit if nothing to output
    if (
      contentFiles.length === 0 &&
      !includeFileTree &&
      !includePromptOverview
    ) {
      return "No text files selected, or tree/overview not included.";
    }

    // 3. Sort content files based on UI settings
    const [sortKey, sortDir] = sortOrder.split("-");
    const sortedContentFiles = [...contentFiles].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "name") comparison = a.name.localeCompare(b.name);
      else if (sortKey === "tokens") comparison = a.tokenCount - b.tokenCount;
      else if (sortKey === "size") comparison = a.size - b.size;
      else if (sortKey === "path")
        comparison = comparePathsStructurally(a.path, b.path, selectedFolder);
      return sortDir === "asc" ? comparison : -comparison;
    });

    // --- Build Output ---
    let output = "";
    const markers = PROMPT_MARKERS;

    // 4. Add Overview (if enabled and content exists)
    if (includePromptOverview && overviewContent) {
      output += "==== SYSTEM_PROMPT_OVERVIEW ====\n";
      const contentString = String(overviewContent); // Explicitly convert to string
      output += contentString.trim() + "\n\n"; // Trim just in case, add spacing
    }

    // 5. Add Project Tree (if enabled)
    if (includeFileTree && selectedFolder) {
      const treeSectionName = PROJECT_TREE_CONFIG.name;
      const treeDescription = descriptionMap["project_tree"];

      output +=
        formatMarker(markers.section_open, { section_name: treeSectionName }) +
        "\n";
      if (treeDescription) {
        output += markers.description_open + "\n";
        output += String(treeDescription).trim() + "\n";
        output += markers.description_close + "\n\n";
      }
      // Generate tree from the *selected content* files
      output += ".\n"; // root directory indicator
      const asciiTree = generateAsciiFileTree(
        sortedContentFiles,
        selectedFolder
      );
      output += asciiTree + "\n";
      output +=
        formatMarker(markers.section_close, { section_name: treeSectionName }) +
        "\n\n";
    }

    // 6. Group sorted content files by sectionId
    const filesBySection: Record<string, FileData[]> = {};
    const defaultSectionId =
      PROMPT_SECTIONS.find((s) => s.directory === null)?.id || "project_files";
    sortedContentFiles.forEach((file) => {
      const sectionId = file.sectionId || defaultSectionId;
      if (!filesBySection[sectionId]) filesBySection[sectionId] = [];
      filesBySection[sectionId].push(file);
    });

    // 7. Iterate through sections IN DEFINED ORDER
    for (const section of PROMPT_SECTIONS) {
      const sectionFiles = filesBySection[section.id];
      if (!sectionFiles || sectionFiles.length === 0) continue; // Skip empty sections

      // --- Section Start ---
      output +=
        formatMarker(markers.section_open, { section_name: section.name }) +
        "\n\n";

      // --- Description ---
      const description = descriptionMap[section.id];
      if (description) {
        output += markers.description_open + "\n";
        output += String(description).trim() + "\n";
        output += markers.description_close + "\n\n";
      }

      // --- Files ---
      sectionFiles.forEach((file) => {
        const relativePath = getRelativePath(file.path, selectedFolder);
        output +=
          formatMarker(markers.file_open, { file_path: relativePath }) + "\n";
        output += file.content; // Raw content
        if (file.content && !file.content.endsWith("\n")) output += "\n"; // Ensure newline before end marker
        output +=
          formatMarker(markers.file_close, { file_path: relativePath }) +
          "\n\n";
      });

      // --- Section End ---
      output +=
        formatMarker(markers.section_close, { section_name: section.name }) +
        "\n\n";
    }

    return output.trim();
  }, [
    allFiles,
    selectedFiles,
    sortOrder,
    selectedFolder,
    includeFileTree,
    includePromptOverview,
    formatMarker,
  ]);

  // Update recent folders list - define the function first
  const updateRecentFolders = useCallback((folderPath: string) => {
    if (!folderPath) return;

    setRecentFolders((prev: string[]) => {
      // Remove duplicate paths
      const filtered = prev.filter(
        (path: string) => !arePathsEqual(path, folderPath)
      );
      // Add the new path to the beginning and limit the number to MAX_RECENT_FOLDERS
      return [normalizePath(folderPath), ...filtered].slice(
        0,
        MAX_RECENT_FOLDERS
      );
    });
  }, []);

  // Apply filters and sorting to files - convert to useCallback for correct referencing
  const applyFiltersAndSort = useCallback(
    (files: FileData[], sort: string, filter: string) => {
      let filtered = files;

      // Apply filter
      if (filter) {
        const lowerFilter = filter.toLowerCase();
        filtered = files.filter(
          (file) =>
            file.name.toLowerCase().includes(lowerFilter) ||
            file.path.toLowerCase().includes(lowerFilter)
        );
      }

      // Apply sort
      const [sortKey, sortDir] = sort.split("-");
      const sorted = [...filtered].sort((a, b) => {
        let comparison = 0;

        if (sortKey === "name") {
          comparison = a.name.localeCompare(b.name);
        } else if (sortKey === "tokens") {
          comparison = a.tokenCount - b.tokenCount;
        } else if (sortKey === "size") {
          comparison = a.size - b.size;
        } else if (sortKey === "path") {
          comparison = comparePathsStructurally(a.path, b.path, selectedFolder);
        }

        return sortDir === "asc" ? comparison : -comparison;
      });

      setDisplayedFiles(sorted);
    },
    [selectedFolder]
  );

  // Move and stabilize handler functions with useCallback, outside useEffect
  const handleFolderSelected = useCallback(
    (folderPath: string) => {
      if (typeof folderPath === "string") {
        logger.info(
          `Folder selected: ${folderPath} (render #${renderCount}, instance: ${APP_INSTANCE_ID})`
        );
        const normalizedPath = normalizePath(folderPath);

        // First, set the newly selected folder
        setSelectedFolder(normalizedPath);

        // Load the state for the new folder from localStorage
        const newState = loadInitialState(normalizedPath);
        setSelectedFiles(newState.selectedFiles);
        setExpandedNodes(newState.expandedNodes);
        setSortOrder(newState.sortOrder);
        setSearchTerm(newState.searchTerm);
        setFileListView(newState.fileListView);
        setIncludeFileTree(newState.includeFileTree);
        setIncludePromptOverview(newState.includePromptOverview);

        // Clear the file lists
        setAllFiles([]);
        setDisplayedFiles([]);

        // Set the status and request the file list
        setProcessingStatus({
          status: "processing",
          message: "Requesting file list...",
        });

        // Update our request tracking references
        lastRequestedFolder.current = normalizedPath;

        // Send the request with the new structure
        window.electron.ipcRenderer.send("request-file-list", {
          path: normalizedPath,
          forceRefresh: false,
        });

        // Update recent folders when a new folder is selected
        updateRecentFolders(normalizedPath);
      } else {
        logger.error(
          `Invalid folder path received: ${folderPath} (render #${renderCount})`
        );
        setProcessingStatus({
          status: "error",
          message: "Invalid folder path received",
        });
      }
    },
    [updateRecentFolders, loadInitialState]
  );

  const handleFileListData = useCallback(
    (receivedFiles: FileData[]) => {
      logger.info(
        `Received file list data: ${receivedFiles.length} files (render #${renderCount}, instance: ${APP_INSTANCE_ID})`
      );

      // IMPORTANT: Reload the project state before using the received files
      // This ensures we have the latest values for all settings after Force Reload
      if (selectedFolder) {
        const currentState = loadInitialState(selectedFolder);

        // Update all values from localStorage
        setSelectedFiles(currentState.selectedFiles);
        setExpandedNodes(currentState.expandedNodes);
        setSortOrder(currentState.sortOrder);
        setSearchTerm(currentState.searchTerm);
        setFileListView(currentState.fileListView);
        setIncludeFileTree(currentState.includeFileTree);
        setIncludePromptOverview(currentState.includePromptOverview);
        logger.info(
          `State reloaded from localStorage: {selectedFiles: ${currentState.selectedFiles.length}, includeFileTree: ${currentState.includeFileTree}, includePromptOverview: ${currentState.includePromptOverview}} (render #${renderCount})`
        );
      }

      // Continue with the normal processing of received files
      const categorizedFiles = receivedFiles.map((file) => ({
        ...file,
        sectionId: categorizeFile(file, selectedFolder, PROMPT_SECTIONS),
      }));
      setAllFiles(categorizedFiles);
      setProcessingStatus({
        status: "complete",
        message: `Found ${categorizedFiles.length} files`,
      });
      applyFiltersAndSort(categorizedFiles, sortOrder, searchTerm);
      logger.debug(
        `Building file tree from ${categorizedFiles.length} files (render #${renderCount})`
      );
    },
    [
      selectedFolder,
      sortOrder,
      searchTerm,
      applyFiltersAndSort,
      loadInitialState, // Added dependency
    ]
  );

  const handleProcessingStatus = useCallback(
    (status: {
      status: "idle" | "processing" | "complete" | "error";
      message: string;
    }) => {
      logger.info(
        `Processing status: ${JSON.stringify(
          status
        )} (render #${renderCount}, instance: ${APP_INSTANCE_ID})`
      );
      setProcessingStatus(status);
    },
    []
  );

  // Existing useEffect for IPC listener - now just registers/unregisters callbacks
  // and use a reference to a single listener for each channel
  useEffect(() => {
    if (!isElectron) return;

    // Add information for debugging
    logger.debug(
      `Setting up IPC listeners (render #${renderCount}, instance: ${APP_INSTANCE_ID})`
    );

    // Set references to all our listeners
    // React StrictMode is off, but use the same references just in case
    const folderSelectedHandler = handleFolderSelected;
    const fileListDataHandler = handleFileListData;
    const processingStatusHandler = handleProcessingStatus;

    // Register all listeners
    logger.debug("Registering IPC listeners - start");
    window.electron.ipcRenderer.on("folder-selected", folderSelectedHandler);
    logger.debug("Registered IPC listener: folder-selected");

    window.electron.ipcRenderer.on("file-list-data", fileListDataHandler);
    logger.debug("Registered IPC listener: file-list-data");

    window.electron.ipcRenderer.on(
      "file-processing-status",
      processingStatusHandler
    );
    logger.debug("Registered IPC listener: file-processing-status");
    logger.debug("Registering IPC listeners - end");

    // Cleanup function - remove listeners
    return () => {
      logger.debug(
        `Cleaning up IPC listeners (render #${renderCount}, instance: ${APP_INSTANCE_ID})`
      );

      window.electron.ipcRenderer.removeListener(
        "folder-selected",
        folderSelectedHandler
      );
      logger.debug("Removed IPC listener: folder-selected");

      window.electron.ipcRenderer.removeListener(
        "file-list-data",
        fileListDataHandler
      );
      logger.debug("Removed IPC listener: file-list-data");

      window.electron.ipcRenderer.removeListener(
        "file-processing-status",
        processingStatusHandler
      );
      logger.debug("Removed IPC listener: file-processing-status");
    };
  }, [
    isElectron,
    handleFolderSelected,
    handleFileListData,
    handleProcessingStatus,
  ]);

  // Persist selected folder when it changes
  useEffect(() => {
    saveLastSelectedFolder(selectedFolder);
  }, [selectedFolder]);

  // Persist selected files when they change
  useEffect(() => {
    updateProjectProperty(selectedFolder, "selectedFiles", selectedFiles);
  }, [selectedFiles, selectedFolder]);

  // Persist sort order when it changes
  useEffect(() => {
    updateProjectProperty(selectedFolder, "sortOrder", sortOrder);
  }, [sortOrder, selectedFolder]);

  // Persist search term when it changes
  useEffect(() => {
    updateProjectProperty(selectedFolder, "searchTerm", searchTerm);
  }, [searchTerm, selectedFolder]);

  // Persist file list view when it changes
  useEffect(() => {
    updateProjectProperty(selectedFolder, "fileListView", fileListView);
  }, [fileListView, selectedFolder]);

  // Persist expanded nodes when they change
  useEffect(() => {
    updateProjectProperty(selectedFolder, "expandedNodes", expandedNodes);
  }, [expandedNodes, selectedFolder]);

  // Persist include file tree setting when it changes
  useEffect(() => {
    updateProjectProperty(selectedFolder, "includeFileTree", includeFileTree);
  }, [includeFileTree, selectedFolder]);

  // Persist include prompt overview setting when it changes
  useEffect(() => {
    updateProjectProperty(
      selectedFolder,
      "includePromptOverview",
      includePromptOverview
    );
  }, [includePromptOverview, selectedFolder]);

  // Persist recent folders when they change
  useEffect(() => {
    saveRecentFolders(recentFolders);
  }, [recentFolders]);

  // Load initial data from saved folder
  useEffect(() => {
    if (!isElectron || !selectedFolder) {
      logger.debug(
        `Not loading initial folder data - isElectron: ${isElectron}, selectedFolder: ${
          selectedFolder || "null"
        }`
      );
      return;
    }

    // Check if a reload was requested (after CTRL+R)
    const wasRefreshRequested =
      localStorage.getItem("__force_refresh_requested") === "true";
    if (wasRefreshRequested) {
      logger.info(
        `Detected page refresh, will force reload folder: ${selectedFolder}`
      );
      // Remove the flag so it doesn't cause additional reloads
      localStorage.removeItem("__force_refresh_requested");
    }

    // Add diagnostic information
    logger.debug(
      `Initial folder loading effect (render #${renderCount}, instance: ${APP_INSTANCE_ID})`
    );
    logger.debug(
      `initialLoadTriggered: ${
        initialLoadTriggered.current
      }, lastRequestedFolder: ${
        lastRequestedFolder.current || "null"
      }, forceRefresh: ${wasRefreshRequested}`
    );

    // Prevent duplicate loading, EXCEPT if force refresh was requested
    if (
      initialLoadTriggered.current &&
      lastRequestedFolder.current === selectedFolder &&
      !wasRefreshRequested
    ) {
      logger.debug(
        `Skipping duplicate load for folder: ${selectedFolder} (render #${renderCount})`
      );
      return;
    }

    logger.info(
      `Loading saved folder on startup: ${selectedFolder} (render #${renderCount})`
    );
    setProcessingStatus({
      status: "processing",
      message: wasRefreshRequested
        ? "Reloading folder after page refresh..."
        : "Loading files from previously selected folder...",
    });

    // Mark this folder as requested
    initialLoadTriggered.current = true;
    lastRequestedFolder.current = selectedFolder;

    // Send the request for the file list with the appropriate structure
    logger.debug(`Sending initial request-file-list for ${selectedFolder}`);
    window.electron.ipcRenderer.send("request-file-list", {
      path: selectedFolder,
      forceRefresh: wasRefreshRequested,
    });

    // Update recent folders when loading initial folder
    updateRecentFolders(selectedFolder);
  }, [isElectron, selectedFolder, updateRecentFolders]);

  const openFolder = () => {
    if (isElectron) {
      logger.info("Opening folder dialog");
      setProcessingStatus({ status: "idle", message: "Select a folder..." });
      window.electron.ipcRenderer.send("open-folder");
    } else {
      logger.warn("Folder selection not available in browser");
    }
  };

  // Toggle file selection
  const toggleFileSelection = useCallback((filePath: string) => {
    // Normalize the incoming file path to handle cross-platform issues
    const normalizedPath = normalizePath(filePath);

    setSelectedFiles((prev: string[]) => {
      // Check if the file is already selected
      const isSelected = prev.some((path) =>
        arePathsEqual(path, normalizedPath)
      );

      if (isSelected) {
        // Remove the file from selected files
        const newSelection = prev.filter(
          (path: string) => !arePathsEqual(path, normalizedPath)
        );
        return newSelection;
      } else {
        // Add the file to selected files
        const newSelection = [...prev, normalizedPath];
        return newSelection;
      }
    });
  }, []);

  // Toggle folder selection (select/deselect all files in folder)
  const toggleFolderSelection = useCallback(
    (folderPath: string, isSelected: boolean) => {
      // Normalize the folder path
      const normalizedFolderPath = normalizePath(folderPath);

      const filesInFolder = allFiles.filter(
        (file: FileData) =>
          normalizePath(file.path).startsWith(normalizedFolderPath) &&
          !file.isBinary &&
          !file.isSkipped
      );

      if (isSelected) {
        // Add all files from this folder that aren't already selected
        const filePaths = filesInFolder.map((file: FileData) =>
          normalizePath(file.path)
        );

        setSelectedFiles((prev: string[]) => {
          const newSelection = [...prev];
          filePaths.forEach((path: string) => {
            if (!newSelection.some((p) => arePathsEqual(p, path))) {
              newSelection.push(path);
            }
          });
          return newSelection;
        });
      } else {
        // Remove all files from this folder
        setSelectedFiles((prev: string[]) => {
          const newSelection = prev.filter(
            (path: string) =>
              !filesInFolder.some((file: FileData) =>
                arePathsEqual(normalizePath(file.path), path)
              )
          );
          return newSelection;
        });
      }
    },
    [allFiles]
  );

  // Generic function for refresh/reload behavior (preserves selection)
  const refreshOrReloadFolder = useCallback(
    (action: "refresh" | "reload") => {
      if (!selectedFolder || !isElectron) return;

      logger.info(
        `${
          action === "refresh" ? "Refreshing" : "Reloading"
        } folder: ${selectedFolder}`
      );
      setProcessingStatus({
        status: "processing",
        message: `${
          action === "refresh" ? "Refreshing" : "Reloading"
        } folder...`,
      });

      // Important: save the current state of selected files
      const selectionToPreserve = [...selectedFiles];

      // Generate a unique ID for this operation for better tracking
      const operationId = Date.now().toString(36);
      logger.debug(`Starting ${action} operation (ID: ${operationId})`);

      // Define the listener for the current refresh/reload
      const handleDataForRefresh = (
        data: FileData[] | { files: FileData[]; totalTokenCount: number }
      ) => {
        // Support both structures - array or object with a files field
        const receivedFiles = Array.isArray(data) ? data : data.files;

        logger.info(
          `Received data for ${action} operation (ID: ${operationId}): ${receivedFiles.length} files`
        );

        // Categorize files - similar to handleFileListData
        const categorizedFiles = receivedFiles.map((file) => ({
          ...file,
          sectionId: categorizeFile(file, selectedFolder, PROMPT_SECTIONS),
        }));

        // Restore the selection based on saved files and the new file list
        const validPaths = new Set(
          categorizedFiles.map((f) => normalizePath(f.path))
        );
        const restoredSelection = selectionToPreserve.filter((p) =>
          validPaths.has(normalizePath(p))
        );

        setAllFiles(categorizedFiles);
        applyFiltersAndSort(categorizedFiles, sortOrder, searchTerm);
        setSelectedFiles(restoredSelection);

        setProcessingStatus({
          status: "complete",
          message: `Folder ${
            action === "refresh" ? "refreshed" : "reloaded"
          } successfully`,
        });

        // Remove the listener after use
        logger.debug(
          `Removing temporary listener for ${action} operation (ID: ${operationId})`
        );
        window.electron.ipcRenderer.removeListener(
          "file-list-data",
          handleDataForRefresh
        );
        logger.debug(
          `Listener for ${action} operation removed (ID: ${operationId})`
        );
      };

      // Add the listener before sending the request
      logger.debug(
        `Adding temporary listener for ${action} operation (ID: ${operationId})`
      );
      window.electron.ipcRenderer.on("file-list-data", handleDataForRefresh);
      logger.debug(
        `Listener for ${action} operation added (ID: ${operationId})`
      );

      // Update request tracking reference
      lastRequestedFolder.current = selectedFolder;

      // Request refresh of the file list - now always send forceRefresh=true
      logger.debug(
        `Sending request-file-list with forceRefresh=true for ${action} operation (ID: ${operationId})`
      );
      window.electron.ipcRenderer.send("request-file-list", {
        path: selectedFolder,
        forceRefresh: true,
      });
    },
    [
      selectedFolder,
      isElectron,
      selectedFiles,
      sortOrder,
      searchTerm,
      applyFiltersAndSort,
    ]
  );

  const refreshFolder = useCallback(
    () => refreshOrReloadFolder("refresh"),
    [refreshOrReloadFolder]
  );
  const reloadFolder = useCallback(
    () => refreshOrReloadFolder("reload"),
    [refreshOrReloadFolder]
  );

  // Handle sort change
  const handleSortChange = useCallback(
    (newSort: string) => {
      setSortOrder(newSort);
      applyFiltersAndSort(allFiles, newSort, searchTerm);
      setSortDropdownOpen(false); // Close dropdown after selection
    },
    [allFiles, searchTerm, applyFiltersAndSort]
  );

  // Handle search change
  const handleSearchChange = useCallback(
    (newSearch: string) => {
      setSearchTerm(newSearch);
      applyFiltersAndSort(allFiles, sortOrder, newSearch);
    },
    [allFiles, sortOrder, applyFiltersAndSort]
  );

  // Handle view change
  const handleViewChange = useCallback((newView: "structured" | "flat") => {
    setFileListView(newView);
  }, []);

  // Toggle sort dropdown
  const toggleSortDropdown = useCallback(() => {
    setSortDropdownOpen(!sortDropdownOpen);
  }, [sortDropdownOpen]);

  // Calculate total tokens from selected files
  const calculateTotalTokens = () => {
    return selectedFiles.reduce((total: number, path: string) => {
      const file = allFiles.find((f: FileData) => f.path === path);
      return total + (file ? file.tokenCount : 0);
    }, 0);
  };

  // Handle select all files
  const selectAllFiles = useCallback(() => {
    // Only select files that are not binary and not skipped
    const selectableFiles = allFiles.filter(
      (file: FileData) => !file.isBinary && !file.isSkipped
    );

    // Get paths of all selectable files
    const allPaths = selectableFiles.map((file: FileData) =>
      normalizePath(file.path)
    );

    // Set selected files to all selectable files
    setSelectedFiles(allPaths);
  }, [allFiles]);

  // Handle deselect all files
  const deselectAllFiles = useCallback(() => {
    // Clear all selected files
    setSelectedFiles([]);
  }, []);

  // Sort options for the dropdown
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
      label: "Tokens (Low to High)",
      icon: <ChartNoAxesColumnIncreasingIcon size={16} />,
      description: "Tokens (Low to High)",
    },
    {
      value: "tokens-desc",
      label: "Tokens (High to Low)",
      icon: <ChartNoAxesColumnDecreasingIcon size={16} />,
      description: "Tokens (High to Low)",
    },
    {
      value: "name-asc",
      label: "Name (A to Z)",
      icon: <SortAsc size={16} />,
      description: "Name (A to Z)",
    },
    {
      value: "name-desc",
      label: "Name (Z to A)",
      icon: <SortDesc size={16} />,
      description: "Name (Z to A)",
    },
  ];

  // Handle expand/collapse state changes
  const toggleExpanded = (nodePath: string) => {
    setExpandedNodes((prevSet: Set<string>) => {
      const newSet = new Set(prevSet); // Create a new Set to ensure state update
      if (newSet.has(nodePath)) {
        newSet.delete(nodePath); // Remove if exists (collapse)
      } else {
        newSet.add(nodePath); // Add if doesn't exist (expand)
      }
      return newSet;
    });
  };

  // Select a folder from the recent folders list
  const selectRecentFolder = (folderPath: string) => {
    if (!folderPath || !isElectron) return;

    // Set the selected folder
    setSelectedFolder(folderPath);

    // Load the state for this project folder
    const projectState = loadInitialState(folderPath);
    setSelectedFiles(projectState.selectedFiles);
    setExpandedNodes(projectState.expandedNodes);
    setSortOrder(projectState.sortOrder);
    setSearchTerm(projectState.searchTerm);
    setFileListView(projectState.fileListView);
    setIncludeFileTree(projectState.includeFileTree);
    setIncludePromptOverview(projectState.includePromptOverview);

    // Reset the file lists
    setAllFiles([]);
    setDisplayedFiles([]);

    // Set the status
    setProcessingStatus({
      status: "processing",
      message: "Loading files from the selected folder...", // Translated string
    });

    // Update request tracking reference
    lastRequestedFolder.current = folderPath;

    // Request the file list with the new structure
    window.electron.ipcRenderer.send("request-file-list", {
      path: folderPath,
      forceRefresh: false,
    });

    // Update the list of recent folders
    updateRecentFolders(folderPath);
  };

  // Remove a folder from the recent folders list
  const removeRecentFolder = (folderPath: string, event: any) => {
    // Prevent the click from bubbling up to the button
    event.stopPropagation();

    setRecentFolders((prev: string[]) =>
      prev.filter((path: string) => path !== folderPath)
    );
  };

  // Handle exit from the current folder
  const handleExitFolder = useCallback(() => {
    // Reset everything to initial values
    saveLastSelectedFolder(null);
    setSelectedFolder(null);

    // Load the default state
    const defaultState = loadInitialState(null);
    setSelectedFiles(defaultState.selectedFiles);
    setExpandedNodes(defaultState.expandedNodes);
    setSortOrder(defaultState.sortOrder);
    setSearchTerm(defaultState.searchTerm);
    setFileListView(defaultState.fileListView);
    setIncludeFileTree(defaultState.includeFileTree);
    setIncludePromptOverview(defaultState.includePromptOverview);

    setAllFiles([]);
    setDisplayedFiles([]);
    setProcessingStatus({ status: "idle", message: "" });
  }, [loadInitialState]); // Added dependency

  // Handle clicks outside of sort dropdown
  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
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

  return (
    <ThemeProvider>
      <div className="app-container">
        {processingStatus.status === "processing" && (
          <div className="processing-indicator">
            <div className="spinner"></div>
            <span>{processingStatus.message}</span>
          </div>
        )}

        {processingStatus.status === "error" && (
          <div className="error-message">Error: {processingStatus.message}</div>
        )}

        {!selectedFolder && (
          <div className="initial-prompt">
            <div className="initial-prompt-content">
              <div className="initial-header">
                <h2>PasteMax</h2>
                <div className="initial-actions">
                  <ThemeToggle />
                  <button className="select-folder-btn" onClick={openFolder}>
                    <FolderOpen size={16} />
                    <span>Select Folder</span>
                  </button>
                </div>
              </div>

              {recentFolders.length > 0 && (
                <div className="recent-folders-section">
                  <div className="recent-folders-title">Recent folders</div>
                  <ul className="recent-folders-list">
                    {recentFolders.map((folderPath: string, index: number) => (
                      <div
                        key={index}
                        className="recent-folder-item"
                        onClick={() => selectRecentFolder(folderPath)}
                        title={folderPath}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectRecentFolder(folderPath);
                          }
                        }}
                        aria-label={`Open folder: ${basename(folderPath)}`}
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
                          title="Remove from recent folders"
                          aria-label={`Remove ${basename(
                            folderPath
                          )} from recent folders`}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
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
              refreshFolder={refreshFolder}
              reloadFolder={reloadFolder}
              expandedNodes={expandedNodes}
              toggleExpanded={toggleExpanded}
            />
            <div className="content-area">
              <div className="content-header">
                {/* <div className="content-title">Selected Files</div> */}
                <h1>PasteMax</h1>
                <div className="header-actions">
                  <ThemeToggle />
                  <div className="folder-info">
                    {selectedFolder ? (
                      <div className="selected-folder">{selectedFolder}</div>
                    ) : (
                      <span>No folder selected</span>
                    )}
                    <button
                      className="select-folder-btn"
                      onClick={openFolder}
                      disabled={processingStatus.status === "processing"}
                      title="Select Folder"
                    >
                      <FolderOpen size={16} />
                    </button>
                    {selectedFolder && (
                      <button
                        className="select-folder-btn"
                        onClick={reloadFolder}
                        disabled={processingStatus.status === "processing"}
                        title="Reload"
                      >
                        <RefreshCw size={16} />
                      </button>
                    )}
                    {selectedFolder && (
                      <button
                        className="select-folder-btn"
                        onClick={handleExitFolder}
                        title="Exit"
                      >
                        <LogOut size={16} />
                      </button>
                    )}
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
                      title={
                        sortOptions.find((opt) => opt.value === sortOrder)
                          ?.description
                      }
                    >
                      {sortOptions.find((opt) => opt.value === sortOrder)?.icon}
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
                            <span>{option.description}</span>
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
                files={displayedFiles}
                selectedFiles={selectedFiles}
                toggleFileSelection={toggleFileSelection}
                selectedFolder={selectedFolder}
                view={fileListView}
              />

              <div className="copy-button-container">
                <FileTreeToggle
                  checked={includePromptOverview}
                  onChange={() =>
                    setIncludePromptOverview(!includePromptOverview)
                  }
                  title={
                    includePromptOverview
                      ? "Exclude prompt overview from output"
                      : "Include prompt overview in output"
                  }
                >
                  <span>Include Overview</span>
                </FileTreeToggle>

                <FileTreeToggle
                  checked={includeFileTree}
                  onChange={() => setIncludeFileTree(!includeFileTree)}
                  title={
                    includeFileTree
                      ? "Exclude file tree from output"
                      : "Include file tree in output"
                  }
                >
                  <span>Include File Tree</span>
                </FileTreeToggle>

                <CopyButton
                  text={getSelectedFilesContent()}
                  className="primary full-width copy-files-btn"
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
