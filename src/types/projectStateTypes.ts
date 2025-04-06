// src/types/projectStateTypes.ts
import { FileData } from "./FileTypes";

/**
 * Represents the state specific to a single project folder.
 */
export interface PerProjectState {
  selectedFiles: string[];
  expandedNodes: string[];
  sortOrder: string;
  searchTerm: string;
  fileListView: "structured" | "flat";
  includeFileTree: boolean;
  includePromptOverview: boolean;
  lastAccessed: number;
}

/**
 * Represents the overall state of the application managed by Zustand.
 */
export interface ProjectState {
  // --- Persisted State ---
  currentSelectedFolder: string | null;
  projects: Record<string, PerProjectState>;
  recentFolders: string[];

  // --- Transient State (Not persisted) ---
  allFiles: FileData[];
  processingStatus: ProcessingStatus;

  // --- Internal State ---
  _hasHydrated: boolean;

  // --- Actions (Functions to modify state) ---
  hydrateStore: () => void;
  setCurrentSelectedFolder: (folderPath: string | null) => void;
  addRecentFolder: (folderPath: string) => void;
  removeRecentFolder: (folderPath: string) => void;
  exitFolder: () => void;
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
  // Internal helper - not part of the public interface but defined in store
  _updateCurrentProjectState: <K extends keyof PerProjectState>(
    key: K,
    value: PerProjectState[K]
  ) => void;
}

/**
 * Represents the status of background file processing or other operations.
 */
export interface ProcessingStatus {
  status: "idle" | "processing" | "complete" | "error";
  message: string;
}
