import { normalizePath } from "./pathUtils";

/**
 * Glavni ključ za shranjevanje vseh projektnih stanj
 */
const PROJECT_STATES_KEY = "pastemax-project-states";

/**
 * Ključ za shranjevanje zadnje izbranega direktorija
 */
const LAST_SELECTED_FOLDER_KEY = "pastemax-last-selected-folder";

/**
 * Ključ za shranjevanje seznama nedavnih map
 */
const RECENT_FOLDERS_KEY = "pastemax-recent-folders";

/**
 * Struktura stanja posameznega projekta
 */
interface ProjectState {
  selectedFiles?: string[];
  expandedNodes?: Record<string, boolean>;
  sortOrder?: string;
  searchTerm?: string;
  fileListView?: "structured" | "flat";
  includeFileTree?: boolean;
  lastAccessed?: number;
}

/**
 * Struktura za shranjevanje vseh projektnih stanj
 */
type AllProjectStates = Record<string, ProjectState>;

/**
 * Privzete vrednosti za nov projekt
 */
const defaultProjectState: ProjectState = {
  selectedFiles: [],
  expandedNodes: {},
  sortOrder: "path-asc",
  searchTerm: "",
  fileListView: "structured",
  includeFileTree: false,
};

/**
 * Vrne pot zadnje izbranega direktorija
 */
export function getLastSelectedFolder(): string | null {
  return localStorage.getItem(LAST_SELECTED_FOLDER_KEY);
}

/**
 * Shrani pot zadnje izbranega direktorija
 */
export function saveLastSelectedFolder(folderPath: string | null): void {
  if (folderPath) {
    localStorage.setItem(LAST_SELECTED_FOLDER_KEY, folderPath);
  } else {
    localStorage.removeItem(LAST_SELECTED_FOLDER_KEY);
  }
}

/**
 * Naloži vsa projektna stanja iz localStorage
 */
export function loadProjectStates(): AllProjectStates {
  try {
    const storedStates = localStorage.getItem(PROJECT_STATES_KEY);
    return storedStates ? JSON.parse(storedStates) : {};
  } catch (error) {
    console.error("Napaka pri branju projektnih stanj iz localStorage:", error);
    return {};
  }
}

/**
 * Shrani vsa projektna stanja v localStorage
 */
function saveAllProjectStates(states: AllProjectStates): void {
  try {
    localStorage.setItem(PROJECT_STATES_KEY, JSON.stringify(states));
  } catch (error) {
    console.error(
      "Napaka pri shranjevanju projektnih stanj v localStorage:",
      error
    );
  }
}

/**
 * Vrne stanje za določeno mapo projekta
 */
export function getProjectState(folderPath: string | null): ProjectState {
  if (!folderPath) {
    return { ...defaultProjectState };
  }

  const normalized = normalizePath(folderPath);
  const allStates = loadProjectStates();
  const projectState = allStates[normalized] || {};

  // Združi s privzetimi vrednostmi
  return {
    ...defaultProjectState,
    ...projectState,
    // Zagotovi, da so polja pravilno inicializirana
    selectedFiles: projectState.selectedFiles ?? [],
    expandedNodes: projectState.expandedNodes ?? {},
  };
}

/**
 * Posodobi določeno lastnost projekta
 */
export function updateProjectProperty<K extends keyof ProjectState>(
  folderPath: string | null,
  propertyName: K,
  value: ProjectState[K]
): void {
  if (!folderPath) return;

  const normalized = normalizePath(folderPath);
  const allStates = loadProjectStates();

  // Zagotovi, da vnos za projekt obstaja
  if (!allStates[normalized]) {
    allStates[normalized] = { ...defaultProjectState };
  }

  // Posodobi lastnost
  allStates[normalized][propertyName] = value;
  // Posodobi čas zadnjega dostopa
  allStates[normalized].lastAccessed = Date.now();

  saveAllProjectStates(allStates);
}

/**
 * Shrani celotno stanje projekta
 */
export function saveProjectState(
  folderPath: string | null,
  newState: Partial<ProjectState>
): void {
  if (!folderPath) return;

  const normalized = normalizePath(folderPath);
  const allStates = loadProjectStates();

  // Združi novo stanje z obstoječim ali privzetim stanjem
  allStates[normalized] = {
    ...(allStates[normalized] || defaultProjectState),
    ...newState,
    lastAccessed: Date.now(),
  };

  saveAllProjectStates(allStates);
}

/**
 * Naloži začetno stanje za uporabo v App.tsx
 */
export function loadInitialState(
  folderPath: string | null
): Required<Omit<ProjectState, "lastAccessed">> &
  Pick<ProjectState, "lastAccessed"> {
  const state = getProjectState(folderPath);
  return {
    selectedFiles: state.selectedFiles!,
    expandedNodes: state.expandedNodes!,
    sortOrder: state.sortOrder!,
    searchTerm: state.searchTerm!,
    fileListView: state.fileListView!,
    includeFileTree: state.includeFileTree!,
    lastAccessed: state.lastAccessed,
  };
}

/**
 * Naloži seznam nedavnih map
 */
export function loadRecentFolders(): string[] {
  try {
    const saved = localStorage.getItem(RECENT_FOLDERS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Napaka pri branju seznama nedavnih map:", error);
    return [];
  }
}

/**
 * Shrani seznam nedavnih map
 */
export function saveRecentFolders(folders: string[]): void {
  try {
    localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(folders));
  } catch (error) {
    console.error("Napaka pri shranjevanju seznama nedavnih map:", error);
  }
}
