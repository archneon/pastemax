// constants.js

// IPC Channels used internally by main.js or within preload.js logic
const IPC_CHANNELS = {
  // Main -> Renderer (Names used in main.js sender.send and preload.js validChannels)
  // Important:'preload.js' does not allow us to require constants.js,
  // therefore we need to define them there again as strings.
  FOLDER_SELECTED: "folder-selected",
  FILE_LIST_DATA: "file-list-data",
  FILE_PROCESSING_STATUS: "file-processing-status",

  // Renderer -> Main (Names used in main.js ipcMain.on and preload.js validChannels)
  OPEN_FOLDER: "open-folder",
  REQUEST_FILE_LIST: "request-file-list",
  DEBUG_FILE_SELECTION: "debug-file-selection",
};

// Other constants for the main process
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Constants for structured prompt output
const PASTEMAX_DIR = ".pastemax";
const PROMPT_OVERVIEW_FILENAME = "prompt-overview";

// Section definitions for main process categorization
const PROMPT_SECTIONS = [
  {
    id: "cursor_rules",
    name: "CURSOR_RULES",
    directory: ".cursor/rules",
  },
  {
    id: "rules",
    name: "RULES",
    directory: "ai/rules",
  },
  {
    id: "scraped",
    name: "SCRAPED_DOCUMENTATION",
    directory: "ai/scraped",
  },
  {
    id: "docs",
    name: "PROJECT_DOCUMENTATION",
    directory: "ai/docs",
  },
  {
    id: "project_files",
    name: "PROJECT_FILES",
    directory: null,
  },
  {
    id: "prompts",
    name: "PROMPTS",
    directory: "ai/prompts",
  },
];

module.exports = {
  IPC_CHANNELS,
  MAX_FILE_SIZE,
  PASTEMAX_DIR,
  PROMPT_OVERVIEW_FILENAME,
  PROMPT_SECTIONS,
  // Add any other constants needed only by main.js/preload.js here
};
