// Type declarations for external modules
// declare module "react";
// declare module "react-dom/client";
// declare module "react/jsx-runtime";

export {};

declare module "electron";
declare module "tiktoken";
declare module "ignore";
declare module "gpt-3-encoder";

declare global {
  interface Window {
    // Define the structure of the electron API exposed via preload script
    electron: {
      isElectronCheck?: boolean; // Optional flag to check if running in Electron
      ipcRenderer: {
        send: (channel: string, data?: any) => void;
        on: (channel: string, func: (...args: any[]) => void) => void;
        removeListener: (
          channel: string,
          func: (...args: any[]) => void
        ) => void;
        // Add other methods exposed in preload.js if any
        // getListenerCount?: (channel: string) => number;
      };
      // Add other preload APIs if needed
      // e.g., store?: { get: ..., set: ... };
    };
  }
}

// Allow importing CSS files
declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}

// Allow importing various file types
declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}
