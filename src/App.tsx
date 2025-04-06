// src/App.tsx
import React, { useState, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import FileList from "./components/FileList";
import CopyButton from "./components/CopyButton";
import FileTreeToggle from "./components/FileTreeToggle";
import { ThemeProvider } from "./context/ThemeContext";
import ThemeToggle from "./components/ThemeToggle";
import FileListToggle from "./components/FileListToggle";
import { sortOptions } from "./config/sortOptions";
import logger from "./utils/logger";
// Import path utils if needed directly here (e.g., basename)
import { basename } from "./utils/pathUtils";
// Import icons if needed directly here (for SortOptions)
import { X, FolderOpen, RefreshCw, LogOut, ArrowUpDown } from "lucide-react";
// Import hook
import { useAppLogic } from "./hooks/useAppLogic";

// App Component is now much simpler
const App = () => {
  // *** Use the custom hook to get all state and logic ***
  const {
    hasHydrated,
    selectedFolder,
    recentFolders,
    processingStatus,
    selectedFiles,
    sortOrder,
    // searchTerm, // Provided by hook, but SearchBar is in Sidebar now
    fileListView,
    includeFileTree,
    includePromptOverview,
    displayedFiles,
    totalSelectedTokens,
    openFolder,
    refreshFolder,
    reloadFolder,
    handleSortChange, // Handler for dropdown in App
    handleViewChange, // Handler for toggle in App
    selectRecentFolder,
    removeRecentFolderHandler, // Pass down the actual handler
    handleExitFolder,
    setIncludeFileTree, // Handler for toggle in App
    setIncludePromptOverview, // Handler for toggle in App
    getSelectedFilesContent, // Function for CopyButton
    toggleFileSelection, // Pass down to FileList
    // handleSearchChange is NOT needed here, Sidebar handles it
  } = useAppLogic();

  // Local state for UI elements specific to App layout remains
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Effect for dropdown closing remains here
  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(event.target as Node)
      ) {
        setSortDropdownOpen(false);
      }
    };
    if (sortDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sortDropdownOpen]);

  // --- Render Logic ---
  // Log render start
  const renderCountRef = useRef(0);
  renderCountRef.current++;
  logger.debug(
    `--- App Component Render START #${renderCountRef.current} --- `
  );

  if (!hasHydrated) {
    logger.debug(
      `App Render #${renderCountRef.current}: Rendering loading indicator (not hydrated).`
    );
    return (
      <div className="processing-indicator">
        {" "}
        <div className="spinner"></div>{" "}
        <span>Loading application state...</span>{" "}
      </div>
    );
  }

  // Log return statement
  logger.debug(
    `App Render #${renderCountRef.current}: Rendering RETURN statement. Folder: ${selectedFolder}, Status: ${processingStatus.status}`
  );

  return (
    <ThemeProvider>
      <div className="app-container">
        {/* Processing Status */}
        {processingStatus.status === "processing" && (
          <div className="processing-indicator">
            {" "}
            <div className="spinner"></div>{" "}
            <span>{processingStatus.message}</span>{" "}
          </div>
        )}
        {processingStatus.status === "error" && (
          <div className="error-message">Error: {processingStatus.message}</div>
        )}

        {/* Welcome Screen */}
        {!selectedFolder && (
          <div className="initial-prompt">
            {/* Log Welcome Screen render */}
            {renderCountRef.current < 3 &&
              (logger.debug("Rendering Welcome Screen (Log 1)"), null)}
            <div className="initial-prompt-content">
              <div className="initial-header">
                <h2>PasteMax</h2>
                <div className="initial-actions">
                  <ThemeToggle />
                  {/* Use handler from hook */}
                  <button className="select-folder-btn" onClick={openFolder}>
                    {" "}
                    <FolderOpen size={16} /> <span>Select Folder</span>{" "}
                  </button>
                </div>
              </div>
              {recentFolders.length > 0 && (
                <div className="recent-folders-section">
                  <div className="recent-folders-title">Recent folders</div>
                  <ul className="recent-folders-list">
                    {recentFolders.map((folderPath: string) => (
                      <div
                        key={folderPath}
                        className="recent-folder-item"
                        onClick={() => selectRecentFolder(folderPath)}
                        title={folderPath}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectRecentFolder(folderPath);
                          }
                        }}
                        aria-label={`Open folder: ${basename(folderPath)}`}
                      >
                        <div className="recent-folder-content">
                          {" "}
                          <span className="recent-folder-name">
                            {basename(folderPath)}
                          </span>{" "}
                          <span className="recent-folder-path">
                            {folderPath}
                          </span>{" "}
                        </div>
                        {/* Use handler from hook, needs event passed - adjusted onClick */}
                        <button
                          className="recent-folder-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecentFolderHandler(folderPath);
                          }}
                          title="Remove from recent folders"
                          aria-label={`Remove ${basename(
                            folderPath
                          )} from recent folders`}
                        >
                          {" "}
                          <X size={16} />{" "}
                        </button>
                      </div>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Layout */}
        {selectedFolder && (
          <div className="main-content">
            {/* Log Main Layout render */}
            {renderCountRef.current < 3 &&
              (logger.debug(
                `Rendering Main Layout for ${selectedFolder} (Log 2)`
              ),
              null)}
            {/* Pass simplified props to Sidebar */}
            {/* REMINDER: Adjust SidebarProps temporarily if needed */}
            <Sidebar
              selectedFolder={selectedFolder}
              openFolder={openFolder}
              refreshFolder={refreshFolder}
              reloadFolder={reloadFolder}
            />
            <div className="content-area">
              {/* Header */}
              <div className="content-header">
                <h1>PasteMax</h1>
                <div className="header-actions">
                  <ThemeToggle />
                  <div className="folder-info">
                    {selectedFolder && (
                      <div className="selected-folder">{selectedFolder}</div>
                    )}
                    {/* Use handlers from hook */}
                    <button
                      className="select-folder-btn"
                      onClick={openFolder}
                      disabled={processingStatus.status === "processing"}
                      title="Select Folder"
                    >
                      {" "}
                      <FolderOpen size={16} />{" "}
                    </button>
                    {selectedFolder && (
                      <button
                        className="select-folder-btn"
                        onClick={reloadFolder}
                        disabled={processingStatus.status === "processing"}
                        title="Reload"
                      >
                        {" "}
                        <RefreshCw size={16} />{" "}
                      </button>
                    )}
                    {selectedFolder && (
                      <button
                        className="select-folder-btn"
                        onClick={handleExitFolder}
                        title="Exit Folder"
                      >
                        {" "}
                        <LogOut size={16} />{" "}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {/* Content Header 2 */}
              <div className="content-header">
                <div className="content-title">Selected Files</div>
                <div className="content-actions">
                  {/* Use state and handler from hook */}
                  <FileListToggle
                    view={fileListView}
                    onChange={handleViewChange}
                  />
                  <div className="sort-dropdown" ref={sortDropdownRef}>
                    {/* Use state and handler from hook */}
                    <button
                      className="sort-dropdown-button"
                      onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                      title={
                        sortOptions.find((opt) => opt.value === sortOrder)
                          ?.description ?? "Select Sort Order"
                      }
                    >
                      {sortOptions.find((opt) => opt.value === sortOrder)
                        ?.icon ?? <ArrowUpDown size={16} />}
                      <ArrowUpDown size={13} />
                    </button>
                    {sortDropdownOpen && (
                      <div className="sort-options">
                        {" "}
                        {sortOptions.map((option) => (
                          <div
                            key={option.value}
                            className={`sort-option ${
                              sortOrder === option.value ? "active" : ""
                            }`}
                            onClick={() => handleSortChange(option.value)}
                            title={option.description}
                          >
                            {" "}
                            {option.icon} <span>{option.description}</span>{" "}
                          </div>
                        ))}{" "}
                      </div>
                    )}
                  </div>
                  {/* Use state from hook */}
                  <div className="file-stats">
                    {" "}
                    {selectedFiles.length} files | ~
                    {totalSelectedTokens.toLocaleString()} tokens{" "}
                  </div>
                </div>
              </div>
              {/* FileList */}
              <FileList
                files={displayedFiles} // Use derived state from hook
                selectedFiles={selectedFiles} // Use state from hook
                toggleFileSelection={toggleFileSelection} // Use action from hook
                selectedFolder={selectedFolder} // Use state from hook
                view={fileListView} // Use state from hook
              />
              {/* Footer / Copy Area */}
              <div className="copy-button-container">
                {/* Use state and handlers from hook */}
                {/* Added explicit fragment <>...</> around children */}
                <FileTreeToggle
                  checked={includePromptOverview}
                  onChange={() =>
                    setIncludePromptOverview(!includePromptOverview)
                  }
                  title={
                    includePromptOverview
                      ? "Exclude prompt overview"
                      : "Include prompt overview"
                  }
                >
                  <>
                    <span>Include Overview</span>
                  </>
                </FileTreeToggle>
                <FileTreeToggle
                  checked={includeFileTree}
                  onChange={() => setIncludeFileTree(!includeFileTree)}
                  title={
                    includeFileTree ? "Exclude file tree" : "Include file tree"
                  }
                >
                  <>
                    <span>Include File Tree</span>
                  </>
                </FileTreeToggle>
                {/* Use function from hook */}
                <CopyButton
                  text={getSelectedFilesContent()}
                  className="primary full-width copy-files-btn"
                >
                  {/* Children are passed correctly */}
                  <span>COPY ({selectedFiles.length} files)</span>
                </CopyButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
};

export default App;
