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

// --- Define default values used by selectors ---
// Defined outside hook for stability
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
  } = useProjectStore.getState();

  // --- Ref for preventing duplicate requests ---
  const fileRequestSentRef = useRef<boolean>(false);

  const isElectron = window.electron !== undefined;

  // --- Get IPC functionality ---
  const { requestFileList } = useIpcManager();

  // --- Derived State Calculations ---
  const displayedFiles = useMemo(() => {
    logger.debug(
      `useAppLogic #${hookRenderCount.current}: Recalculating displayedFiles.`
    );
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
    logger.debug(
      `useAppLogic #${hookRenderCount.current}: Recalculating totalSelectedTokens.`
    );
    const selectedFilesSet = new Set(selectedFiles.map(normalizePath));
    return allFiles.reduce((total, file) => {
      if (selectedFilesSet.has(normalizePath(file.path))) {
        return total + (file.tokenCount || 0);
      }
      return total;
    }, 0);
  }, [selectedFiles, allFiles]);

  // --- Generate Content for Copying ---
  const getSelectedFilesContent = useCallback(() => {
    logger.debug(
      `useAppLogic #${hookRenderCount.current}: Generating content for copying.`
    );

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
      fileRequestSentRef.current = false; // Reset sent tracker
      setNeedsFilesReload(true); // Explicitly signal need to reload
      requestFileList(currentSelectedFolder, true);
    }
  }, [requestFileList, setNeedsFilesReload]);

  const reloadFolder = useCallback(() => {
    logger.info(`Handler: reloadFolder called`);
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
      setSearchTerm(newSearch);
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
      fileRequestSentRef.current = true; // Mark as sent *before* request
      requestFileList(selectedFolder, false);
      setNeedsFilesReload(false); // Reset flag *immediately* after triggering
    } else if (needsFilesReload && fileRequestSentRef.current) {
      logger.debug(
        `useAppLogic Effect: needsFilesReload is TRUE for ${selectedFolder}, but request already sent in this cycle. Skipping.`
      );
    } else if (needsFilesReload && processingStatus.status === "processing") {
      logger.debug(
        `useAppLogic Effect: needsFilesReload is TRUE for ${selectedFolder}, but skipping because status is 'processing'.`
      );
    } else if (!needsFilesReload && fileRequestSentRef.current) {
      // If reload is no longer needed, reset the sent flag
      logger.debug(
        "useAppLogic Effect: Resetting fileRequestSentRef because needsFilesReload is false."
      );
      fileRequestSentRef.current = false;
    } else if (hasHydrated && !selectedFolder) {
      // Ensure flags are reset if no folder is selected
      if (needsFilesReload) setNeedsFilesReload(false);
      if (fileRequestSentRef.current) fileRequestSentRef.current = false;
      // Clear files if necessary (moved logic from previous version)
      if (allFiles.length > 0) {
        logger.debug(
          "useAppLogic Effect: No folder selected, clearing allFiles."
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
    allFiles, // Raw file list
    processingStatus,
    selectedFiles,
    sortOrder,
    searchTerm, // Needed for SearchBar via SidebarHeader
    fileListView,
    includeFileTree,
    includePromptOverview,
    // Derived State
    displayedFiles, // Filtered and sorted list for FileList
    totalSelectedTokens,
    // Handlers/Actions for UI
    openFolder,
    refreshFolder,
    reloadFolder,
    handleSortChange, // Pass to App for Sort Dropdown
    handleSearchChange, // Pass to SidebarHeader for SearchBar
    handleViewChange, // Pass to App for FileListToggle
    selectRecentFolder,
    removeRecentFolderHandler, // Pass the actual handler function
    handleExitFolder,
    setIncludeFileTree, // Pass to App for FileTreeToggle
    setIncludePromptOverview, // Pass to App for FileTreeToggle
    getSelectedFilesContent, // Pass to App for CopyButton
    toggleFileSelection, // Pass to FileList -> FileCard
  };
};
