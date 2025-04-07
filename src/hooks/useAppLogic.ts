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
  selectNeedsFilesReload, // Ensure this is imported
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
  const needsFilesReload = useProjectStore(selectNeedsFilesReload); // Already getting this

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
    setNeedsFilesReload, // Action to clear the flag
    toggleFolderSelection,
    selectAllFiles: selectAllFilesAction,
    deselectAllFiles: deselectAllFilesAction,
  } = useProjectStore.getState();

  // --- Ref for preventing duplicate requests ---
  const fileRequestSentRef = useRef<boolean>(false); // Ref to prevent multiple requests per cycle

  const isElectron = window.electron !== undefined;

  // --- Get IPC functionality ---
  const { requestFileList } = useIpcManager();

  // --- Derived State Calculations ---

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
    return sorted; // Return the sorted list of all files
  }, [allFiles, sortOrder, selectedFolder]);

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

  const hasOverviewFile = useMemo(() => {
    const overviewFile = allFiles.find((file) => file.fileKind === "overview");
    const existsAndNotEmpty = !!(
      overviewFile &&
      overviewFile.content &&
      overviewFile.content.trim().length > 0
    );
    logger.debug(
      `useAppLogic: Calculated hasOverviewFile: ${existsAndNotEmpty}`
    );
    return existsAndNotEmpty;
  }, [allFiles]);

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
      fileRequestSentRef.current = false; // Reset ref on new folder open attempt
      window.electron.ipcRenderer.send("open-folder");
    } else {
      logger.warn("Folder selection not available in browser");
    }
  }, [isElectron]);

  const refreshFolder = useCallback(() => {
    const currentSelectedFolder =
      useProjectStore.getState().currentSelectedFolder;
    if (currentSelectedFolder) {
      logger.info(
        `Handler: refreshFolder called for ${currentSelectedFolder} (forcing refresh)`
      );
      fileRequestSentRef.current = false; // Allow immediate request
      // No need to setNeedsFilesReload here, requestFileList will handle status
      requestFileList(currentSelectedFolder, true); // Force refresh
    }
  }, [requestFileList /* remove setNeedsFilesReload dependency */]);

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
      fileRequestSentRef.current = false; // Reset ref when selecting a recent folder
      logger.info(`Handler: selectRecentFolder called with ${folderPath}`);
      setCurrentSelectedFolder(folderPath); // This will trigger the needsFilesReload flag in the store
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
    fileRequestSentRef.current = false; // Reset ref on exit
    exitFolder();
  }, [exitFolder]);

  // --- Effects ---
  useEffect(() => {
    // File Load Trigger based on needsFilesReload flag
    const effectId = Math.random().toString(36).substring(2, 8); // For unique logging
    logger.debug(
      `useAppLogic #${hookRenderCount.current} Effect [${effectId}]: Running file load trigger check. ` +
        `Hydrated: ${hasHydrated}, Electron: ${isElectron}, Folder: ${selectedFolder}, ` +
        `NeedsReload: ${needsFilesReload}, Status: ${processingStatus.status}, SentRef: ${fileRequestSentRef.current}`
    );

    if (
      hasHydrated &&
      isElectron &&
      selectedFolder &&
      needsFilesReload && // Check if the reload flag is set
      !fileRequestSentRef.current && // Ensure a request wasn't just sent
      processingStatus.status !== "processing" // Ensure we aren't already processing
    ) {
      logger.info(
        `useAppLogic Effect [${effectId}]: Triggering requestFileList for ${selectedFolder} because needsFilesReload is TRUE. **Forcing refresh.**` // Log forceRefresh
      );
      fileRequestSentRef.current = true; // Mark as sent for this cycle

      // ====================================================================
      // *** THE FIX: Pass 'true' for forceRefresh parameter ***
      // ====================================================================
      requestFileList(selectedFolder, true);
      // ====================================================================

      // Clear the flag *after* initiating the request
      setNeedsFilesReload(false);
      logger.debug(
        `useAppLogic Effect [${effectId}]: Cleared needsFilesReload flag after requesting forced refresh.`
      );
    } else if (needsFilesReload && fileRequestSentRef.current) {
      logger.debug(
        `useAppLogic Effect [${effectId}]: needsFilesReload is TRUE for ${selectedFolder}, but request already sent in this cycle. Skipping.`
      );
      // Do not clear the flag here; let the successful load handle it or subsequent checks.
    } else if (needsFilesReload && processingStatus.status === "processing") {
      logger.debug(
        `useAppLogic Effect [${effectId}]: needsFilesReload is TRUE for ${selectedFolder}, but skipping because status is 'processing'.`
      );
    } else if (!needsFilesReload && fileRequestSentRef.current) {
      // Reset the ref if the need for reload is gone (e.g., user exited folder)
      // AND a request *was* sent previously in the logic flow.
      // This allows a new request if the user re-selects the folder quickly.
      logger.debug(
        `useAppLogic Effect [${effectId}]: Resetting fileRequestSentRef because needsFilesReload is false.`
      );
      fileRequestSentRef.current = false;
    } else if (hasHydrated && !selectedFolder) {
      // Cleanup if no folder is selected after hydration
      if (needsFilesReload) {
        logger.debug(
          `useAppLogic Effect [${effectId}]: No folder selected, clearing needsFilesReload flag.`
        );
        setNeedsFilesReload(false);
      }
      if (fileRequestSentRef.current) {
        logger.debug(
          `useAppLogic Effect [${effectId}]: No folder selected, resetting fileRequestSentRef.`
        );
        fileRequestSentRef.current = false;
      }
      // Clearing allFiles might be redundant if setCurrentSelectedFolder already does it,
      // but it's safe to keep for explicit state management.
      if (allFiles.length > 0) {
        logger.debug(
          `useAppLogic Effect [${effectId}]: No folder selected, ensuring allFiles is cleared.`
        );
        setStoreAllFilesAction([]);
      }
    }

    if (!hasHydrated) {
      logger.debug(
        `useAppLogic #${hookRenderCount.current} Effect [${effectId}]: Waiting for store hydration...`
      );
    }
    // --- Dependencies ---
    // The core dependencies trigger the check when needed:
    // - selectedFolder: Changes when a new folder is picked.
    // - hasHydrated: Changes once when the store loads.
    // - isElectron: Should be constant, but harmless.
    // - needsFilesReload: Changes when hydration or refresh sets the flag.
    // - processingStatus.status: Changes during file loading.
    // Actions/functions (requestFileList, setNeedsFilesReload, setStoreAllFilesAction) are stable references from Zustand/useCallback.
    // allFiles.length is included to ensure the cleanup logic runs if files exist when folder becomes null.
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

  // --- Return Values ---
  logger.debug(`useAppLogic #${hookRenderCount.current}: Returning values.`);
  return {
    // State
    hasHydrated,
    selectedFolder,
    recentFolders,
    allFiles, // Raw data for calculations/context
    processingStatus,
    selectedFiles, // Raw selected file paths list
    sortOrder,
    searchTerm, // Pass to Sidebar or components needing it
    fileListView,
    includeFileTree,
    includePromptOverview,
    // Derived State
    sortedAllFiles, // Pass this sorted list to FileList
    totalSelectedTokens,
    selectedContentFilesCount,
    hasOverviewFile,
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
    toggleFileSelection, // Needed by FileList -> FileCard & potentially TreeItem
    // toggleFolderSelection, // Needed by TreeItem
    // selectAllFilesAction, // Needed by Sidebar
    // deselectAllFilesAction, // Needed by Sidebar
    // NOTE: Actions like toggleFolderSelection, selectAllFiles, deselectAllFiles
    // are accessed directly via useProjectStore.getState() in components like
    // Sidebar and TreeItem, so they don't necessarily need to be returned here.
  };
};
