// src/types/projectStateTypes.ts
import { FileData } from "./FileTypes";

/**
 * Represents the state specific to a single project folder.
 */
export interface PerProjectState {
  selectedFiles: string[];
  expandedNodes: string[]; // Kept as array for JSON compatibility
  sortOrder: string;
  searchTerm: string;
  fileListView: "structured" | "flat";
  includeFileTree: boolean;
  includePromptOverview: boolean;
  lastAccessed: number;
}

/**
 * Represents the status of background file processing or other operations.
 */
export interface ProcessingStatus {
  status: "idle" | "processing" | "complete" | "error";
  message: string;
}

/**
 * Represents the overall state of the application managed by Zustand.
 * Includes persisted, transient, and internal state, along with actions.
 */
export interface ProjectState {
  // --- Persisted State ---
  currentSelectedFolder: string | null;
  projects: Record<string, PerProjectState>;
  recentFolders: string[];

  // --- Transient State (Not persisted) ---
  allFiles: FileData[];
  processingStatus: ProcessingStatus;

  // --- Internal State (Not persisted) ---
  _hasHydrated: boolean;
  _needsFilesReload: boolean;

  // --- Actions (Functions to modify state) ---
  hydrateStore: () => void;
  setCurrentSelectedFolder: (folderPath: string | null) => void;
  addRecentFolder: (folderPath: string) => void;
  removeRecentFolder: (folderPath: string) => void;
  exitFolder: () => void;
  setNeedsFilesReload: (needsReload: boolean) => void;
  setAllFiles: (files: FileData[]) => void;
  setProcessingStatus: (status: ProcessingStatus) => void;
  toggleFileSelection: (filePath: string) => void;
  toggleFolderSelection: (folderPath: string, select: boolean) => void;
  selectAllFiles: () => void;
  deselectAllFiles: () => void;
  setSortOrder: (sortOrder: string) => void;
  setSearchTerm: (searchTerm: string) => void;
  setFileListView: (view: "structured" | "flat") => void;
  toggleExpandedNode: (nodePath: string) => void;
  setIncludeFileTree: (include: boolean) => void;
  setIncludePromptOverview: (include: boolean) => void;

  // --- Internal helper function used within the store's actions ---
  // It MUST be defined in the interface if accessed via get() inside actions.
  _updateCurrentProjectState: <K extends keyof PerProjectState>(
    key: K,
    value: PerProjectState[K]
  ) => void; // <-- ADDED BACK
}
