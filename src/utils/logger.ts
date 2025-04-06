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
// This is kept as documentation but not used directly
// const isRenderer = typeof window !== "undefined";

// Generate a unique instance ID for this logger - helps diagnose multiple instances
const INSTANCE_ID = Math.random().toString(36).substring(2, 8);

// Create a renderer-specific logger that adds [Renderer] prefix
const rendererLogger: Logger = {
  info: (message: string, ...args: any[]) => {
    console.info(`[Renderer:${INSTANCE_ID}] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[Renderer:${INSTANCE_ID}] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[Renderer:${INSTANCE_ID}] ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    console.debug(`[Renderer:${INSTANCE_ID}] ${message}`, ...args);
  },
  verbose: (message: string, ...args: any[]) => {
    // Falls back to console.log for verbose level
    console.log(`[Renderer:${INSTANCE_ID}] ${message}`, ...args);
  },
};

// Log when this module is loaded to track multiple instances
console.info(`[Logger:${INSTANCE_ID}] Logger module initialized`);

// Export the appropriate logger
export default rendererLogger;
