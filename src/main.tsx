// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import logger from "./utils/logger";
import "./styles/index.css";

logger.info("main.tsx starting...");

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    logger.error("Root element #root not found!");
  } else {
    logger.info("Root element found. Calling ReactDOM.createRoot...");
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
