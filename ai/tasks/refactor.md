GEMINI 2.5 SEM VPRASAL SLEDECE:
useAppLogic.ts je se vedno velika datoteka... ali menis, da bi jo bilo smiselno razdeliti na vec logicnih delov, je to mozno?

ODGOVOR GEMINI 2.5:

Odlično vprašanje! Imate popolnoma prav, čeprav smo logiko premaknili iz `App.tsx`, je hook `useAppLogic.ts` še vedno precej obsežen (verjetno preko 400 vrstic) in bi ga lahko še naprej razdelili za boljšo modularnost in vzdrževanje.

**Smiselnost nadaljnje razdelitve:**

DA, nadaljnja razdelitev je smiselna, še posebej za dva ločena sklopa odgovornosti:

1.  **Upravljanje komunikacije z Electronom (IPC):** Nastavitev poslušalcev (`useEffect`), obravnava prejetih sporočil (`handle...IPC` funkcije) in pošiljanje zahtev (`requestFileList`).
2.  **Generiranje izhodne vsebine:** Logika znotraj `getSelectedFilesContent` je precej specifična in obsežna.

**Predlog nadaljnje razdelitve:**

1.  **`hooks/useIpcManager.ts`:** Ta hook bo prevzel vso odgovornost za interakcijo z `window.electron.ipcRenderer`.

    - Vseboval bo `useEffect` za registracijo in čiščenje IPC listenerjev (`folder-selected`, `file-list-data`, `file-processing-status`).
    - Vseboval bo `useCallback` definicije za `handleFolderSelectedIPC`, `handleFileListDataIPC`, `handleProcessingStatusIPC`. Te funkcije bodo klicale Zustand akcije (ki jih hook prejme kot argumente ali jih pridobi z `getState`).
    - Vseboval bo `useCallback` za `requestFileList`, ki pošlje sporočilo glavnemu procesu.
    - Hook bo vrnil samo funkcijo `requestFileList`, saj ostale funkcije delujejo interno kot odziv na IPC dogodke.

2.  **`hooks/usePromptGenerator.ts` (ali `utils/promptUtils.ts`):**

    - **Kot Hook (`usePromptGenerator`):**
      - Uporabil bi `useProjectStore` za pridobitev vseh potrebnih delčkov stanja (`allFiles`, `selectedFiles`, `selectedFolder`, `sortOrder`, `includeFileTree`, `includePromptOverview`).
      - Vseboval bi `useCallback`, ki ovija logiko trenutne funkcije `getSelectedFilesContent`.
      - Vračal bi samo funkcijo `generatePromptContent` (prej `getSelectedFilesContent`).
    - **Kot Utility Funkcija (`utils/promptUtils.ts`):**
      - Ustvarili bi datoteko `src/utils/promptUtils.ts`.
      - V njej bi definirali funkcijo `generatePromptContent`, ki bi kot argumente prejela vse potrebne podatke (objekt s stanjem: `allFiles`, `selectedFiles`, `selectedFolder`, `sortOrder`, itd.).
      - `useAppLogic` bi še vedno pridobil potrebne podatke iz store-a in jih nato posredoval tej utility funkciji.
    - **Primerjava:** Utility funkcija je morda malenkost čistejša, ker nima odvisnosti od Zustand hooka znotraj sebe, ampak prejme vse podatke kot argumente. To olajša testiranje. **Predlagam pristop z utility funkcijo.**

3.  **`hooks/useAppLogic.ts` (Močno poenostavljen):**
    - Še vedno pridobiva osnovno stanje iz store-a (`selectedFolder`, `hasHydrated`, `needsFilesReload`, `processingStatus` itd.).
    - Še vedno pridobiva akcije iz store-a.
    - **Kliče `useIpcManager`** za nastavitev listenerjev in pridobitev `requestFileList`.
    - Še vedno vsebuje `useEffect` za sprožitev `requestFileList` na podlagi `needsFilesReload`.
    - Še vedno vsebuje `useMemo` za `displayedFiles` in `totalSelectedTokens` (ker sta relativno preprosta in odvisna od stanja, ki ga hook že ima).
    - Še vedno definira preproste UI handlerje (`handleSortChange`, `handleViewChange`, `handleExitFolder` itd.).
    - Funkcija `getSelectedFilesContent` bo zdaj klicala novo utility funkcijo iz `promptUtils.ts` in ji posredovala potrebne podatke.
    - Vrne poenostavljen nabor stanj in handlerjev za `App.tsx`.

