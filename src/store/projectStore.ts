// src/store/projectStore.ts
import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import {
  ProjectState, // Ensure this interface includes _needsFilesReload and setNeedsFilesReload
  PerProjectState,
  ProcessingStatus,
} from "../types/projectStateTypes"; // Corrected import path/filename
import { FileData } from "../types/FileTypes";
import {
  DEFAULT_SORT_ORDER,
  DEFAULT_FILE_LIST_VIEW,
  DEFAULT_INCLUDE_FILE_TREE_GLOBAL,
  DEFAULT_INCLUDE_PROMPT_OVERVIEW_GLOBAL,
  MAX_RECENT_FOLDERS,
  // LOCAL_STORAGE_KEYS, // Only needed if used directly, middleware handles name
} from "../constants";
import { normalizePath, arePathsEqual } from "../utils/pathUtils";
import logger from "../utils/logger";

// Define the default state for a single project when it's first created
// Export it so App.tsx can import it for default values in selectors
export const getDefaultPerProjectState = (): Omit<
  PerProjectState,
  "lastAccessed"
> => ({
  selectedFiles: [],
  expandedNodes: [],
  sortOrder: DEFAULT_SORT_ORDER,
  searchTerm: "",
  fileListView: DEFAULT_FILE_LIST_VIEW,
  includeFileTree: DEFAULT_INCLUDE_FILE_TREE_GLOBAL,
  includePromptOverview: DEFAULT_INCLUDE_PROMPT_OVERVIEW_GLOBAL,
});

