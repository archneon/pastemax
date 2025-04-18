// src/store/projectStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
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
import { normalizePath, arePathsEqual } from "../utils/pathUtils"; // Added normalizePath
import logger from "../utils/logger"; // Added logger

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
        const previouslySelectedFolder = get().currentSelectedFolder;

        if (normalizedPath === previouslySelectedFolder) {
          logger.debug(
            `Action: setCurrentSelectedFolder skipped, folder already set to ${normalizedPath}`
          );
          // Potentially trigger reload flag for HMR case - let's test without first
          // if (normalizedPath && !get()._needsFilesReload) { set({ _needsFilesReload: true }); }
          return;
        }

        logger.info(
          `Action: setCurrentSelectedFolder changing from ${previouslySelectedFolder} to ${normalizedPath}`
        );

        set((state: ProjectState) => {
          // ... (logic for updating projects map remains the same) ...
          const currentProjects = state.projects;
          let targetProjectState = normalizedPath
            ? currentProjects[normalizedPath]
            : null;
          let updatedProjects = currentProjects;
          if (normalizedPath) {
            if (!targetProjectState) {
              logger.debug(
                `Creating default state for new project: ${normalizedPath}`
              );
              targetProjectState = {
                ...getDefaultPerProjectState(),
                lastAccessed: Date.now(),
              };
              updatedProjects = {
                ...currentProjects,
                [normalizedPath]: targetProjectState,
              };
            } else {
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

          return {
            currentSelectedFolder: normalizedPath,
            projects: updatedProjects,
            allFiles: [], // Clear files
            // Start as IDLE. The effect will trigger processing status change when needed.
            processingStatus: { status: "idle", message: "" },
            // Set needs reload flag whenever a valid folder is selected
            _needsFilesReload: !!normalizedPath,
          };
        });

        if (normalizedPath) {
          get().addRecentFolder(normalizedPath);
        }
      },

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

      // --- CORRECTED setAllFiles ACTION ---
      setAllFiles: (files: FileData[]) => {
        logger.debug(
          `Action: setAllFiles, received ${files.length} files. Performing cleanup of selectedFiles.`
        );

        const currentFolder = get().currentSelectedFolder;
        let cleanedSelectedFiles: string[] | undefined = undefined; // Store cleaned list

        if (currentFolder) {
          const projectState = get().projects[currentFolder];
          if (projectState && projectState.selectedFiles.length > 0) {
            // Create Set of valid normalized paths from the newly received files
            const validPaths = new Set(
              files.map((file) => normalizePath(file.path))
            );
            logger.debug(`Valid paths in new file list: ${validPaths.size}`);

            // Filter existing selectedFiles
            const currentSelected = projectState.selectedFiles;
            cleanedSelectedFiles = currentSelected.filter((selectedPath) =>
              validPaths.has(normalizePath(selectedPath))
            );

            if (cleanedSelectedFiles.length !== currentSelected.length) {
              logger.info(
                `Cleaned selectedFiles for ${currentFolder}. Removed ${
                  currentSelected.length - cleanedSelectedFiles.length
                } stale entries. New count: ${cleanedSelectedFiles.length}`
              );
            } else {
              logger.debug(
                `No stale entries found in selectedFiles for ${currentFolder}.`
              );
              // No need to update if no changes
              cleanedSelectedFiles = undefined; // Indicate no change needed for selectedFiles
            }
          } else {
            logger.debug(
              `No project state or no selected files to clean for ${currentFolder}.`
            );
          }
        } else {
          logger.warn(
            "Action: setAllFiles called but no folder is selected. Cannot clean selectedFiles."
          );
        }

        // Update state
        set((state: ProjectState) => {
          let updatedProjects = state.projects;

          // Update selectedFiles in projects only if changes were actually made
          if (currentFolder && cleanedSelectedFiles !== undefined) {
            const projectState = state.projects[currentFolder];
            if (projectState) {
              updatedProjects = {
                ...state.projects,
                [currentFolder]: {
                  ...projectState,
                  selectedFiles: cleanedSelectedFiles, // Use the cleaned list
                  lastAccessed: Date.now(), // Update access time
                },
              };
            }
          }

          return {
            allFiles: files, // Always update allFiles
            projects: updatedProjects, // Update projects if needed
            processingStatus: {
              // Set status to complete as files are received
              status: "complete",
              message: `Loaded ${files.length} files.`,
            },
            // Reset _needsFilesReload NOW that files are loaded and processed
            _needsFilesReload: false,
          };
        });
        logger.debug("Action: setAllFiles completed.");
      },
      // --- END CORRECTED setAllFiles ACTION ---

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

      toggleFileSelection: (path: string) => {
        const state = get(); // Use get() to access state and other actions
        if (!state.currentSelectedFolder) return;

        const currentFolder = state.currentSelectedFolder;
        const project = state.projects[currentFolder];
        if (!project) return;

        // Create a new set from the current selection
        const currentSelection = new Set(
          project.selectedFiles.map(normalizePath)
        );

        // Toggle the selection status
        const normalizedPath = normalizePath(path);
        if (currentSelection.has(normalizedPath)) {
          currentSelection.delete(normalizedPath);
        } else {
          currentSelection.add(normalizedPath);
        }

        const newSelectedFiles = Array.from(currentSelection);

        // --- FIX: Use the helper function to correctly update state ---
        // This ensures Zustand detects the change and notifies subscribers.
        logger.debug(
          `Action: toggleFileSelection for ${path}. New selection count: ${newSelectedFiles.length}`
        );
        get()._updateCurrentProjectState("selectedFiles", newSelectedFiles);
        // --- END FIX ---

        // --- REMOVED direct mutation ---
        // state.projects[currentFolder] = {
        //   ...project,
        //   selectedFiles: newSelectedFiles,
        // };
        // --- END REMOVED ---
      },

      toggleFolderSelection: (folderPath: string, select: boolean) => {
        const state = get();
        if (!state.currentSelectedFolder) return;
        const currentFolder = state.currentSelectedFolder;
        const projectState = state.projects[currentFolder];
        if (!projectState) return;
        const normalizedFolderPath = normalizePath(folderPath);
        const filesToToggle = state.allFiles
          .filter(
            (file: FileData) =>
              !file.isBinary &&
              !file.isSkipped &&
              normalizePath(file.path).startsWith(normalizedFolderPath + "/") &&
              normalizePath(file.path) !== normalizedFolderPath // Exclude the folder itself if it's somehow in allFiles
          )
          .map((file: FileData) => normalizePath(file.path));

        if (filesToToggle.length === 0) {
          logger.debug(
            `No selectable files found to toggle in folder: ${folderPath}`
          );
          return;
        }

        // Get the current selection for the project
        const currentSelectionArray = projectState.selectedFiles; // Use array from project state
        const selectionSet = new Set(currentSelectionArray.map(normalizePath)); // Use normalization

        if (select) {
          logger.debug(
            `Selecting ${filesToToggle.length} files in folder: ${folderPath}`
          );
          filesToToggle.forEach((p: string) => selectionSet.add(p));
        } else {
          logger.debug(
            `Deselecting ${filesToToggle.length} files in folder: ${folderPath}`
          );
          filesToToggle.forEach((p: string) => selectionSet.delete(p));
        }

        const newSelectionArray = Array.from(selectionSet);

        // Only update if the selection actually changed
        if (
          JSON.stringify(currentSelectionArray.sort()) !==
          JSON.stringify(newSelectionArray.sort())
        ) {
          logger.debug(
            `Updating selectedFiles after folder toggle for ${folderPath}. New count: ${newSelectionArray.length}`
          );
          get()._updateCurrentProjectState("selectedFiles", newSelectionArray);
        } else {
          logger.debug(
            `Folder toggle for ${folderPath} resulted in no change to selectedFiles.`
          );
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
        // Sort arrays before comparison for accurate change detection
        if (
          selectableFiles.length !== currentSelection.length ||
          JSON.stringify(selectableFiles.sort()) !==
            JSON.stringify(currentSelection.sort())
        ) {
          logger.debug(
            `Action: selectAllFiles. Selecting ${selectableFiles.length} files.`
          );
          get()._updateCurrentProjectState("selectedFiles", selectableFiles);
        } else {
          logger.debug(
            "Action: selectAllFiles skipped, all selectable files already selected."
          );
        }
      },

      deselectAllFiles: () => {
        const currentFolder = get().currentSelectedFolder;
        if (!currentFolder) return;
        const currentSelection =
          get().projects[currentFolder]?.selectedFiles || [];
        if (currentSelection.length > 0) {
          logger.debug(
            `Action: deselectAllFiles. Deselecting ${currentSelection.length} files.`
          );
          get()._updateCurrentProjectState("selectedFiles", []);
        } else {
          logger.debug(
            "Action: deselectAllFiles skipped, no files currently selected."
          );
        }
      },

      setSortOrder: (sortOrder: string) => {
        logger.debug(`Action: setSortOrder to ${sortOrder}`);
        get()._updateCurrentProjectState("sortOrder", sortOrder);
      },
      setSearchTerm: (searchTerm: string) => {
        logger.debug(`Action: setSearchTerm to "${searchTerm}"`);
        get()._updateCurrentProjectState("searchTerm", searchTerm);
      },
      setFileListView: (view: "structured" | "flat") => {
        logger.debug(`Action: setFileListView to ${view}`);
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
          logger.debug(
            `Action: toggleExpandedNode - Collapsing ${normalizedPath}`
          );
        } else {
          newExpanded = [...currentExpanded, normalizedPath];
          logger.debug(
            `Action: toggleExpandedNode - Expanding ${normalizedPath}`
          );
        }
        get()._updateCurrentProjectState("expandedNodes", newExpanded);
      },

      setIncludeFileTree: (include: boolean) => {
        logger.debug(`Action: setIncludeFileTree to ${include}`);
        get()._updateCurrentProjectState("includeFileTree", include);
      },
      setIncludePromptOverview: (include: boolean) => {
        logger.debug(`Action: setIncludePromptOverview to ${include}`);
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