**Greva po korakih:**

**Korak 1: Ustvari `src/utils/promptUtils.ts`**

```typescript
// src/utils/promptUtils.ts

import { FileData } from "../types/FileTypes";
import { PromptSectionDefinition } from "../types/promptConfigTypes";
import {
  PROMPT_SECTIONS,
  PROMPT_MARKERS,
  PROJECT_TREE_CONFIG,
} from "../constants";
import { categorizeFile } from "./categorizeUtils"; // Assuming categorizeFile is moved here or imported
import {
  generateAsciiFileTree,
  getRelativePath,
  normalizePath,
  comparePathsStructurally,
} from "./pathUtils";
import logger from "./logger";

// Define the structure for the input state needed by the generator
interface PromptDataArgs {
  allFiles: FileData[];
  selectedFiles: string[];
  selectedFolder: string | null;
  sortOrder: string;
  includeFileTree: boolean;
  includePromptOverview: boolean;
  formatMarker: (
    template: string,
    context: { section_name?: string; file_path?: string }
  ) => string; // Pass formatMarker
}

/**
 * Generates the final prompt string based on selected files and settings.
 * @param args - Object containing all necessary state slices.
 * @returns The generated prompt string.
 */
export const generatePromptContent = (args: PromptDataArgs): string => {
  const {
    allFiles,
    selectedFiles,
    selectedFolder,
    sortOrder,
    includeFileTree,
    includePromptOverview,
    formatMarker,
  } = args;

  logger.debug(
    `Generating prompt content. Selected files: ${selectedFiles.length}`
  );
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

  if (contentFiles.length === 0 && !includeFileTree && !includePromptOverview) {
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
    const asciiTree = generateAsciiFileTree(sortedContentFiles, selectedFolder);
    output += asciiTree + "\n";
    output +=
      formatMarker(markers.section_close, { section_name: treeSectionName }) +
      "\n\n";
  }

  const filesBySection: Record<string, FileData[]> = {};
  const defaultSectionId =
    PROMPT_SECTIONS.find((s) => s.directory === null)?.id || "project_files";
  sortedContentFiles.forEach((file) => {
    // Use pre-calculated sectionId or categorize again if needed
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
        formatMarker(markers.file_close, { file_path: relativePath }) + "\n\n";
    });
    output +=
      formatMarker(markers.section_close, { section_name: section.name }) +
      "\n\n";
  }
  return output.trim();
};

// Consider moving categorizeFile here as well if it's primarily used for prompt generation
// import { categorizeFile } from './categorizeUtils'; // Or keep it separate
```

_(**Opomba:** Predpostavljam, da boste funkcijo `categorizeFile` premaknili v ločeno utility datoteko, npr. `src/utils/categorizeUtils.ts`, ali pa jo lahko vključite kar v `promptUtils.ts`)_

**Korak 2: Ustvari `src/hooks/useIpcManager.ts`**