// --- Zustand Store Definition ---
// Ensure ProjectState interface includes _needsFilesReload and setNeedsFilesReload
export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      // --- Persisted State ---
      currentSelectedFolder: null,
      projects: {},
      recentFolders: [],

      // --- Transient State ---
      allFiles: [],
      processingStatus: { status: "idle", message: "" },

      // --- Internal State ---
      _hasHydrated: false,
      _needsFilesReload: false, // <-- Initialize NEW state flag

      // --- Actions ---

      hydrateStore: () => {
        // Check if a folder was selected upon hydration using get()
        const folderSelectedOnHydrate = !!get().currentSelectedFolder;
        logger.info(
          `Store hydrated. Folder selected on hydrate: ${folderSelectedOnHydrate}`
        );
        set({
          _hasHydrated: true,
          // Set flag to trigger reload IF a folder was loaded from storage
          _needsFilesReload: folderSelectedOnHydrate,
        });
      },

      // Action to manually clear the reload flag (called from useEffect in App)
      setNeedsFilesReload: (needsReload: boolean) => {
        // Only update if the value actually changes
        if (get()._needsFilesReload !== needsReload) {
          logger.debug(`Action: setNeedsFilesReload to ${needsReload}`);
          set({ _needsFilesReload: needsReload });
        } else {
          logger.debug(
            `Action: setNeedsFilesReload skipped, value already ${needsReload}`
          );
        }
      },

      setCurrentSelectedFolder: (folderPath: string | null) => {
        const normalizedPath = folderPath ? normalizePath(folderPath) : null;
        const previouslySelectedFolder = get().currentSelectedFolder; // Get folder before setting

        // Avoid unnecessary state updates if the folder hasn't changed
        if (normalizedPath === previouslySelectedFolder) {
          logger.debug(
            `Action: setCurrentSelectedFolder skipped, folder already set to ${normalizedPath}`
          );
          // Even if folder is the same, maybe trigger reload if needed (e.g., after HMR)
          if (normalizedPath && !get()._needsFilesReload) {
            // If folder is the same, but reload flag is false, set it to true to trigger potential HMR reload logic
            // This might be too aggressive, let's rely on the effect in App for HMR for now.
            // set({ _needsFilesReload: true });
          }
          return;
        }

        logger.info(
          `Action: setCurrentSelectedFolder changing from ${previouslySelectedFolder} to ${normalizedPath}`
        );

        // Directly update state, including lastAccessed if needed
        set((state: ProjectState) => {
          const currentProjects = state.projects;
          let targetProjectState = normalizedPath
            ? currentProjects[normalizedPath]
            : null;
          let updatedProjects = currentProjects; // Start with current projects

          if (normalizedPath) {
            if (!targetProjectState) {
              // Project is new, create its state
              logger.debug(
                `Creating default state for new project: ${normalizedPath}`
              );
              targetProjectState = {
                ...getDefaultPerProjectState(),
                lastAccessed: Date.now(),
              };
              // Add new project state immutably
              updatedProjects = {
                ...currentProjects,
                [normalizedPath]: targetProjectState,
              };
            } else {
              // Project exists, update its lastAccessed time immutably
              logger.debug(
                `Updating lastAccessed for existing project: ${normalizedPath}`
              );
              updatedProjects = {
                ...currentProjects,
                [normalizedPath]: {
                  ...targetProjectState,
                  lastAccessed: Date.now(),
                },
              };
            }
          }

          // Return the complete state update
          return {
            currentSelectedFolder: normalizedPath,
            projects: updatedProjects, // Use the potentially updated projects map
            allFiles: [], // Clear files from previous folder
            processingStatus: normalizedPath
              ? { status: "idle", message: "" } // Start as idle, effect will trigger processing
              : { status: "idle", message: "" },
            // Set needs reload flag when folder changes (and it's not null)
            _needsFilesReload: !!normalizedPath,
          };
        }); // End of set

        // Update recent folders AFTER setting the state
        if (normalizedPath) {
          get().addRecentFolder(normalizedPath);
        }
      }, // End of setCurrentSelectedFolder

      addRecentFolder: (folderPath: string) => {
        const normalizedPath = normalizePath(folderPath);
        set((state: ProjectState) => {
          const filteredRecents = state.recentFolders.filter(
            (p: string) => !arePathsEqual(p, normalizedPath)
          );
          const newRecentFolders = [normalizedPath, ...filteredRecents].slice(
            0,
            MAX_RECENT_FOLDERS
          );
          // Check if update is needed before setting state
          if (
            JSON.stringify(state.recentFolders) !==
            JSON.stringify(newRecentFolders)
          ) {
            logger.debug(`Action: addRecentFolder - updating recent folders.`);
            return { recentFolders: newRecentFolders };
          }
          return {}; // No change
        });
      },

      removeRecentFolder: (folderPath: string) => {
        const normalizedPath = normalizePath(folderPath);
        logger.info(`Action: removeRecentFolder - ${normalizedPath}`);
        set((state: ProjectState) => ({
          recentFolders: state.recentFolders.filter(
            (p: string) => !arePathsEqual(p, normalizedPath)
          ),
        }));
      },

      exitFolder: () => {
        logger.info("Action: exitFolder");
        set({
          currentSelectedFolder: null,
          allFiles: [],
          processingStatus: { status: "idle", message: "" },
          _needsFilesReload: false, // <-- Reset flag on exit
        });
      },

      setAllFiles: (files: FileData[]) => {
        logger.debug(`Action: setAllFiles, received ${files.length} files`);
        // Optionally, reset the reload flag here IF this is the only way files are loaded initially
        // However, the useEffect in App which calls setNeedsFilesReload(false) is probably better.
        set({ allFiles: files /*, _needsFilesReload: false */ });
      },

      setProcessingStatus: (status: ProcessingStatus) => {
        if (JSON.stringify(get().processingStatus) !== JSON.stringify(status)) {
          logger.debug(
            `Action: setProcessingStatus - ${status.status}: ${status.message}`
          );
          set({ processingStatus: status });
        }
      },

      _updateCurrentProjectState: <K extends keyof PerProjectState>(
        key: K,
        value: PerProjectState[K]
      ) => {
        const currentFolder = get().currentSelectedFolder;
        if (!currentFolder) {
          logger.warn(
            `Cannot update project state: No folder selected. Attempted to set ${key}.`
          );
          return;
        }
        set((state: ProjectState) => {
          const projectState = state.projects[currentFolder];
          if (!projectState) {
            logger.error(
              `Cannot update project state: State for ${currentFolder} not found. Attempted to set ${key}.`
            );
            return {};
          }
          const updatedProjectState: PerProjectState = {
            ...projectState,
            [key]: value,
            lastAccessed: Date.now(),
          };
          const updatedProjects = {
            ...state.projects,
            [currentFolder]: updatedProjectState,
          };
          logger.debug(
            `Updating project state for ${currentFolder}: setting ${key}`
          );
          return { projects: updatedProjects };
        });
      },

      toggleFileSelection: (filePath: string) => {
        const currentFolder = get().currentSelectedFolder;
        if (!currentFolder) return;
        const projectState = get().projects[currentFolder];
        if (!projectState) return;
        const normalizedPath = normalizePath(filePath);
        const currentSelection = projectState.selectedFiles;
        const isSelected = currentSelection.some((p: string) =>
          arePathsEqual(p, normalizedPath)
        );
        let newSelection: string[];
        if (isSelected) {
          newSelection = currentSelection.filter(
            (p: string) => !arePathsEqual(p, normalizedPath)
          );
        } else {
          newSelection = [...currentSelection, normalizedPath];
        }
        get()._updateCurrentProjectState("selectedFiles", newSelection);
      },

      toggleFolderSelection: (folderPath: string, select: boolean) => {
        const currentFolder = get().currentSelectedFolder;
        if (!currentFolder) return;
        const projectState = get().projects[currentFolder];
        const allFiles = get().allFiles;
        if (!projectState || !allFiles || allFiles.length === 0) return;
        const normalizedFolderPath = normalizePath(folderPath);
        const filesToToggle = allFiles
          .filter(
            (file: FileData) =>
              !file.isBinary &&
              !file.isSkipped &&
              normalizePath(file.path).startsWith(normalizedFolderPath + "/") &&
              normalizePath(file.path) !== normalizedFolderPath
          )
          .map((file: FileData) => normalizePath(file.path));
        if (filesToToggle.length === 0) {
          logger.debug(`No files found to toggle in folder: ${folderPath}`);
          return;
        }
        let currentSelection = [...projectState.selectedFiles];
        const selectionSet = new Set(currentSelection);
        if (select) {
          logger.debug(`Selecting files in folder: ${folderPath}`);
          filesToToggle.forEach((p: string) => selectionSet.add(p));
        } else {
          logger.debug(`Deselecting files in folder: ${folderPath}`);
          filesToToggle.forEach((p: string) => selectionSet.delete(p));
        }
        const newSelectionArray = Array.from(selectionSet);
        if (
          JSON.stringify(currentSelection) !== JSON.stringify(newSelectionArray)
        ) {
          get()._updateCurrentProjectState("selectedFiles", newSelectionArray);
        }
      },

      selectAllFiles: () => {
        const currentFolder = get().currentSelectedFolder;
        if (!currentFolder) return;
        const allFiles = get().allFiles;
        if (!allFiles || allFiles.length === 0) return;
        const selectableFiles = allFiles
          .filter((file: FileData) => !file.isBinary && !file.isSkipped)
          .map((file: FileData) => normalizePath(file.path));
        const currentSelection =
          get().projects[currentFolder]?.selectedFiles || [];
        if (
          selectableFiles.length !== currentSelection.length ||
          !selectableFiles.every((p: string) => currentSelection.includes(p))
        ) {
          get()._updateCurrentProjectState("selectedFiles", selectableFiles);
        }
      },

      deselectAllFiles: () => {
        const currentFolder = get().currentSelectedFolder;
        if (!currentFolder) return;
        const currentSelection =
          get().projects[currentFolder]?.selectedFiles || [];
        if (currentSelection.length > 0) {
          get()._updateCurrentProjectState("selectedFiles", []);
        }
      },

      setSortOrder: (sortOrder: string) => {
        get()._updateCurrentProjectState("sortOrder", sortOrder);
      },
      setSearchTerm: (searchTerm: string) => {
        get()._updateCurrentProjectState("searchTerm", searchTerm);
      },
      setFileListView: (view: "structured" | "flat") => {
        get()._updateCurrentProjectState("fileListView", view);
      },

      toggleExpandedNode: (nodePath: string) => {
        const currentFolder = get().currentSelectedFolder;
        if (!currentFolder) return;
        const projectState = get().projects[currentFolder];
        if (!projectState) return;
        const normalizedPath = normalizePath(nodePath);
        const currentExpanded = projectState.expandedNodes;
        const isExpanded = currentExpanded.some((p: string) =>
          arePathsEqual(p, normalizedPath)
        );
        let newExpanded: string[];
        if (isExpanded) {
          newExpanded = currentExpanded.filter(
            (p: string) => !arePathsEqual(p, normalizedPath)
          );
        } else {
          newExpanded = [...currentExpanded, normalizedPath];
        }
        get()._updateCurrentProjectState("expandedNodes", newExpanded);
      },

      setIncludeFileTree: (include: boolean) => {
        get()._updateCurrentProjectState("includeFileTree", include);
      },
      setIncludePromptOverview: (include: boolean) => {
        get()._updateCurrentProjectState("includePromptOverview", include);
      },
    }),
    {
      name: "pastemax-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state: ProjectState) => ({
        currentSelectedFolder: state.currentSelectedFolder,
        projects: state.projects,
        recentFolders: state.recentFolders,
      }),
      onRehydrateStorage: () => {
        return (state?: ProjectState, error?: unknown) => {
          if (error) {
            logger.error("Failed to rehydrate state:", error);
          }
          // Always attempt to call hydrateStore after timeout
          // hydrateStore itself will handle logic based on rehydrated state
          setTimeout(() => useProjectStore.getState().hydrateStore(), 0);
        };
      },
      version: 1,
    }
  )
);

// --- Selectors ---
export const selectCurrentProjectState = (
  state: ProjectState
): PerProjectState => {
  const currentFolder = state.currentSelectedFolder;
  const projectSpecificState = currentFolder
    ? state.projects?.[currentFolder]
    : null;
  if (!projectSpecificState) {
    const defaults = getDefaultPerProjectState();
    return { ...defaults, lastAccessed: 0 };
  }
  return projectSpecificState;
};
export const selectAllFiles = (state: ProjectState): FileData[] =>
  state.allFiles;
export const selectProcessingStatus = (state: ProjectState): ProcessingStatus =>
  state.processingStatus;
export const selectHasHydrated = (state: ProjectState): boolean =>
  state._hasHydrated;
export const selectCurrentSelectedFolder = (
  state: ProjectState
): string | null => state.currentSelectedFolder;
export const selectRecentFolders = (state: ProjectState): string[] =>
  state.recentFolders;
export const selectNeedsFilesReload = (state: ProjectState): boolean =>
  state._needsFilesReload; // <-- NEW Selector

logger.info("Zustand project store defined.");
