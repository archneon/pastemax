/**
 * Enhanced logger utility that works in both renderer and main processes.
 * In the renderer process, it adds [Renderer] prefix to logs for easier identification.
 * Logs are output to console, and are also centrally managed by the electron-log
 * configuration in the main process.
 */

// Define a logger interface that matches what we need
interface Logger {
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
  verbose: (message: string, ...args: any[]) => void;
}

// We're always in a renderer context when using this module from React
const isRenderer = typeof window !== "undefined";

// Create a renderer-specific logger that adds [Renderer] prefix
const rendererLogger: Logger = {
  info: (message: string, ...args: any[]) => {
    console.info(`[Renderer] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[Renderer] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[Renderer] ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    console.debug(`[Renderer] ${message}`, ...args);
  },
  verbose: (message: string, ...args: any[]) => {
    // Falls back to console.log for verbose level
    console.log(`[Renderer] ${message}`, ...args);
  },
};

// Export the appropriate logger
export default rendererLogger;