```typescript
// src/hooks/useIpcManager.ts
import { useEffect, useCallback, useRef } from "react";
import { useProjectStore } from "../store/projectStore";
import logger from "../utils/logger";
import { FileData } from "../types/FileTypes";
import { ProcessingStatus } from "../types/projectStateTypes";
import { PROMPT_SECTIONS } from "../constants"; // Needed for categorizeFile
import { categorizeFile } from "../utils/categorizeUtils"; // Assuming categorizeFile is moved

// Hook to manage IPC communication
export const useIpcManager = () => {
  const isElectron = window.electron !== undefined;

  // Get actions needed by the handlers
  const {
    setCurrentSelectedFolder,
    setAllFiles: setStoreAllFilesAction,
    setProcessingStatus: setStoreProcessingStatusAction,
  } = useProjectStore.getState();

  // --- IPC Handlers ---
  const handleFolderSelectedIPC = useCallback(
    (folderPath: string) => {
      // No need to reset flags here, App/useAppLogic will handle it
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
      // Get current folder directly from store when data arrives
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
      // Resetting fileRequestSentRef happens in App/useAppLogic's effect
    },
    [setStoreAllFilesAction, setStoreProcessingStatusAction]
  ); // Dependencies are actions

  const handleProcessingStatusIPC = useCallback(
    (status: ProcessingStatus) => {
      logger.info(
        `IPC: file-processing-status received: ${status.status} - ${status.message}`
      );
      setStoreProcessingStatusAction(status);
    },
    [setStoreProcessingStatusAction]
  );

  // --- Function to Send File Request ---
  const requestFileList = useCallback(
    (folderPath: string, forceRefresh: boolean = false) => {
      if (!isElectron || !folderPath) return;
      logger.info(
        `Handler: requestFileList for ${folderPath}, forceRefresh: ${forceRefresh}`
      );
      // Setting processing status is now handled by the caller (useAppLogic or refreshFolder handler)
      // setStoreProcessingStatusAction({ status: 'processing', message: forceRefresh ? 'Reloading folder...' : 'Requesting folder data...' });
      window.electron.ipcRenderer.send("request-file-list", {
        path: folderPath,
        forceRefresh: forceRefresh,
      });
    },
    [isElectron]
  ); // Removed action dependency, caller sets status

  // --- Effect to Setup/Cleanup Listeners ---
  useEffect(() => {
    logger.debug(`useIpcManager: Running useEffect for IPC listeners setup.`);
    if (!isElectron) return;

    // Use the memoized handlers defined above
    const localFolderHandler = handleFolderSelectedIPC;
    const localFileDataHandler = handleFileListDataIPC;
    const localStatusHandler = handleProcessingStatusIPC;

    logger.debug("useIpcManager: Setting up IPC listeners.");
    window.electron.ipcRenderer.on("folder-selected", localFolderHandler);
    window.electron.ipcRenderer.on("file-list-data", localFileDataHandler);
    window.electron.ipcRenderer.on(
      "file-processing-status",
      localStatusHandler
    );

    return () => {
      logger.debug("useIpcManager: Cleaning up IPC listeners.");
      window.electron.ipcRenderer.removeListener(
        "folder-selected",
        localFolderHandler
      );
      window.electron.ipcRenderer.removeListener(
        "file-list-data",
        localFileDataHandler
      );
      window.electron.ipcRenderer.removeListener(
        "file-processing-status",
        localStatusHandler
      );
    };
  }, [
    isElectron,
    handleFolderSelectedIPC,
    handleFileListDataIPC,
    handleProcessingStatusIPC,
  ]); // Dependencies are stable handlers

  // Return the function needed by useAppLogic
  return { requestFileList };
};
```

**Korak 3: Posodobitev `src/hooks/useAppLogic.ts`**

