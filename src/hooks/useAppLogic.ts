// src/hooks/useAppLogic.ts
import { useEffect, useRef, useCallback, useMemo } from "react";
import logger from "../utils/logger";
import {
  normalizePath,
  comparePathsStructurally,
  getRelativePath,
} from "../utils/pathUtils";
import { generatePromptContent } from "../utils/promptUtils";
import {
  useProjectStore,
  selectCurrentSelectedFolder,
  selectRecentFolders,
  selectAllFiles as selectStoreAllFilesHook,
  selectProcessingStatus,
  selectHasHydrated,
  getDefaultPerProjectState,
  selectNeedsFilesReload,
} from "../store/projectStore";
import { useIpcManager } from "./useIpcManager";
import { FileData } from "../types/FileTypes";

// --- Define default values used by selectors ---
const defaultProjectStateValues = getDefaultPerProjectState();
const defaultSelectedFiles: string[] = [];

// --- Custom Hook Definition ---
export const useAppLogic = () => {
  // *** LOG: Hook execution start ***
  const hookRenderCount = useRef(0);
  hookRenderCount.current++;
  logger.debug(
    `--- useAppLogic Hook Execution START #${hookRenderCount.current} ---`
  );

  // --- Get State from Store ---
  const hasHydrated = useProjectStore(selectHasHydrated);
  const selectedFolder = useProjectStore(selectCurrentSelectedFolder);
  const recentFolders = useProjectStore(selectRecentFolders);
  const allFiles = useProjectStore(selectStoreAllFilesHook);
  const processingStatus = useProjectStore(selectProcessingStatus);
  const needsFilesReload = useProjectStore(selectNeedsFilesReload);

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
  // searchTerm is needed for the hook's logic, but not directly for FileList filtering anymore
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

  logger.debug(
    `useAppLogic #${hookRenderCount.current}: State Values - Hydrated: ${hasHydrated}, Folder: ${selectedFolder}, NeedsReload: ${needsFilesReload}, Files: ${allFiles.length}, Selected: ${selectedFiles.length}, Sort: ${sortOrder}, Search: ${searchTerm}, Status: ${processingStatus.status}`
  );

  // --- Get Actions from Store ---
  const {
    setCurrentSelectedFolder,
    setAllFiles: setStoreAllFilesAction,
    toggleFileSelection,
    setSortOrder,
    setSearchTerm,
    setFileListView,
    setIncludeFileTree,
    setIncludePromptOverview,
    removeRecentFolder,
    exitFolder,
    setNeedsFilesReload,
    toggleFolderSelection,
    selectAllFiles: selectAllFilesAction,
    deselectAllFiles: deselectAllFilesAction,
  } = useProjectStore.getState();

  // --- Ref for preventing duplicate requests ---
  const fileRequestSentRef = useRef<boolean>(false);

  const isElectron = window.electron !== undefined;

  // --- Get IPC functionality ---
  const { requestFileList } = useIpcManager();

  // --- Derived State Calculations ---

  // --- MODIFIED: Calculate sorted list of ALL files (no search filter) ---
  // Renamed from displayedFiles to sortedAllFiles for clarity
  const sortedAllFiles = useMemo(() => {
    logger.debug(
      `useAppLogic #${hookRenderCount.current}: Recalculating sortedAllFiles (based on allFiles and sortOrder).`
    );
    // Apply sorting to all files
    const [sortKey, sortDir] = sortOrder.split("-");
    const sorted = [...allFiles].sort((a, b) => {
      // Sort a copy of allFiles
      let comparison = 0;
      if (sortKey === "name") comparison = a.name.localeCompare(b.name);
      else if (sortKey === "tokens")
        comparison = (a.tokenCount || 0) - (b.tokenCount || 0);
      else if (sortKey === "size") comparison = (a.size || 0) - (b.size || 0);
      else if (sortKey === "path")
        comparison = comparePathsStructurally(a.path, b.path, selectedFolder);
      return sortDir === "asc" ? comparison : -comparison;
    });
    // --- REMOVED searchTerm filtering ---
    /*
    if (searchTerm) {
      const lowerFilter = searchTerm.toLowerCase();
      filtered = sorted.filter( // Filter the already sorted list if needed (but not here)
        (file) =>
          file.name.toLowerCase().includes(lowerFilter) ||
          getRelativePath(file.path, selectedFolder)
            .toLowerCase()
            .includes(lowerFilter)
      );
       return filtered; // Return filtered if searchTerm exists
    }
    */
    return sorted; // Return the sorted list of all files
  }, [allFiles, sortOrder, selectedFolder]); // Remove searchTerm from dependencies

  // Calculate total tokens for *all* selected files
  const totalSelectedTokens = useMemo(() => {
    logger.debug(
      `useAppLogic #${hookRenderCount.current}: Recalculating totalSelectedTokens.`
    );
    const selectedPathsSet = new Set(selectedFiles.map(normalizePath));
    return allFiles.reduce((total, file) => {
      if (selectedPathsSet.has(normalizePath(file.path))) {
        return total + (file.tokenCount || 0);
      }
      return total;
    }, 0);
  }, [selectedFiles, allFiles]);

  // Calculate the count of *content* files among the selected files
  const selectedContentFilesCount = useMemo(() => {
    logger.debug(
      `useAppLogic #${hookRenderCount.current}: Recalculating selectedContentFilesCount.`
    );
    const selectedPathsSet = new Set(selectedFiles.map(normalizePath));
    const count = allFiles.filter(
      (file) =>
        selectedPathsSet.has(normalizePath(file.path)) &&
        !file.isBinary &&
        !file.isSkipped &&
        file.fileKind === "regular"
    ).length;
    logger.debug(`useAppLogic: Calculated selectedContentFilesCount: ${count}`);
    return count;
  }, [selectedFiles, allFiles]);

  // --- Generate Content for Copying ---
  const getSelectedFilesContent = useCallback(() => {
    logger.debug(
      `useAppLogic #${hookRenderCount.current}: Generating content for copying.`
    );
    // Pass all necessary data to the utility function
    return generatePromptContent({
      allFiles,
      selectedFiles,
      selectedFolder,
      sortOrder,
      includeFileTree,
      includePromptOverview,
    });
  }, [
    allFiles,
    selectedFiles,
    selectedFolder,
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
  }, [isElectron]);

  const refreshFolder = useCallback(() => {
    const currentSelectedFolder =
      useProjectStore.getState().currentSelectedFolder;
    if (currentSelectedFolder) {
      logger.info(`Handler: refreshFolder called for ${currentSelectedFolder}`);
      fileRequestSentRef.current = false;
      setNeedsFilesReload(true);
      requestFileList(currentSelectedFolder, true);
    }
  }, [requestFileList, setNeedsFilesReload]);

  const reloadFolder = useCallback(() => {
    logger.info(`Handler: reloadFolder called (alias for refreshFolder)`);
    refreshFolder();
  }, [refreshFolder]);

  const handleSortChange = useCallback(
    (newSort: string) => {
      logger.info(`Handler: handleSortChange called with ${newSort}`);
      setSortOrder(newSort);
    },
    [setSortOrder]
  );

  const handleSearchChange = useCallback(
    (newSearch: string) => {
      logger.info(`Handler: handleSearchChange called with "${newSearch}"`);
      setSearchTerm(newSearch); // This updates the store state used by Sidebar
    },
    [setSearchTerm]
  );

  const handleViewChange = useCallback(
    (newView: "structured" | "flat") => {
      logger.info(`Handler: handleViewChange called with ${newView}`);
      setFileListView(newView);
    },
    [setFileListView]
  );

  const selectRecentFolder = useCallback(
    (folderPath: string) => {
      if (!isElectron) return;
      fileRequestSentRef.current = false;
      logger.info(`Handler: selectRecentFolder called with ${folderPath}`);
      setCurrentSelectedFolder(folderPath);
    },
    [isElectron, setCurrentSelectedFolder]
  );

  const removeRecentFolderHandler = useCallback(
    (folderPath: string) => {
      logger.info(
        `Handler: removeRecentFolderHandler called with ${folderPath}`
      );
      removeRecentFolder(folderPath);
    },
    [removeRecentFolder]
  );

  const handleExitFolder = useCallback(() => {
    logger.info(`Handler: handleExitFolder called`);
    fileRequestSentRef.current = false;
    exitFolder();
  }, [exitFolder]);

  // --- Effects ---
  useEffect(() => {
    // File Load Trigger based on needsFilesReload flag
    logger.debug(
      `useAppLogic #${hookRenderCount.current}: Running useEffect for file load trigger check. ` +
        `Hydrated: ${hasHydrated}, Electron: ${isElectron}, Folder: ${selectedFolder}, ` +
        `NeedsReload: ${needsFilesReload}, Status: ${processingStatus.status}, Sent: ${fileRequestSentRef.current}`
    );

    if (
      hasHydrated &&
      isElectron &&
      selectedFolder &&
      needsFilesReload &&
      !fileRequestSentRef.current &&
      processingStatus.status !== "processing"
    ) {
      logger.info(
        `useAppLogic Effect: Triggering requestFileList for ${selectedFolder} because needsFilesReload is TRUE.`
      );
      fileRequestSentRef.current = true;
      requestFileList(selectedFolder, false);
      setNeedsFilesReload(false);
    } else if (needsFilesReload && fileRequestSentRef.current) {
      logger.debug(
        `useAppLogic Effect: needsFilesReload is TRUE for ${selectedFolder}, but request already sent in this cycle. Skipping.`
      );
    } else if (needsFilesReload && processingStatus.status === "processing") {
      logger.debug(
        `useAppLogic Effect: needsFilesReload is TRUE for ${selectedFolder}, but skipping because status is 'processing'.`
      );
    } else if (!needsFilesReload && fileRequestSentRef.current) {
      logger.debug(
        "useAppLogic Effect: Resetting fileRequestSentRef because needsFilesReload is false."
      );
      fileRequestSentRef.current = false;
    } else if (hasHydrated && !selectedFolder) {
      if (needsFilesReload) setNeedsFilesReload(false);
      if (fileRequestSentRef.current) fileRequestSentRef.current = false;
      if (allFiles.length > 0) {
        logger.debug(
          "useAppLogic Effect: No folder selected, ensuring allFiles is cleared."
        );
        setStoreAllFilesAction([]);
      }
    }

    if (!hasHydrated) {
      logger.debug(
        `useAppLogic #${hookRenderCount.current}: Waiting for store hydration...`
      );
    }
  }, [
    selectedFolder,
    hasHydrated,
    isElectron,
    needsFilesReload,
    processingStatus.status,
    requestFileList,
    setNeedsFilesReload,
    allFiles.length,
    setStoreAllFilesAction,
  ]);

  // --- Return Values ---
  logger.debug(`useAppLogic #${hookRenderCount.current}: Returning values.`);
  return {
    // State
    hasHydrated,
    selectedFolder,
    recentFolders,
    allFiles, // Still needed for calculations
    processingStatus,
    selectedFiles, // Raw selected file paths list
    sortOrder,
    searchTerm, // Needed to pass to Sidebar if Sidebar doesn't use store directly
    fileListView,
    includeFileTree,
    includePromptOverview,
    // Derived State
    sortedAllFiles, // <-- RETURN THE SORTED LIST OF ALL FILES
    totalSelectedTokens,
    selectedContentFilesCount,
    // Handlers/Actions for UI
    openFolder,
    refreshFolder,
    reloadFolder,
    handleSortChange,
    handleSearchChange, // Pass to Sidebar
    handleViewChange,
    selectRecentFolder,
    removeRecentFolderHandler,
    handleExitFolder,
    setIncludeFileTree,
    setIncludePromptOverview,
    getSelectedFilesContent,
    toggleFileSelection, // Needed by FileList -> FileCard
    // The following are likely handled within Sidebar/TreeItem via store:
    // toggleFolderSelection,
    // selectAllFiles,
    // deselectAllFiles,
  };
};
