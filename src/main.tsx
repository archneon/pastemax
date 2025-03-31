// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

console.log("--- main.tsx starting ---");

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("Root element #root not found!");
  } else {
    console.log("Root element found. Calling ReactDOM.createRoot...");
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("ReactDOM.createRoot(...).render called successfully.");
  }
} catch (error) {
  console.error(
    "--- CRITICAL ERROR during initial render in main.tsx ---",
    error
  );
}