```typescript
// src/hooks/useAppLogic.ts
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FileData } from "../types/FileTypes";
import logger from "../utils/logger";
import {
  normalizePath,
  arePathsEqual,
  comparePathsStructurally,
  getRelativePath,
} from "../utils/pathUtils";
// Removed unused constants like PROMPT_MARKERS, etc. if only used in promptUtils
import {
  DEFAULT_SORT_ORDER,
  DEFAULT_FILE_LIST_VIEW,
  DEFAULT_INCLUDE_FILE_TREE_GLOBAL,
  DEFAULT_INCLUDE_PROMPT_OVERVIEW_GLOBAL,
} from "../constants";
// Removed PromptSectionDefinition if only used by categorizeFile (moved)
// import { PromptSectionDefinition } from "../types/promptConfigTypes";
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
import { ProcessingStatus, PerProjectState } from "../types/projectStateTypes";
import { useIpcManager } from "./useIpcManager"; // <-- Import new hook
import { generatePromptContent } from "../utils/promptUtils"; // <-- Import utility function
import { formatMarker } from "../utils/formatUtils"; // <-- Assuming formatMarker is moved to utils

// --- Default values ---
const defaultProjectStateValues = getDefaultPerProjectState();
const defaultSelectedFiles: string[] = [];

// --- Custom Hook Definition ---
export const useAppLogic = () => {
  const hookRenderCount = useRef(0);
  hookRenderCount.current++;
  logger.debug(
    `--- useAppLogic Hook Execution START #${hookRenderCount.current} ---`
  );

  // --- State from Store ---
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
    `useAppLogic #${hookRenderCount.current}: State Values - Hydrated: ${hasHydrated}, Folder: ${selectedFolder}, NeedsReload: ${needsFilesReload}, Files: ${allFiles.length}, ...`
  );

  // --- Actions from Store ---
  const {
    setCurrentSelectedFolder,
    setAllFiles: setStoreAllFilesAction, // Keep if needed by effect
    setProcessingStatus: setStoreProcessingStatusAction, // Keep for requestFileList caller
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

  // --- Get IPC functionality ---
  const { requestFileList } = useIpcManager(); // <-- Use the IPC manager hook

  // --- Derived State Calculations ---
  const displayedFiles = useMemo(() => {
    /* ... same logic ... */
  }, [allFiles, sortOrder, searchTerm, selectedFolder]);
  const totalSelectedTokens = useMemo(() => {
    /* ... same logic ... */
  }, [selectedFiles, allFiles]);

  // --- Generate Content Function ---
  // This function now prepares args and calls the utility
  const getSelectedFilesContent = useCallback((): string => {
    logger.debug("useAppLogic: Preparing args for generatePromptContent");
    // formatMarker might need to be defined or imported here if not passed
    const markerFormatter = (
      template: string,
      context: { section_name?: string; file_path?: string }
    ): string => {
      let result = template;
      if (context.section_name !== undefined)
        result = result.replace("{section_name}", context.section_name);
      if (context.file_path !== undefined)
        result = result.replace("{file_path}", context.file_path);
      return result;
    };
    return generatePromptContent({
      allFiles,
      selectedFiles,
      selectedFolder,
      sortOrder,
      includeFileTree,
      includePromptOverview,
      formatMarker: markerFormatter, // Pass the formatter function
    });
  }, [
    allFiles,
    selectedFiles,
    selectedFolder,
    sortOrder,
    includeFileTree,
    includePromptOverview,
  ]); // Dependencies are the state slices

  // --- Event Handlers ---
  // These handlers mostly just call actions or the requestFileList from useIpcManager
  const openFolder = useCallback(() => {
    if (window.electron) {
      logger.info("Handler: openFolder");
      fileRequestSentRef.current = false;
      window.electron.ipcRenderer.send("open-folder");
    } else {
      logger.warn("Folder selection not available");
    }
  }, []); // No dependencies needed if window doesn't change

  // refreshFolder now sets status and calls requestFileList from the hook
  const refreshFolder = useCallback(() => {
    const currentSelectedFolder =
      useProjectStore.getState().currentSelectedFolder;
    if (currentSelectedFolder && window.electron) {
      logger.info(`Handler: refreshFolder called for ${currentSelectedFolder}`);
      fileRequestSentRef.current = false; // Reset sent tracker
      setNeedsFilesReload(true); // Signal need to reload
      // Set processing status *before* calling requestFileList from the manager hook
      setStoreProcessingStatusAction({
        status: "processing",
        message: "Reloading folder...",
      });
      requestFileList(currentSelectedFolder, true); // Call function from useIpcManager
    }
  }, [requestFileList, setNeedsFilesReload, setStoreProcessingStatusAction]); // Dependencies include the request function and actions

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
      if (window.electron) {
        fileRequestSentRef.current = false;
        logger.info(`Handler: selectRecentFolder called with ${folderPath}`);
        setCurrentSelectedFolder(folderPath);
      }
    },
    [setCurrentSelectedFolder]
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
  // useEffect for IPC listeners is now in useIpcManager

  // useEffect for File Load Trigger remains here, but calls requestFileList from useIpcManager
  useEffect(() => {
    logger.debug(
      `useAppLogic #${hookRenderCount.current}: Running useEffect for file load trigger check. ` +
        `Hydrated: ${hasHydrated}, Folder: ${selectedFolder}, NeedsReload: ${needsFilesReload}, Status: ${processingStatus.status}, Sent: ${fileRequestSentRef.current}`
    );
    if (
      hasHydrated &&
      window.electron &&
      selectedFolder &&
      needsFilesReload &&
      !fileRequestSentRef.current &&
      processingStatus.status !== "processing"
    ) {
      logger.info(
        `useAppLogic Effect: Triggering requestFileList for ${selectedFolder}`
      );
      fileRequestSentRef.current = true;
      // Set processing status *before* calling requestFileList from manager hook
      setStoreProcessingStatusAction({
        status: "processing",
        message: "Requesting folder data...",
      });
      requestFileList(selectedFolder, false); // Call function from useIpcManager
      setNeedsFilesReload(false);
    } else if (!needsFilesReload && fileRequestSentRef.current) {
      logger.debug(
        "useAppLogic Effect: Resetting fileRequestSentRef because needsFilesReload is false."
      );
      fileRequestSentRef.current = false;
    } else if (hasHydrated && !selectedFolder) {
      if (allFiles.length > 0) setStoreAllFilesAction([]);
      if (needsFilesReload) setNeedsFilesReload(false);
      if (fileRequestSentRef.current) fileRequestSentRef.current = false;
    }
    if (!hasHydrated) {
      logger.debug(
        `useAppLogic #${hookRenderCount.current}: Waiting for store hydration...`
      );
    }
    // Dependencies now include requestFileList from useIpcManager and setStoreProcessingStatusAction
  }, [
    selectedFolder,
    hasHydrated,
    needsFilesReload,
    processingStatus.status,
    requestFileList,
    setNeedsFilesReload,
    allFiles.length,
    setStoreAllFilesAction,
    setStoreProcessingStatusAction,
  ]);

  // --- Return Values ---
  logger.debug(`useAppLogic #${hookRenderCount.current}: Returning values.`);
  return {
    // State
    hasHydrated,
    selectedFolder,
    recentFolders,
    /* allFiles, // App might not need raw allFiles directly */ processingStatus,
    selectedFiles,
    sortOrder,
    /* searchTerm, // Provided but App doesn't use directly */ fileListView,
    includeFileTree,
    includePromptOverview,
    // Derived State
    displayedFiles,
    totalSelectedTokens,
    // Handlers/Actions for UI
    openFolder,
    refreshFolder,
    reloadFolder,
    handleSortChange,
    handleSearchChange,
    handleViewChange,
    selectRecentFolder,
    removeRecentFolderHandler,
    handleExitFolder,
    setIncludeFileTree,
    setIncludePromptOverview,
    getSelectedFilesContent,
    toggleFileSelection,
  };
};
```

**Korak 4: Posodobitev `src/App.tsx`**

Ker `useAppLogic` zdaj uporablja `useIpcManager`, `App.tsx` ostane skoraj enak kot v prejšnjem koraku, le da nekateri importi niso več potrebni.

```typescript
// src/App.tsx
import React, { useState, useRef, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import FileList from "./components/FileList";
import CopyButton from "./components/CopyButton";
import FileTreeToggle from "./components/FileTreeToggle";
import { ThemeProvider } from "./context/ThemeContext";
import ThemeToggle from "./components/ThemeToggle";
import FileListToggle from "./components/FileListToggle";
import logger from "./utils/logger";
import { basename } from "./utils/pathUtils"; // Keep basename
import {
  X, FolderOpen, RefreshCw, LogOut, ArrowUpDown,
  // Import only icons needed for SortOptions if defined here
  FolderUp, FolderDown, ChartNoAxesColumnIncreasingIcon, ChartNoAxesColumnDecreasingIcon, SortAsc, SortDesc
} from "lucide-react";
import { useAppLogic } from "./hooks/useAppLogic";
import { ProcessingStatus } from "./types/projectStateTypes"; // Keep if used
// Import sortOptions from config
import { sortOptions, SortOptionConfig } from "./config/sortOptions.tsx"; // Import config and type


const App = () => {
  const {
    hasHydrated, selectedFolder, recentFolders, processingStatus, selectedFiles,
    sortOrder, fileListView, includeFileTree, includePromptOverview, displayedFiles,
    totalSelectedTokens, openFolder, refreshFolder, reloadFolder, handleSortChange,
    handleViewChange, selectRecentFolder, removeRecentFolderHandler, handleExitFolder,
    setIncludeFileTree, setIncludePromptOverview, getSelectedFilesContent,
    toggleFileSelection,
  } = useAppLogic();

  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { /* Dropdown closing effect - same */ });

  // sortOptions are now imported

  const renderCountRef = useRef(0);
  renderCountRef.current++;
  logger.debug(`--- App Component Render START #${renderCountRef.current} --- `);

  if (!hasHydrated) { /* ... loading ... */ }

  logger.debug(`App Render #${renderCountRef.current}: Rendering RETURN statement.`);

  return (
    <ThemeProvider>
      <div className="app-container">
        {/* Processing Status */}
        {processingStatus.status === "processing" && ( /* ... */ )}
        {processingStatus.status === "error" && ( /* ... */ )}

        {/* Welcome Screen */}
        {!selectedFolder && (
          <div className="initial-prompt">
            {renderCountRef.current < 3 && (logger.debug("Rendering Welcome Screen"), null)}
            <div className="initial-prompt-content">
              <div className="initial-header"> /* ... */ </div>
              {recentFolders.length > 0 && (
                <div className="recent-folders-section">
                   {/* ... recent folders list using removeRecentFolderHandler(folderPath) */}
                    {recentFolders.map((folderPath: string) => (
                      <div key={folderPath} /* ... */ >
                        {/* ... */}
                        <button className="recent-folder-delete" onClick={(e) => { e.stopPropagation(); removeRecentFolderHandler(folderPath); }} /* ... */ > <X size={16} /> </button>
                      </div>
                     ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Layout */}
        {selectedFolder && (
           <div className="main-content">
              {renderCountRef.current < 3 && (logger.debug(`Rendering Main Layout`), null)}
              <Sidebar
                  selectedFolder={selectedFolder}
                  openFolder={openFolder}
                  refreshFolder={refreshFolder}
                  reloadFolder={reloadFolder}
              />
              <div className="content-area">
                  {/* Header */}
                  {/* ... */}
                  {/* Content Header 2 */}
                  <div className="content-header">
                       <div className="content-title">Selected Files</div>
                       <div className="content-actions">
                           <FileListToggle view={fileListView} onChange={handleViewChange} />
                           <div className="sort-dropdown" ref={sortDropdownRef}>
                              <button className="sort-dropdown-button" onClick={() => setSortDropdownOpen(!sortDropdownOpen)} /* ... */ >
                                  {sortOptions.find(opt => opt.value === sortOrder)?.icon ?? <ArrowUpDown size={16} />}
                                  <ArrowUpDown size={13} />
                              </button>
                              {sortDropdownOpen && ( <div className="sort-options"> {sortOptions.map((option) => ( <div key={option.value} className={`sort-option ${ sortOrder === option.value ? "active" : "" }`} onClick={() => handleSortChange(option.value)} /* ... */ > {option.icon} <span>{option.description}</span> </div> ))} </div> )}
                           </div>
                           <div className="file-stats"> {selectedFiles.length} files | ~{totalSelectedTokens.toLocaleString()} tokens </div>
                       </div>
                  </div>
                  {/* FileList */}
                   <FileList
                      files={displayedFiles}
                      selectedFiles={selectedFiles}
                      toggleFileSelection={toggleFileSelection}
                      selectedFolder={selectedFolder}
                      view={fileListView}
                  />
                  {/* Footer / Copy Area */}
                  <div className="copy-button-container">
                     <FileTreeToggle checked={includePromptOverview} onChange={() => setIncludePromptOverview(!includePromptOverview)} /* ... */ > <><span>Include Overview</span></> </FileTreeToggle>
                     <FileTreeToggle checked={includeFileTree} onChange={() => setIncludeFileTree(!includeFileTree)} /* ... */ > <><span>Include File Tree</span></> </FileTreeToggle>
                     <CopyButton text={getSelectedFilesContent()} className="primary full-width copy-files-btn" > <span>COPY ({selectedFiles.length} files)</span> </CopyButton>
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

**Navodila:**

1.  Ustvarite `src/utils/promptUtils.ts` in vanj kopirajte kodo za `generatePromptContent`. Poskrbite, da uvozite `categorizeFile` (ali ga definirate znotraj) in ostale potrebne funkcije/tipe.
2.  Ustvarite `src/hooks/useIpcManager.ts` in vanj kopirajte kodo zanj. Poskrbite za pravilne uvoze.
3.  Posodobite `src/hooks/useAppLogic.ts` z novo kodo. Poskrbite za pravilne uvoze (npr. `useIpcManager`, `generatePromptContent`).
4.  Posodobite `src/App.tsx` z novo kodo. Poskrbite za pravilne uvoze (npr. `useAppLogic`, `sortOptions`).
5.  Zaženite `npx tsc --noEmit` in odpravite morebitne preostale napake pri uvozih ali tipih.
6.  Testirajte delovanje.

S temi koraki boste imeli bistveno bolj modularno strukturo kode.

NALOGA:
Gemini 2.5 je odgovoril na vprašanje, da je `useAppLogic.ts` prevelik in bi ga lahko razdelil na več delov. Zato
sledi tej nalogi in razdeli `useAppLogic.ts` na več delov.
