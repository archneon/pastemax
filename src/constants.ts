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
    id: "cursor_rules",
    name: "STANDARD_RULES",
    label: "Cursor Rules",
    directory: ".cursor/rules",
    color: "var(--accent-green)",
    removeMdcMetadata: true,
    concatenateContent: true,
    description:
      "%%%% META-INSTRUCTION: The following rules and instructions were written specifically for " +
      "the Cursor AI agent environment. While these rules may sometimes reference agentic tasks " +
      "(such as executing commands), you (as an assistant) should still fully respect and follow " +
      "them for architecture, code style, and workflow decisions. Treat them as strict coding and " +
      "project standards.",
  },
  {
    id: "rules",
    name: "DETAILED_RULES",
    label: "Rules",
    directory: "ai/rules",
    color: "var(--warning-color)",
    removeMdcMetadata: true,
    concatenateContent: true,
    description:
      "%%%% META-INSTRUCTION: The following are detailed project-specific rules and guidelines. " +
      "They were written for AI assistants with extended context capabilities. Follow these rules " +
      "precisely to align with the project's coding practices, architectural decisions, and overall " +
      "quality standards.",
  },
  {
    id: "scraped",
    name: "SCRAPED_DOCUMENTATION",
    label: "Scraped Docs",
    directory: "ai/scraped",
    color: "var(--success-color)",
    description:
      "%%%% META-INSTRUCTION: The following documentation was scraped directly from official " +
      "framework or package sources. It reflects the latest available version-specific information, " +
      "which may not be part of your pre-trained knowledge. Always treat this documentation as the " +
      "source of truth for technical details, APIs, and behavior.",
  },
  {
    id: "docs",
    name: "PROJECT_DOCUMENTATION",
    label: "Project Docs",
    directory: "ai/docs",
    color: "var(--accent-purple)",
    description:
      "%%%% META-INSTRUCTION: The following section contains additional project-specific documentation. " +
      "It may include decisions, guidelines, implementation notes, or any important project context. " +
      "Use this knowledge to better understand the project and to produce relevant, context-aware output.",
  },
  {
    id: "project_files",
    name: "PROJECT_FILES",
    label: "Project",
    directory: null,
    color: "var(--accent-blue)",
    description:
      "%%%% META-INSTRUCTION: The following section contains source code files, configuration files, " +
      "and any other assets from the project repository. Use these files to analyze the codebase, " +
      "understand project structure, and make informed implementation decisions.",
  },
  {
    id: "prompts",
    name: "PROMPTS",
    label: "Prompts",
    directory: "ai/prompts",
    color: "var(--error-color)",
    description:
      "%%%% META-INSTRUCTION: The following section contains reusable prompt templates and prompt " +
      "snippets designed for this project. Use them as references or building blocks when generating " +
      "new prompts, ensuring consistency with existing patterns and conventions.",
  },
];
