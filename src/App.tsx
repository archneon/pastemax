// src/App.tsx
import React, {
  useState,
  useEffect,
  useRef, // Ensure useRef is imported
  useCallback,
  useMemo,
  MouseEvent, // Import MouseEvent directly
} from "react";
import Sidebar from "./components/Sidebar";
import FileList from "./components/FileList";
import CopyButton from "./components/CopyButton";
import FileTreeToggle from "./components/FileTreeToggle";
import { FileData, SidebarProps } from "./types/FileTypes"; // Import SidebarProps
import { ThemeProvider } from "./context/ThemeContext";
import ThemeToggle from "./components/ThemeToggle";
import FileListToggle from "./components/FileListToggle";
import logger from "./utils/logger";
import {
  generateAsciiFileTree,
  normalizePath,
  arePathsEqual,
  comparePathsStructurally,
  basename,
  getRelativePath,
} from "./utils/pathUtils";
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
  PROMPT_SECTIONS,
  PROMPT_MARKERS,
  PROJECT_TREE_CONFIG,
  DESCRIPTIONS_DIR,
  OVERVIEW_FILENAME,
  DEFAULT_SORT_ORDER,
  DEFAULT_FILE_LIST_VIEW,
  DEFAULT_INCLUDE_FILE_TREE_GLOBAL,
  DEFAULT_INCLUDE_PROMPT_OVERVIEW_GLOBAL,
} from "./constants";
import { PromptSectionDefinition } from "./types/promptConfigTypes";
import {
  useProjectStore,
  selectCurrentSelectedFolder,
  selectRecentFolders,
  selectAllFiles as selectStoreAllFilesHook,
  selectProcessingStatus,
  selectHasHydrated,
  getDefaultPerProjectState,
  selectNeedsFilesReload, // <-- Import NEW selector
} from "./store/projectStore";
// Import PerProjectState if needed for typing, ProcessingStatus might be used
import { ProcessingStatus, PerProjectState } from "./types/projectStateTypes";

let renderCount = 0;
const APP_INSTANCE_ID = Math.random().toString(36).substring(2, 8);

// Log outside component to ensure it logs only once per module load
logger.info(`App.tsx module loaded (instance: ${APP_INSTANCE_ID})`);

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

// Interface for sort options array elements
interface SortOptionConfig {
  value: string;
  label: string;
  icon: JSX.Element;
  description: string;
}

// Define categorizeFile function outside the component
const categorizeFile = (
  file: FileData,
  currentSelectedFolder: string | null,
  sections: PromptSectionDefinition[]
): string => {
  // logger.debug(`Categorizing file: ${file.path} for folder: ${currentSelectedFolder}`);
  const defaultSection = sections.find((s) => s.directory === null);
  const defaultSectionId = defaultSection?.id || "project_files";
  if (
    !currentSelectedFolder ||
    file.descriptionForSectionId ||
    file.isOverviewTemplate ||
    file.isProjectTreeDescription
  ) {
    // logger.debug(`File ${file.path} categorized as default (special file or no folder): ${defaultSectionId}`);
    return defaultSectionId;
  }
  const relativePath = getRelativePath(file.path, currentSelectedFolder);
  if (!relativePath) {
    // logger.debug(`File ${file.path} categorized as default (no relative path): ${defaultSectionId}`);
    return defaultSectionId;
  }
  for (const section of sections) {
    if (
      section.directory &&
      (relativePath === section.directory ||
        relativePath.startsWith(section.directory + "/"))
    ) {
      // logger.debug(`File ${file.path} categorized under section: ${section.id}`);
      return section.id;
    }
  }
  // logger.debug(`File ${file.path} categorized as default (no matching section): ${defaultSectionId}`);
  return defaultSectionId;
};

// --- Define default project state values once outside the component ---
const defaultProjectStateValues = getDefaultPerProjectState();
const defaultSelectedFiles: string[] = []; // Stable empty array reference

