// src/constants.ts

export const LOCAL_STORAGE_KEYS = {
  THEME: "pastemax-theme",
  PROJECT_STATES: "pastemax-project-states",
  LAST_SELECTED_FOLDER: "pastemax-last-selected-folder",
  RECENT_FOLDERS: "pastemax-recent-folders",
};

export const MAX_RECENT_FOLDERS = 10;

export const DEFAULT_SORT_ORDER = "path-asc";
export const DEFAULT_FILE_LIST_VIEW = "structured" as const;
export const DEFAULT_INCLUDE_FILE_TREE = false;

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
