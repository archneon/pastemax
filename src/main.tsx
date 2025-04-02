// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import logger from "./utils/logger";
import "./styles/index.css";

logger.info("main.tsx starting...");

// Preveri, če smo v razvojnem načinu na osnovi dejanske vrednosti
const isDev = process.env.NODE_ENV === "development";
logger.debug(`Running in ${isDev ? "development" : "production"} mode`);

// Nastavi zastavico za osvežitev, ki jo lahko zaznamo po ponovnem nalaganju
const handlePageRefresh = () => {
  logger.debug("Page refresh detected, setting reload flag");
  localStorage.setItem("__force_refresh_requested", "true");
};

// Posluša dogodke, ki nakazujejo osvežitev strani
window.addEventListener("beforeunload", handlePageRefresh);
window.addEventListener("unload", handlePageRefresh);

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    logger.error("Root element #root not found!");
  } else {
    logger.info("Root element found. Calling ReactDOM.createRoot...");

    // V razvojnem načinu odstranimo Strict Mode, da preprečimo dvojno renderiranje
    if (isDev) {
      logger.info(
        "Development mode: Disabling StrictMode to prevent double renders"
      );
      ReactDOM.createRoot(rootElement).render(<App />);
    } else {
      // V produkciji ohranimo Strict Mode za dodatne varnostne preglede
      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    }

    logger.info("ReactDOM.createRoot(...).render called successfully.");
  }
} catch (error) {
  logger.error("CRITICAL ERROR during initial render in main.tsx:", error);
}
