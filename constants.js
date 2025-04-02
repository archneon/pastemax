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
const DESCRIPTIONS_DIR = "ai/.descriptions";
const OVERVIEW_FILENAME = "overview.txt";

// Section definitions for main process categorization
const PROMPT_SECTIONS = [
  {
    id: "rules",
    name: "RULES",
    directory: "ai/rules",
    descriptionFilename: "rules.txt",
  },
  {
    id: "scraped",
    name: "SCRAPED_DOCUMENTATION",
    directory: "ai/scraped",
    descriptionFilename: "scraped.txt",
  },
  {
    id: "project_files",
    name: "PROJECT_FILES",
    directory: null,
    descriptionFilename: "project_files.txt",
  },
  {
    id: "prompts",
    name: "PROMPTS",
    directory: "ai/prompts",
    descriptionFilename: "prompts.txt",
  },
];

// Tree description configuration
const PROJECT_TREE_CONFIG = {
  name: "PROJECT_TREE",
  descriptionFilename: "project_tree.txt",
};

module.exports = {
  IPC_CHANNELS,
  MAX_FILE_SIZE,
  DESCRIPTIONS_DIR,
  OVERVIEW_FILENAME,
  PROMPT_SECTIONS,
  PROJECT_TREE_CONFIG,
  // Add any other constants needed only by main.js/preload.js here
};
