// src/constants.ts
import { PromptSectionDefinition } from "./types/promptConfigTypes";

export const LOCAL_STORAGE_KEYS = {
  THEME: "pastemax-theme",
  PROJECT_STATES: "pastemax-project-states",
  LAST_SELECTED_FOLDER: "pastemax-last-selected-folder",
  RECENT_FOLDERS: "pastemax-recent-folders",
};

export const MAX_RECENT_FOLDERS = 10;

export const DEFAULT_SORT_ORDER = "path-asc";
export const DEFAULT_FILE_LIST_VIEW = "structured" as const;
export const DEFAULT_INCLUDE_FILE_TREE_GLOBAL = false;
export const DEFAULT_INCLUDE_PROMPT_OVERVIEW_GLOBAL = false;

export const THEME_OPTIONS = {
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
} as const;

export type ThemeValue = (typeof THEME_OPTIONS)[keyof typeof THEME_OPTIONS];

// Add other frontend-specific constants here
export const FILE_LIST_VIEWS = {
  STRUCTURED: "structured",
  FLAT: "flat",
} as const;
export type FileListViewValue =
  (typeof FILE_LIST_VIEWS)[keyof typeof FILE_LIST_VIEWS];

export const SORT_ORDERS = {
  PATH_ASC: "path-asc",
  PATH_DESC: "path-desc",
  TOKENS_ASC: "tokens-asc",
  TOKENS_DESC: "tokens-desc",
  NAME_ASC: "name-asc",
  NAME_DESC: "name-desc",
} as const;
export type SortOrderValue = (typeof SORT_ORDERS)[keyof typeof SORT_ORDERS];

// --- NEW/UPDATED Constants for Structured Prompt ---

// Central directory for all description files and the overview template
export const DESCRIPTIONS_DIR = "ai/.descriptions";

// Filename for the overview template within DESCRIPTIONS_DIR
export const OVERVIEW_FILENAME = "overview.txt";

// Markers (with placeholders)
export const PROMPT_MARKERS = {
  section_open: "@@@@ {section_name}_START",
  section_close: "@@@@ {section_name}_END",
  description_open: "%%%% DESCRIPTION_START",
  description_close: "%%%% DESCRIPTION_END",
  file_open: ">>>> FILE_START: {file_path}",
  file_close: ">>>> FILE_END: {file_path}",
};

// Project Tree Configuration (Simplified)
export const PROJECT_TREE_CONFIG = {
  name: "PROJECT_TREE", // Name for markers
  descriptionFilename: "project_tree.txt", // Optional description filename within DESCRIPTIONS_DIR
};

// Section Definitions - ORDER MATTERS for output and structured UI!
export const PROMPT_SECTIONS: PromptSectionDefinition[] = [
  {
    id: "rules", // Used as key and for description lookup
    name: "RULES",
    label: "Rules",
    directory: "ai/rules",
    descriptionFilename: "rules.txt",
    color: "var(--warning-color)",
  },
  {
    id: "scraped",
    name: "SCRAPED_DOCUMENTATION",
    label: "Scraped Docs",
    directory: "ai/scraped",
    descriptionFilename: "scraped.txt",
    color: "var(--success-color)",
  },
  {
    id: "project_files", // Default section
    name: "PROJECT_FILES",
    label: "Project",
    directory: null, // Indicates this is the default/fallback
    descriptionFilename: "project_files.txt", // Optional description for default files
    color: "var(--accent-blue)",
  },
  {
    id: "prompts",
    name: "PROMPTS",
    label: "Prompts",
    directory: "ai/prompts",
    descriptionFilename: "prompts.txt",
    color: "var(--error-color)",
  },
];