// --- App Component ---
const App = () => {
  renderCount++;
  // *** LOG: App component render start ***
  logger.debug(
    `--- App render START #${renderCount} (instance: ${APP_INSTANCE_ID}) ---`
  );

  // --- State from Zustand Store (Individual Selectors) ---
  const hasHydrated = useProjectStore(selectHasHydrated);
  const selectedFolder = useProjectStore(selectCurrentSelectedFolder);
  const recentFolders = useProjectStore(selectRecentFolders);
  const allFiles = useProjectStore(selectStoreAllFilesHook);
  const processingStatus = useProjectStore(selectProcessingStatus);
  const needsFilesReload = useProjectStore(selectNeedsFilesReload); // Get the flag

  // Get specific project state properties individually, providing stable defaults
  const selectedFiles = useProjectStore(
    (state) =>
      state.projects[state.currentSelectedFolder!]?.selectedFiles ??
      defaultSelectedFiles
  );
  const sortOrder = useProjectStore(
    (state) =>
      state.projects[state.currentSelectedFolder!]?.sortOrder ??
      defaultProjectStateValues.sortOrder
  );
  const searchTerm = useProjectStore(
    (state) =>
      state.projects[state.currentSelectedFolder!]?.searchTerm ??
      defaultProjectStateValues.searchTerm
  );
  const fileListView = useProjectStore(
    (state) =>
      state.projects[state.currentSelectedFolder!]?.fileListView ??
      defaultProjectStateValues.fileListView
  );
  const includeFileTree = useProjectStore(
    (state) =>
      state.projects[state.currentSelectedFolder!]?.includeFileTree ??
      defaultProjectStateValues.includeFileTree
  );
  const includePromptOverview = useProjectStore(
    (state) =>
      state.projects[state.currentSelectedFolder!]?.includePromptOverview ??
      defaultProjectStateValues.includePromptOverview
  );

  // *** LOG: State values after selection ***
  logger.debug(
    `Render #${renderCount}: Hydrated: ${hasHydrated}, Folder: ${selectedFolder}, NeedsReload: ${needsFilesReload}, FilesCount: ${allFiles.length}, SelectedCount: ${selectedFiles.length}, Sort: ${sortOrder}, Search: ${searchTerm}, Status: ${processingStatus.status}`
  );

  // --- Actions from Zustand Store ---
  const {
    setCurrentSelectedFolder,
    setAllFiles: setStoreAllFilesAction,
    setProcessingStatus: setStoreProcessingStatusAction,
    toggleFileSelection,
    setSortOrder,
    setSearchTerm,
    setFileListView,
    setIncludeFileTree,
    setIncludePromptOverview,
    removeRecentFolder,
    exitFolder,
    setNeedsFilesReload, // Get the action to reset the flag
  } = useProjectStore.getState();

  // --- Local UI State ---
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef: React.RefObject<HTMLDivElement> =
    useRef<HTMLDivElement>(null);

  // --- Ref to prevent duplicate requests in quick succession ---
  const fileRequestSentRef = useRef<boolean>(false);

  const isElectron = window.electron !== undefined;

  // --- Derived State & Calculations ---
  const displayedFiles = useMemo(() => {
    // *** LOG: useMemo for displayedFiles ***
    logger.debug(`Render #${renderCount}: Recalculating displayedFiles.`);
    let filtered = allFiles;
    if (searchTerm) {
      const lowerFilter = searchTerm.toLowerCase();
      filtered = allFiles.filter(
        (file) =>
          file.name.toLowerCase().includes(lowerFilter) ||
          getRelativePath(file.path, selectedFolder)
            .toLowerCase()
            .includes(lowerFilter)
      );
    }
    const [sortKey, sortDir] = sortOrder.split("-");
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "name") comparison = a.name.localeCompare(b.name);
      else if (sortKey === "tokens")
        comparison = (a.tokenCount || 0) - (b.tokenCount || 0);
      else if (sortKey === "size") comparison = (a.size || 0) - (b.size || 0);
      else if (sortKey === "path")
        comparison = comparePathsStructurally(a.path, b.path, selectedFolder);
      return sortDir === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [allFiles, sortOrder, searchTerm, selectedFolder]);

  const totalSelectedTokens = useMemo(() => {
    // *** LOG: useMemo for totalSelectedTokens ***
    logger.debug(`Render #${renderCount}: Recalculating totalSelectedTokens.`);
    const selectedFilesSet = new Set(selectedFiles.map(normalizePath));
    return allFiles.reduce((total, file) => {
      if (selectedFilesSet.has(normalizePath(file.path))) {
        return total + (file.tokenCount || 0);
      }
      return total;
    }, 0);
  }, [selectedFiles, allFiles]);

  // --- Format marker helper ---
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

  // --- Generate Content for Copying ---
  const getSelectedFilesContent = useCallback(() => {
    // *** LOG: useCallback for getSelectedFilesContent (recreation log removed unless needed) ***
    logger.debug(
      `Generating content for copying. Selected files: ${selectedFiles.length}`
    ); // Log inside call
    const selectedPathSet = new Set(selectedFiles.map(normalizePath));

    const contentFiles = allFiles.filter(
      (file: FileData) =>
        selectedPathSet.has(normalizePath(file.path)) &&
        !file.isBinary &&
        !file.isSkipped &&
        !file.descriptionForSectionId &&
        !file.isOverviewTemplate &&
        !file.isProjectTreeDescription
    );

    const descriptionMap: Record<string, string> = {};
    let overviewContent: string | null = null;
    allFiles.forEach((file: FileData) => {
      if (file.content) {
        if (file.descriptionForSectionId)
          descriptionMap[file.descriptionForSectionId] = file.content;
        else if (file.isProjectTreeDescription)
          descriptionMap["project_tree"] = file.content;
        else if (file.isOverviewTemplate) overviewContent = file.content;
      }
    });

    if (
      contentFiles.length === 0 &&
      !includeFileTree &&
      !includePromptOverview
    ) {
      return "No text files selected, or tree/overview not included.";
    }

    const [sortKey, sortDir] = sortOrder.split("-");
    const sortedContentFiles = [...contentFiles].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "name") comparison = a.name.localeCompare(b.name);
      else if (sortKey === "tokens")
        comparison = (a.tokenCount || 0) - (b.tokenCount || 0);
      else if (sortKey === "size") comparison = (a.size || 0) - (b.size || 0);
      else if (sortKey === "path")
        comparison = comparePathsStructurally(a.path, b.path, selectedFolder);
      return sortDir === "asc" ? comparison : -comparison;
    });

    let output = "";
    const markers = PROMPT_MARKERS;

    if (includePromptOverview && overviewContent) {
      output +=
        "==== SYSTEM_PROMPT_OVERVIEW ====\n" +
        String(overviewContent).trim() +
        "\n\n";
    }
    if (includeFileTree && selectedFolder) {
      const treeSectionName = PROJECT_TREE_CONFIG.name;
      const treeDescription = descriptionMap["project_tree"];
      output +=
        formatMarker(markers.section_open, { section_name: treeSectionName }) +
        "\n";
      if (treeDescription) {
        output +=
          markers.description_open +
          "\n" +
          String(treeDescription).trim() +
          "\n" +
          markers.description_close +
          "\n\n";
      }
      output += ".\n";
      const asciiTree = generateAsciiFileTree(
        sortedContentFiles,
        selectedFolder
      );
      output += asciiTree + "\n";
      output +=
        formatMarker(markers.section_close, { section_name: treeSectionName }) +
        "\n\n";
    }

    const filesBySection: Record<string, FileData[]> = {};
    const defaultSectionId =
      PROMPT_SECTIONS.find((s) => s.directory === null)?.id || "project_files";
    sortedContentFiles.forEach((file) => {
      const sectionId =
        file.sectionId || categorizeFile(file, selectedFolder, PROMPT_SECTIONS);
      if (!filesBySection[sectionId]) filesBySection[sectionId] = [];
      filesBySection[sectionId].push(file);
    });

    for (const section of PROMPT_SECTIONS) {
      const sectionFiles = filesBySection[section.id];
      if (!sectionFiles || sectionFiles.length === 0) continue;
      output +=
        formatMarker(markers.section_open, { section_name: section.name }) +
        "\n\n";
      const description = descriptionMap[section.id];
      if (description) {
        output +=
          markers.description_open +
          "\n" +
          String(description).trim() +
          "\n" +
          markers.description_close +
          "\n\n";
      }
      sectionFiles.forEach((file) => {
        const relativePath = getRelativePath(file.path, selectedFolder);
        output +=
          formatMarker(markers.file_open, { file_path: relativePath }) + "\n";
        output += file.content || "";
        if (file.content && !file.content.endsWith("\n")) output += "\n";
        output +=
          formatMarker(markers.file_close, { file_path: relativePath }) +
          "\n\n";
      });
      output +=
        formatMarker(markers.section_close, { section_name: section.name }) +
        "\n\n";
    }
    return output.trim();
  }, [
    // Dependencies reflect the state used from the store selectors
    selectedFolder,
    formatMarker,
    allFiles,
    selectedFiles,
    sortOrder,
    includeFileTree,
    includePromptOverview,
  ]);

  // --- Event Handlers ---
  const openFolder = useCallback(() => {
    if (isElectron) {
      logger.info("Handler: openFolder");
      fileRequestSentRef.current = false;
      window.electron.ipcRenderer.send("open-folder");
    } else {
      logger.warn("Folder selection not available in browser");
    }
  }, [isElectron]); // Reset ref on new dialog

  // Modified handler to reset ref
  const handleFolderSelectedIPC = useCallback(
    (folderPath: string) => {
      fileRequestSentRef.current = false; // Reset sent tracker
      if (typeof folderPath === "string") {
        logger.info(`IPC: folder-selected received: ${folderPath}`);
        setCurrentSelectedFolder(folderPath);
      } else {
        logger.error(`IPC: Invalid folder path received: ${folderPath}`);
        setStoreProcessingStatusAction({
          status: "error",
          message: "Invalid folder path received",
        });
      }
    },
    [setCurrentSelectedFolder, setStoreProcessingStatusAction]
  );

  const handleFileListDataIPC = useCallback(
    (receivedData: FileData[] | { files: FileData[] }) => {
      logger.info(`IPC: file-list-data received`);
      const filesArray = Array.isArray(receivedData)
        ? receivedData
        : receivedData.files;
      const currentSelectedFolder =
        useProjectStore.getState().currentSelectedFolder;
      const categorizedFiles = filesArray.map((file) => ({
        ...file,
        sectionId: categorizeFile(file, currentSelectedFolder, PROMPT_SECTIONS),
      }));
      logger.info(
        `IPC: Setting ${categorizedFiles.length} categorized files in store.`
      );
      setStoreAllFilesAction(categorizedFiles);
      setStoreProcessingStatusAction({
        status: "complete",
        message: `Loaded ${categorizedFiles.length} files`,
      });
      // Reset sent flag *after* files are successfully set and status is complete
      fileRequestSentRef.current = false;
      logger.debug("Reset fileRequestSentRef after successful file load.");
    },
    [setStoreAllFilesAction, setStoreProcessingStatusAction]
  );

  const handleProcessingStatusIPC = useCallback(
    (status: ProcessingStatus) => {
      logger.info(
        `IPC: file-processing-status received: ${status.status} - ${status.message}`
      );
      // Reset the sent flag if processing completes or errors out,
      // allowing a new request if needed (e.g., if needsReload is still true)
      if (status.status === "complete" || status.status === "error") {
        // fileRequestSentRef.current = false; // Let the main useEffect handle resetting based on needsFilesReload becoming false
        // logger.debug(`Reset fileRequestSentRef because processing status is ${status.status}`);
      }
      setStoreProcessingStatusAction(status);
    },
    [setStoreProcessingStatusAction]
  );
  const requestFileList = useCallback(
    (folderPath: string, forceRefresh: boolean = false) => {
      if (!isElectron || !folderPath) return;
      logger.info(
        `Handler: requestFileList for ${folderPath}, forceRefresh: ${forceRefresh}`
      );
      setStoreProcessingStatusAction({
        status: "processing",
        message: forceRefresh
          ? "Reloading folder..."
          : "Requesting folder data...",
      });
      window.electron.ipcRenderer.send("request-file-list", {
        path: folderPath,
        forceRefresh: forceRefresh,
      });
    },
    [isElectron, setStoreProcessingStatusAction]
  );

  // Modified handler to reset ref
  const refreshFolder = useCallback(() => {
    const currentSelectedFolder =
      useProjectStore.getState().currentSelectedFolder;
    if (currentSelectedFolder) {
      logger.info(`Handler: refreshFolder called for ${currentSelectedFolder}`);
      fileRequestSentRef.current = false; // Reset sent tracker
      useProjectStore.getState().setNeedsFilesReload(true); // Explicitly signal need to reload
      requestFileList(currentSelectedFolder, true);
    }
  }, [requestFileList]); // requestFileList dependency

  const reloadFolder = useCallback(() => {
    logger.info(`Handler: reloadFolder called`);
    refreshFolder();
  }, [refreshFolder]); // Dependency is stable callback
  const handleSortChange = useCallback(
    (newSort: string) => {
      logger.info(`Handler: handleSortChange called with ${newSort}`);
      setSortOrder(newSort);
      setSortDropdownOpen(false);
    },
    [setSortOrder]
  ); // Dependency is action
  const handleSearchChange = useCallback(
    (newSearch: string) => {
      logger.info(`Handler: handleSearchChange called with "${newSearch}"`);
      setSearchTerm(newSearch);
    },
    [setSearchTerm]
  ); // Dependency is action
  const handleViewChange = useCallback(
    (newView: "structured" | "flat") => {
      logger.info(`Handler: handleViewChange called with ${newView}`);
      setFileListView(newView);
    },
    [setFileListView]
  ); // Dependency is action

  // Modified handler to reset ref
  const selectRecentFolder = useCallback(
    (folderPath: string) => {
      if (!isElectron) return;
      fileRequestSentRef.current = false; // Reset sent tracker
      logger.info(`Handler: selectRecentFolder called with ${folderPath}`);
      setCurrentSelectedFolder(folderPath); // This action sets needsFilesReload=true
    },
    [isElectron, setCurrentSelectedFolder]
  ); // Dependencies include action

  const removeRecentFolderHandler = useCallback(
    (folderPath: string, event: MouseEvent) => {
      event.stopPropagation();
      logger.info(
        `Handler: removeRecentFolderHandler called with ${folderPath}`
      );
      removeRecentFolder(folderPath);
    },
    [removeRecentFolder]
  ); // Dependency is action

  // Modified handler to reset ref
  const handleExitFolder = useCallback(() => {
    logger.info(`Handler: handleExitFolder called`);
    fileRequestSentRef.current = false; // Reset sent tracker
    exitFolder(); // This action sets needsFilesReload=false
  }, [exitFolder]); // Dependency is action

  // --- Effects ---
  useEffect(() => {
    // *** LOG: useEffect for IPC Listeners ***
    logger.debug(
      `Render #${renderCount}: Running useEffect for IPC listeners.`
    );
    if (!isElectron) return;
    logger.debug(`Setting up IPC listeners (instance: ${APP_INSTANCE_ID})`);
    const folderSelectedHandler = handleFolderSelectedIPC;
    const fileListDataHandler = handleFileListDataIPC;
    const processingStatusHandler = handleProcessingStatusIPC;
    window.electron.ipcRenderer.on("folder-selected", folderSelectedHandler);
    window.electron.ipcRenderer.on("file-list-data", fileListDataHandler);
    window.electron.ipcRenderer.on(
      "file-processing-status",
      processingStatusHandler
    );
    logger.debug("IPC listeners registered.");
    return () => {
      logger.debug(`Cleaning up IPC listeners (instance: ${APP_INSTANCE_ID})`);
      window.electron.ipcRenderer.removeListener(
        "folder-selected",
        folderSelectedHandler
      );
      window.electron.ipcRenderer.removeListener(
        "file-list-data",
        fileListDataHandler
      );
      window.electron.ipcRenderer.removeListener(
        "file-processing-status",
        processingStatusHandler
      );
      logger.debug("IPC listeners removed.");
    };
  }, [
    isElectron,
    handleFolderSelectedIPC,
    handleFileListDataIPC,
    handleProcessingStatusIPC,
  ]); // Dependencies are stable callbacks

  // *** useEffect for File Load with request sent tracking ***
  useEffect(() => {
    logger.debug(
      `Render #${renderCount}: Running useEffect for file load check. ` +
        `Hydrated: ${hasHydrated}, Electron: ${isElectron}, Folder: ${selectedFolder}, ` +
        `NeedsReload: ${needsFilesReload}, Status: ${processingStatus.status}, ` +
        `FileRequestSent: ${fileRequestSentRef.current}` // Log new ref
    );

    // Conditions for loading:
    if (hasHydrated && isElectron && selectedFolder) {
      // Check if reload is needed AND a request hasn't already been sent in this cycle
      if (
        needsFilesReload &&
        !fileRequestSentRef.current &&
        processingStatus.status !== "processing"
      ) {
        logger.info(
          `Effect: Triggering requestFileList for ${selectedFolder} because needsFilesReload is TRUE and request not sent yet.`
        );
        // Mark that request is being sent for this cycle
        fileRequestSentRef.current = true;
        requestFileList(selectedFolder, false); // Request files
        // Reset the store flag immediately
        setNeedsFilesReload(false);
      } else if (needsFilesReload && fileRequestSentRef.current) {
        logger.debug(
          `Effect: needsFilesReload is TRUE for ${selectedFolder}, but request already sent in this cycle. Skipping.`
        );
      } else if (needsFilesReload && processingStatus.status === "processing") {
        logger.debug(
          `Effect: needsFilesReload is TRUE for ${selectedFolder}, but skipping because status is 'processing'.`
        );
      } else if (!needsFilesReload) {
        // If reload is not needed, ensure the sent flag is also reset for the next potential trigger
        if (fileRequestSentRef.current) {
          logger.debug(
            "Effect: Resetting fileRequestSentRef because needsFilesReload is false."
          );
          fileRequestSentRef.current = false;
        }
      }
    }
    // Conditions for clearing state when no folder is selected
    else if (hasHydrated && !selectedFolder) {
      const currentAllFiles = useProjectStore.getState().allFiles;
      // Combine flag resets here
      if (
        allFiles.length > 0 ||
        needsFilesReload ||
        fileRequestSentRef.current
      ) {
        logger.debug(
          "Effect: No folder selected, clearing allFiles and resetting flags/refs."
        );
        if (allFiles.length > 0) setStoreAllFilesAction([]);
        if (needsFilesReload) setNeedsFilesReload(false);
        fileRequestSentRef.current = false; // Reset sent flag
      }
    }

    if (!hasHydrated) {
      logger.debug(`Render #${renderCount}: Waiting for store hydration...`);
    }
    // Dependencies: Re-run when primary conditions change, or when the request flag might need reset
    // Removed allFiles.length as dependency, rely on needsFilesReload flag and status
  }, [
    selectedFolder,
    hasHydrated,
    isElectron,
    needsFilesReload,
    processingStatus.status,
    requestFileList,
    setNeedsFilesReload,
    setStoreAllFilesAction,
  ]);

  useEffect(() => {
    // *** LOG: useEffect for Sort Dropdown Click Outside ***
    // logger.debug(`Render #${renderCount}: Running useEffect for sort dropdown.`);
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

  // Typed sort options array
  const sortOptions: SortOptionConfig[] = [
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

  // --- Render Logic ---
  // *** LOG: App render RETURN ***
  logger.debug(
    `Render #${renderCount}: App rendering RETURN statement. Folder: ${selectedFolder}, Status: ${processingStatus.status}`
  );

  if (!hasHydrated) {
    logger.debug(
      `Render #${renderCount}: Rendering loading indicator (not hydrated).`
    );
    return (
      <div className="processing-indicator">
        {" "}
        <div className="spinner"></div>{" "}
        <span>Loading application state...</span>{" "}
      </div>
    );
  }

  return (
    <ThemeProvider>
      <div className="app-container">
        {/* Processing Status */}
        {processingStatus.status === "processing" && (
          <div className="processing-indicator">
            {" "}
            <div className="spinner"></div>{" "}
            <span>{processingStatus.message}</span>{" "}
          </div>
        )}
        {processingStatus.status === "error" && (
          <div className="error-message">Error: {processingStatus.message}</div>
        )}

        {/* Welcome Screen */}
        {!selectedFolder && (
          <div className="initial-prompt">
            {/* Log Welcome Screen render using comma operator */}
            {renderCount < 3 &&
              (logger.debug("Rendering Welcome Screen (Log 1)"), null)}
            <div className="initial-prompt-content">
              <div className="initial-header">
                <h2>PasteMax</h2>
                <div className="initial-actions">
                  <ThemeToggle />
                  <button className="select-folder-btn" onClick={openFolder}>
                    {" "}
                    <FolderOpen size={16} /> <span>Select Folder</span>{" "}
                  </button>
                </div>
              </div>
              {recentFolders.length > 0 && (
                <div className="recent-folders-section">
                  <div className="recent-folders-title">Recent folders</div>
                  <ul className="recent-folders-list">
                    {recentFolders.map((folderPath: string) => (
                      <div
                        key={folderPath}
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
                          {" "}
                          <span className="recent-folder-name">
                            {basename(folderPath)}
                          </span>{" "}
                          <span className="recent-folder-path">
                            {folderPath}
                          </span>{" "}
                        </div>
                        <button
                          className="recent-folder-delete"
                          onClick={(e) =>
                            removeRecentFolderHandler(folderPath, e)
                          }
                          title="Remove from recent folders"
                          aria-label={`Remove ${basename(
                            folderPath
                          )} from recent folders`}
                        >
                          {" "}
                          <X size={16} />{" "}
                        </button>
                      </div>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Layout */}
        {selectedFolder && (
          <div className="main-content">
            {/* Log Main Layout render using comma operator */}
            {renderCount < 3 &&
              (logger.debug(
                `Rendering Main Layout for ${selectedFolder} (Log 2)`
              ),
              null)}
            {/* REMINDER: Adjust SidebarProps temporarily in types/FileTypes.ts */}
            <Sidebar
              selectedFolder={selectedFolder}
              openFolder={openFolder}
              refreshFolder={refreshFolder}
              reloadFolder={reloadFolder}
            />
            <div className="content-area">
              {/* Header */}
              <div className="content-header">
                <h1>PasteMax</h1>
                <div className="header-actions">
                  <ThemeToggle />
                  <div className="folder-info">
                    {selectedFolder && (
                      <div className="selected-folder">{selectedFolder}</div>
                    )}
                    <button
                      className="select-folder-btn"
                      onClick={openFolder}
                      disabled={processingStatus.status === "processing"}
                      title="Select Folder"
                    >
                      {" "}
                      <FolderOpen size={16} />{" "}
                    </button>
                    {selectedFolder && (
                      <button
                        className="select-folder-btn"
                        onClick={reloadFolder}
                        disabled={processingStatus.status === "processing"}
                        title="Reload"
                      >
                        {" "}
                        <RefreshCw size={16} />{" "}
                      </button>
                    )}
                    {selectedFolder && (
                      <button
                        className="select-folder-btn"
                        onClick={handleExitFolder}
                        title="Exit Folder"
                      >
                        {" "}
                        <LogOut size={16} />{" "}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Content Header 2 */}
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
                      onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                      title={
                        sortOptions.find((opt) => opt.value === sortOrder)
                          ?.description ?? "Select Sort Order"
                      }
                    >
                      {sortOptions.find((opt) => opt.value === sortOrder)
                        ?.icon ?? <ArrowUpDown size={16} />}
                      <ArrowUpDown size={13} />
                    </button>
                    {sortDropdownOpen && (
                      <div className="sort-options">
                        {" "}
                        {sortOptions.map((option) => (
                          <div
                            key={option.value}
                            className={`sort-option ${
                              sortOrder === option.value ? "active" : ""
                            }`}
                            onClick={() => handleSortChange(option.value)}
                            title={option.description}
                          >
                            {" "}
                            {option.icon} <span>{option.description}</span>{" "}
                          </div>
                        ))}{" "}
                      </div>
                    )}
                  </div>
                  <div className="file-stats">
                    {" "}
                    {selectedFiles.length} files | ~
                    {totalSelectedTokens.toLocaleString()} tokens{" "}
                  </div>
                </div>
              </div>

              {/* FileList */}
              <FileList
                files={displayedFiles}
                selectedFiles={selectedFiles}
                toggleFileSelection={toggleFileSelection} // Pass action directly
                selectedFolder={selectedFolder}
                view={fileListView}
              />

              {/* Footer / Copy Area */}
              <div className="copy-button-container">
                <FileTreeToggle
                  checked={includePromptOverview}
                  onChange={() =>
                    setIncludePromptOverview(!includePromptOverview)
                  } // Use action
                  title={
                    includePromptOverview
                      ? "Exclude prompt overview from output"
                      : "Include prompt overview in output"
                  }
                >
                  <>
                    <span>Include Overview</span>
                  </>
                </FileTreeToggle>
                <FileTreeToggle
                  checked={includeFileTree}
                  onChange={() => setIncludeFileTree(!includeFileTree)} // Use action
                  title={
                    includeFileTree
                      ? "Exclude file tree from output"
                      : "Include file tree in output"
                  }
                >
                  <>
                    <span>Include File Tree</span>
                  </>
                </FileTreeToggle>
                <CopyButton
                  text={getSelectedFilesContent()} // Call the function to get text
                  className="primary full-width copy-files-btn"
                >
                  {/* Pass children for display inside the button */}
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
