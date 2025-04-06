// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import logger from "./utils/logger";
import "./styles/index.css";

logger.info("main.tsx starting...");

// Check if we are in development mode based on the actual value
const isDev = process.env.NODE_ENV === "development";
logger.debug(`Running in ${isDev ? "development" : "production"} mode`);

// Set the refresh flag that can be detected after reloading
const handlePageRefresh = () => {
  logger.debug("Page refresh detected, setting reload flag");
  localStorage.setItem("__force_refresh_requested", "true");
};

// Listen for events indicating a page refresh
window.addEventListener("beforeunload", handlePageRefresh);
window.addEventListener("unload", handlePageRefresh);

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    logger.error("Root element #root not found!");
  } else {
    logger.info("Root element found. Calling ReactDOM.createRoot...");

    // // In development mode, remove Strict Mode to prevent double rendering
    // if (isDev) {
    //   logger.info(
    //     "Development mode: Disabling StrictMode to prevent double renders"
    //   );
    //   ReactDOM.createRoot(rootElement).render(<App />);
    // } else {
    //   // In production, keep Strict Mode for additional safety checks
    //   ReactDOM.createRoot(rootElement).render(
    //     <React.StrictMode>
    //       <App />
    //     </React.StrictMode>
    //   );
    // }

    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    logger.info("ReactDOM.createRoot(...).render called successfully.");
  }
} catch (error) {
  logger.error("CRITICAL ERROR during initial render in main.tsx:", error);
}
