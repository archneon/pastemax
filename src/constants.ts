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

// --- UPDATED Constants for Structured Prompt ---

// Directory for PasteMax configuration
export const PASTEMAX_DIR = ".pastemax";

// Filename for the prompt overview
export const PROMPT_OVERVIEW_FILENAME = "prompt-overview";

// Updated markers with connected underscore style
export const PROMPT_MARKERS = {
  section_open: "@@@@_{section_name}_START",
  section_close: "@@@@_{section_name}_END",
  file_open: ">>>>_FILE_START: {file_path}",
  file_close: ">>>>_FILE_END: {file_path}",
};

// Section Definitions - ORDER MATTERS for output and structured UI!
export const PROMPT_SECTIONS: PromptSectionDefinition[] = [
  {
    id: "cursor_rules", // Unique ID for this section
    name: "CURSOR_RULES", // Name used for prompt markers (@@@@_CURSOR_RULES_START)
    label: "Cursor Rules", // Label displayed in the UI
    directory: ".cursor/rules", // Directory path to match
    color: "var(--accent-green)", // Use the newly defined green color variable
  },
  {
    id: "rules", // Used as key and for description lookup
    name: "RULES",
    label: "Rules",
    directory: "ai/rules",
    color: "var(--warning-color)",
  },
  {
    id: "scraped",
    name: "SCRAPED_DOCUMENTATION",
    label: "Scraped Docs",
    directory: "ai/scraped",
    color: "var(--success-color)",
  },
  {
    id: "docs",
    name: "PROJECT_DOCUMENTATION",
    label: "Project Docs",
    directory: "ai/docs",
    color: "var(--accent-purple)",
  },
  {
    id: "project_files", // Default section
    name: "PROJECT_FILES",
    label: "Project",
    directory: null, // Indicates this is the default/fallback
    color: "var(--accent-blue)",
  },
  {
    id: "prompts",
    name: "PROMPTS",
    label: "Prompts",
    directory: "ai/prompts",
    color: "var(--error-color)",
  },
];
