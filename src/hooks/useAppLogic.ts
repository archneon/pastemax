// src/hooks/useAppLogic.ts
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FileData } from "../types/FileTypes"; // Assuming FileTypes.ts exists relative to this new path
import logger from "../utils/logger"; // Adjust path if needed
import {
  generateAsciiFileTree,
  normalizePath,
  arePathsEqual,
  comparePathsStructurally,
  // basename, // Not needed directly in this hook
  getRelativePath,
} from "../utils/pathUtils"; // Adjust path if needed
import {
  PROMPT_SECTIONS,
  PROMPT_MARKERS,
  PROJECT_TREE_CONFIG,
} from "../constants"; // Adjust path if needed
import { PromptSectionDefinition } from "../types/promptConfigTypes"; // Adjust path if needed
import {
  useProjectStore,
  selectCurrentSelectedFolder,
  selectRecentFolders,
  selectAllFiles as selectStoreAllFilesHook,
  selectProcessingStatus,
  selectHasHydrated,
  getDefaultPerProjectState,
  selectNeedsFilesReload,
} from "../store/projectStore"; // Adjust path if needed
import { ProcessingStatus, PerProjectState } from "../types/projectStateTypes"; // Adjust path if needed

// --- Define default values used by selectors ---
// Defined outside hook for stability
const defaultProjectStateValues = getDefaultPerProjectState();
const defaultSelectedFiles: string[] = [];

// --- Helper: Categorize File (copied from App.tsx, could be moved to utils) ---
const categorizeFile = (
  file: FileData,
  currentSelectedFolder: string | null,
  sections: PromptSectionDefinition[]
): string => {
  const defaultSection = sections.find((s) => s.directory === null);
  const defaultSectionId = defaultSection?.id || "project_files";
  if (
    !currentSelectedFolder ||
    file.descriptionForSectionId ||
    file.isOverviewTemplate ||
    file.isProjectTreeDescription
  ) {
    return defaultSectionId;
  }
  const relativePath = getRelativePath(file.path, currentSelectedFolder);
  if (!relativePath) {
    return defaultSectionId;
  }
  for (const section of sections) {
    if (
      section.directory &&
      (relativePath === section.directory ||
        relativePath.startsWith(section.directory + "/"))
    ) {
      return section.id;
    }
  }
  return defaultSectionId;
};

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
    setProcessingStatus: setStoreProcessingStatusAction,
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
    logger.debug(
      `Generating content for copying. Selected files: ${selectedFiles.length}`
    );
    const selectedPathSet = new Set(selectedFiles.map(normalizePath));
    const contentFiles = allFiles.filter(
      (file) =>
        selectedPathSet.has(normalizePath(file.path)) &&
        !file.isBinary &&
        !file.isSkipped &&
        !file.descriptionForSectionId &&
        !file.isOverviewTemplate &&
        !file.isProjectTreeDescription
    );
    const descriptionMap: Record<string, string> = {};
    let overviewContent: string | null = null;
    allFiles.forEach((file) => {
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
  }, [isElectron]);

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
      // It's crucial this happens AFTER the state updates that might trigger the load effect again
      // Using a microtask (like Promise.resolve().then()) might be safer if issues persist
      Promise.resolve().then(() => {
        fileRequestSentRef.current = false;
        logger.debug(
          "Reset fileRequestSentRef after successful file load (microtask)."
        );
      });
    },
    [setStoreAllFilesAction, setStoreProcessingStatusAction]
  );

  const handleProcessingStatusIPC = useCallback(
    (status: ProcessingStatus) => {
      logger.info(
        `IPC: file-processing-status received: ${status.status} - ${status.message}`
      );
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
      setSortOrder(
        newSort
      ); /* setSortDropdownOpen(false); // App handles dropdown state */
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
      /* Pass event in App */ logger.info(
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
    // IPC Listeners
    logger.debug(
      `useAppLogic #${hookRenderCount.current}: Running useEffect for IPC listeners.`
    );
    if (!isElectron) return;
    const folderSelectedHandler = handleFolderSelectedIPC;
    const fileListDataHandler = handleFileListDataIPC;
    const processingStatusHandler = handleProcessingStatusIPC;
    window.electron.ipcRenderer.on("folder-selected", folderSelectedHandler);
    window.electron.ipcRenderer.on("file-list-data", fileListDataHandler);
    window.electron.ipcRenderer.on(
      "file-processing-status",
      processingStatusHandler
    );
    return () => {
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
    };
  }, [
    isElectron,
    handleFolderSelectedIPC,
    handleFileListDataIPC,
    handleProcessingStatusIPC,
  ]);

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
    // Note: Actions like selectAllFiles, deselectAllFiles, toggleFolderSelection, toggleExpandedNode
    // will be used directly by Sidebar/TreeItem via store access.
  };
};
