// Preload script
const { contextBridge, ipcRenderer } = require("electron");

// Set up logger
const isDev = process.env.NODE_ENV === "development";
const logger = {
  debug: (...args) => isDev && console.debug("[Preload]", ...args),
  info: (...args) => console.info("[Preload]", ...args),
  error: (...args) => console.error("[Preload]", ...args),
};

logger.info("Initializing Preload Script");

// IPC channels that are allowed for communication
const IPC_CHANNELS = {
  OPEN_FOLDER: "open-folder",
  REQUEST_FILE_LIST: "request-file-list",
  FOLDER_SELECTED: "folder-selected",
  FILE_LIST_DATA: "file-list-data",
  FILE_PROCESSING_STATUS: "file-processing-status",
};

// Map to track listeners for proper cleanup
const listeners = new Map();

// Helper function to generate unique key for listeners
function getListenerKey(channel, callback) {
  // Use callback toString to create a somewhat unique identifier
  return `${channel}:${callback.toString().substring(0, 100)}`;
}

// Helper function to ensure data is serializable for IPC
function ensureSerializable(data) {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle primitive types directly
  if (typeof data !== "object") {
    return data;
  }

  // For arrays, map each item
  if (Array.isArray(data)) {
    return data.map(ensureSerializable);
  }

  // For objects, create a new object with serializable properties
  const result = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      // Skip functions or symbols which are not serializable
      if (typeof data[key] === "function" || typeof data[key] === "symbol") {
        continue;
      }
      // Recursively process nested objects
      result[key] = ensureSerializable(data[key]);
    }
  }
  return result;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  // Flag to check if running in Electron
  isElectronCheck: true,

  // Modern, consistent API
  ipcRenderer: {
    // Add a listener to a channel
    on: (channel, callback) => {
      logger.debug(`Adding listener for channel: ${channel}`);

      // Create wrapper that serializes args and handles errors
      const wrappedCallback = (event, ...args) => {
        try {
          logger.debug(`Received event on channel: ${channel}`);
          const serializedArgs = args.map(ensureSerializable);
          callback(...serializedArgs);
        } catch (error) {
          logger.error(`Error in listener for ${channel}:`, error);
        }
      };

      // Store the mapping between original callback and wrapper
      const key = getListenerKey(channel, callback);
      listeners.set(key, wrappedCallback);

      // Register the wrapped listener with Electron
      ipcRenderer.on(channel, wrappedCallback);

      logger.debug(
        `Listener added for channel: ${channel}, total listeners: ${listeners.size}`
      );
    },

    // Send data to a channel
    send: (channel, ...args) => {
      logger.debug(`Sending to channel: ${channel}`);
      const serializedArgs = args.map(ensureSerializable);
      ipcRenderer.send(channel, ...serializedArgs);
    },

    // Remove a listener from a channel
    removeListener: (channel, callback) => {
      const key = getListenerKey(channel, callback);
      const wrappedCallback = listeners.get(key);

      if (wrappedCallback) {
        logger.debug(`Removing listener for channel: ${channel}`);
        ipcRenderer.removeListener(channel, wrappedCallback);
        listeners.delete(key);
        logger.debug(
          `Listener removed, remaining listeners: ${listeners.size}`
        );
        return true;
      } else {
        logger.error(
          `Could not find wrapper for listener on channel: ${channel}`
        );
        if (isDev) {
          logger.debug(
            `Available keys: ${Array.from(listeners.keys()).join(", ")}`
          );
        }
        return false;
      }
    },

    // Diagnostic function to get listener count
    getListenerCount: (channel) => {
      let count = 0;
      listeners.forEach((_, key) => {
        if (key.startsWith(`${channel}:`)) count++;
      });
      return count;
    },
  },
});

logger.info("Preload Script Initialized Successfully");
