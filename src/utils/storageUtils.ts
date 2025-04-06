import { normalizePath } from "./pathUtils";
import {
  LOCAL_STORAGE_KEYS,
  DEFAULT_SORT_ORDER,
  DEFAULT_FILE_LIST_VIEW,
  DEFAULT_INCLUDE_FILE_TREE_GLOBAL,
  DEFAULT_INCLUDE_PROMPT_OVERVIEW_GLOBAL,
  FileListViewValue,
} from "../constants";

/**
 * Main key for storing all project states
 * Kept for documentation but directly using LOCAL_STORAGE_KEYS.PROJECT_STATES instead
 */
// const PROJECT_STATES_KEY = "pastemax-project-states";

/**
 * Key for storing the last selected directory
 * Kept for documentation but directly using LOCAL_STORAGE_KEYS.LAST_SELECTED_FOLDER instead
 */
// const LAST_SELECTED_FOLDER_KEY = "pastemax-last-selected-folder";

/**
 * Key for storing the list of recent folders
 * Kept for documentation but directly using LOCAL_STORAGE_KEYS.RECENT_FOLDERS instead
 */
// const RECENT_FOLDERS_KEY = "pastemax-recent-folders";

/**
 * Structure of an individual project's state
 */
interface ProjectState {
  selectedFiles?: string[];
  expandedNodes?: string[];
  sortOrder?: string;
  searchTerm?: string;
  fileListView?: FileListViewValue;
  includeFileTree?: boolean;
  includePromptOverview?: boolean;
  lastAccessed?: number;
}

/**
 * Structure for storing all project states
 */
type AllProjectStates = Record<string, ProjectState>;

/**
 * Default values for a new project
 */
const defaultProjectState: ProjectState = {
  selectedFiles: [],
  expandedNodes: [],
  sortOrder: DEFAULT_SORT_ORDER,
  searchTerm: "",
  fileListView: DEFAULT_FILE_LIST_VIEW,
  includeFileTree: DEFAULT_INCLUDE_FILE_TREE_GLOBAL,
  includePromptOverview: DEFAULT_INCLUDE_PROMPT_OVERVIEW_GLOBAL,
};

/**
 * Returns the path of the last selected directory
 */
export function getLastSelectedFolder(): string | null {
  return localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_SELECTED_FOLDER);
}

/**
 * Saves the path of the last selected directory
 */
export function saveLastSelectedFolder(folderPath: string | null): void {
  if (folderPath) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_SELECTED_FOLDER, folderPath);
  } else {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_SELECTED_FOLDER);
  }
}

/**
 * Loads all project states from localStorage
 */
export function loadProjectStates(): AllProjectStates {
  try {
    const storedStates = localStorage.getItem(
      LOCAL_STORAGE_KEYS.PROJECT_STATES
    );
    return storedStates ? JSON.parse(storedStates) : {};
  } catch (error) {
    console.error("Error reading project states from localStorage:", error);
    return {};
  }
}

/**
 * Saves all project states to localStorage
 */
function saveAllProjectStates(states: AllProjectStates): void {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.PROJECT_STATES,
      JSON.stringify(states)
    );
  } catch (error) {
    console.error("Error saving project states to localStorage:", error);
  }
}

/**
 * Returns the state for a specific project folder
 */
export function getProjectState(folderPath: string | null): ProjectState {
  if (!folderPath) {
    return { ...defaultProjectState };
  }

  const normalized = normalizePath(folderPath);
  const allStates = loadProjectStates();
  const projectState = allStates[normalized] || {};

  // Merge with default values
  return {
    ...defaultProjectState,
    ...projectState,
    // Ensure fields are correctly initialized
    selectedFiles: projectState.selectedFiles ?? [],
    expandedNodes: projectState.expandedNodes ?? [],
  };
}

/**
 * Updates a specific project property
 */
export function updateProjectProperty<K extends keyof ProjectState>(
  folderPath: string | null,
  propertyName: K,
  value: K extends "expandedNodes" ? Set<string> | string[] : ProjectState[K]
): void {
  if (!folderPath) return;

  const normalized = normalizePath(folderPath);
  const allStates = loadProjectStates();

  // Ensure the project entry exists
  if (!allStates[normalized]) {
    allStates[normalized] = { ...defaultProjectState };
  }

  // Convert Set to Array before saving if property is expandedNodes
  let valueToSave: any = value;
  if (propertyName === "expandedNodes" && value instanceof Set) {
    valueToSave = Array.from(value);
  }

  // Update the property
  allStates[normalized][propertyName] = valueToSave;
  // Update the last accessed time
  allStates[normalized].lastAccessed = Date.now();

  saveAllProjectStates(allStates);
}

/**
 * Saves the entire project state
 */
export function saveProjectState(
  folderPath: string | null,
  newState: Partial<ProjectState>
): void {
  if (!folderPath) return;

  const normalized = normalizePath(folderPath);
  const allStates = loadProjectStates();

  // Merge the new state with the existing or default state
  allStates[normalized] = {
    ...(allStates[normalized] || defaultProjectState),
    ...newState,
    lastAccessed: Date.now(),
  };

  saveAllProjectStates(allStates);
}

/**
 * Loads the initial state for use in App.tsx
 */
export function loadInitialState(folderPath: string | null): Omit<
  Required<Omit<ProjectState, "lastAccessed">>,
  "expandedNodes"
> & {
  expandedNodes: Set<string>;
  lastAccessed?: number;
} {
  const state = getProjectState(folderPath);
  return {
    selectedFiles: state.selectedFiles!,
    expandedNodes: new Set(state.expandedNodes!), // Convert array to Set
    sortOrder: state.sortOrder!,
    searchTerm: state.searchTerm!,
    fileListView: state.fileListView!,
    includeFileTree: state.includeFileTree!,
    includePromptOverview: state.includePromptOverview!,
    lastAccessed: state.lastAccessed,
  };
}

/**
 * Loads the list of recent folders
 */
export function loadRecentFolders(): string[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.RECENT_FOLDERS);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Error reading list of recent folders:", error);
    return [];
  }
}

/**
 * Saves the list of recent folders
 */
export function saveRecentFolders(folders: string[]): void {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.RECENT_FOLDERS,
      JSON.stringify(folders)
    );
  } catch (error) {
    console.error("Error saving list of recent folders:", error);
  }
}
