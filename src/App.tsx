import React, {
  useState,
  useEffect,
  MouseEvent,
  useRef,
  RefObject,
} from "react";
import Sidebar from "./components/Sidebar";
import FileList from "./components/FileList";
import CopyButton from "./components/CopyButton";
import FileTreeToggle from "./components/FileTreeToggle";
import { FileData } from "./types/FileTypes";
import { ThemeProvider } from "./context/ThemeContext";
import ThemeToggle from "./components/ThemeToggle";
import FileListToggle from "./components/FileListToggle";
import {
  generateAsciiFileTree,
  normalizePath,
  arePathsEqual,
  comparePaths,
  basename,
} from "./utils/pathUtils";
import {
  X,
  FolderOpen,
  RefreshCw,
  LogOut,
  ChartNoAxesColumnIncreasingIcon,
  ChartNoAxesColumnDecreasingIcon,
  SortAsc,
  SortDesc,
  ArrowUpDown,
  FolderUp,
  FolderDown,
} from "lucide-react";

console.log("--- App.tsx component function starting ---");

// Access the electron API from the window object
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send: (channel: string, data?: any) => void;
        on: (channel: string, func: (...args: any[]) => void) => void;
        removeListener: (
          channel: string,
          func: (...args: any[]) => void
        ) => void;
      };
    };
  }
}

// Keys for localStorage
const STORAGE_KEYS = {
  SELECTED_FOLDER: "pastemax-selected-folder",
  SELECTED_FILES: "pastemax-selected-files",
  SORT_ORDER: "pastemax-sort-order",
  SEARCH_TERM: "pastemax-search-term",
  EXPANDED_NODES: "pastemax-expanded-nodes",
  FILE_LIST_VIEW: "pastemax-file-list-view",
  RECENT_FOLDERS: "pastemax-recent-folders",
};

// Maximum number of recent folders to store
const MAX_RECENT_FOLDERS = 10;

const App = () => {
  // Load initial state from localStorage if available
  const savedFolder = localStorage.getItem(STORAGE_KEYS.SELECTED_FOLDER);

  const savedFiles = localStorage.getItem(STORAGE_KEYS.SELECTED_FILES);
  const savedSortOrder = localStorage.getItem(STORAGE_KEYS.SORT_ORDER);
  const savedSearchTerm = localStorage.getItem(STORAGE_KEYS.SEARCH_TERM);
  const savedFileListView = localStorage.getItem(STORAGE_KEYS.FILE_LIST_VIEW);

  // Load recent folders from localStorage
  const savedRecentFolders = localStorage.getItem(STORAGE_KEYS.RECENT_FOLDERS);
  const initialRecentFolders = savedRecentFolders
    ? JSON.parse(savedRecentFolders)
    : [];

  const [selectedFolder, setSelectedFolder] = useState(
    savedFolder as string | null
  );
  const [allFiles, setAllFiles] = useState([] as FileData[]);
  const [selectedFiles, setSelectedFiles] = useState(
    savedFiles ? JSON.parse(savedFiles) : ([] as string[])
  );
  const [sortOrder, setSortOrder] = useState(savedSortOrder || "path-asc");
  const [searchTerm, setSearchTerm] = useState(savedSearchTerm || "");
  const [fileListView, setFileListView] = useState(
    savedFileListView === "flat" ? "flat" : "structured"
  );
  const [expandedNodes, setExpandedNodes] = useState(
    {} as Record<string, boolean>
  );
  const [displayedFiles, setDisplayedFiles] = useState([] as FileData[]);
  const [processingStatus, setProcessingStatus] = useState({
    status: "idle",
    message: "",
  } as {
    status: "idle" | "processing" | "complete" | "error";
    message: string;
  });
  const [includeFileTree, setIncludeFileTree] = useState(false);
  const [recentFolders, setRecentFolders] = useState(
    initialRecentFolders as string[]
  );

  // State for sort dropdown
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef(null);

  // Check if we're running in Electron or browser environment
  const isElectron = window.electron !== undefined;

  // Load expanded nodes state from localStorage
  useEffect(() => {
    const savedExpandedNodes = localStorage.getItem(
      STORAGE_KEYS.EXPANDED_NODES
    );
    if (savedExpandedNodes) {
      try {
        setExpandedNodes(JSON.parse(savedExpandedNodes));
      } catch (error) {
        console.error("Error parsing saved expanded nodes:", error);
      }
    }
  }, []);

  // Persist selected folder when it changes
  useEffect(() => {
    if (selectedFolder) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_FOLDER, selectedFolder);
    } else {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_FOLDER);
    }
  }, [selectedFolder]);

  // Persist selected files when they change
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.SELECTED_FILES,
      JSON.stringify(selectedFiles)
    );
  }, [selectedFiles]);

  // Persist sort order when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SORT_ORDER, sortOrder);
  }, [sortOrder]);

  // Persist search term when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SEARCH_TERM, searchTerm);
  }, [searchTerm]);

  // Persist file list view when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FILE_LIST_VIEW, fileListView);
  }, [fileListView]);

  // Persist recent folders when they change
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.RECENT_FOLDERS,
      JSON.stringify(recentFolders)
    );
  }, [recentFolders]);

  // Load initial data from saved folder
  useEffect(() => {
    if (!isElectron || !selectedFolder) return;

    console.log("Loading saved folder on startup:", selectedFolder);
    setProcessingStatus({
      status: "processing",
      message: "Loading files from previously selected folder...",
    });
    window.electron.ipcRenderer.send("request-file-list", selectedFolder);

    // Update recent folders when loading initial folder
    updateRecentFolders(selectedFolder);
  }, [isElectron, selectedFolder]);

  // Listen for folder selection from main process
  useEffect(() => {
    if (!isElectron) {
      console.warn("Not running in Electron environment");
      return;
    }

    const handleFolderSelected = (folderPath: string) => {
      // Check if folderPath is valid string
      if (typeof folderPath === "string") {
        console.log("Folder selected:", folderPath);
        setSelectedFolder(folderPath);
        // Clear selected files
        setSelectedFiles([]);
        setProcessingStatus({
          status: "processing",
          message: "Requesting file list...",
        });
        window.electron.ipcRenderer.send("request-file-list", folderPath);

        // Update recent folders when a new folder is selected
        updateRecentFolders(folderPath);
      } else {
        console.error("Invalid folder path received:", folderPath);
        setProcessingStatus({
          status: "error",
          message: "Invalid folder path received",
        });
      }
    };

    const handleFileListData = (files: FileData[]) => {
      console.log("Received file list data:", files.length, "files");
      setAllFiles(files);
      setProcessingStatus({
        status: "complete",
        message: `Loaded ${files.length} files`,
      });

      // Apply filters and sort to the new files
      applyFiltersAndSort(files, sortOrder, searchTerm);

      // By default, don't select any files - leave them all unselected
      setSelectedFiles([]);
    };

    const handleProcessingStatus = (status: {
      status: "idle" | "processing" | "complete" | "error";
      message: string;
    }) => {
      console.log("Processing status:", status);
      setProcessingStatus(status);
    };

    window.electron.ipcRenderer.on("folder-selected", handleFolderSelected);
    window.electron.ipcRenderer.on("file-list-data", handleFileListData);
    window.electron.ipcRenderer.on(
      "file-processing-status",
      handleProcessingStatus
    );

    return () => {
      window.electron.ipcRenderer.removeListener(
        "folder-selected",
        handleFolderSelected
      );
      window.electron.ipcRenderer.removeListener(
        "file-list-data",
        handleFileListData
      );
      window.electron.ipcRenderer.removeListener(
        "file-processing-status",
        handleProcessingStatus
      );
    };
  }, [isElectron, sortOrder, searchTerm]);

  const openFolder = () => {
    if (isElectron) {
      console.log("Opening folder dialog");
      setProcessingStatus({ status: "idle", message: "Select a folder..." });
      window.electron.ipcRenderer.send("open-folder");
    } else {
      console.warn("Folder selection not available in browser");
    }
  };

  // Apply filters and sorting to files
  const applyFiltersAndSort = (
    files: FileData[],
    sort: string,
    filter: string
  ) => {
    let filtered = files;

    // Apply filter
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      filtered = files.filter(
        (file) =>
          file.name.toLowerCase().includes(lowerFilter) ||
          file.path.toLowerCase().includes(lowerFilter)
      );
    }

    // Apply sort
    const [sortKey, sortDir] = sort.split("-");
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      if (sortKey === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortKey === "tokens") {
        comparison = a.tokenCount - b.tokenCount;
      } else if (sortKey === "size") {
        comparison = a.size - b.size;
      } else if (sortKey === "path") {
        comparison = comparePaths(a.path, b.path);
      }

      return sortDir === "asc" ? comparison : -comparison;
    });

    setDisplayedFiles(sorted);
  };

  // Toggle file selection
  const toggleFileSelection = (filePath: string) => {
    // Normalize the incoming file path to handle cross-platform issues
    const normalizedPath = normalizePath(filePath);

    setSelectedFiles((prev: string[]) => {
      // Check if the file is already selected
      const isSelected = prev.some((path) =>
        arePathsEqual(path, normalizedPath)
      );

      if (isSelected) {
        // Remove the file from selected files
        const newSelection = prev.filter(
          (path: string) => !arePathsEqual(path, normalizedPath)
        );
        return newSelection;
      } else {
        // Add the file to selected files
        const newSelection = [...prev, normalizedPath];
        return newSelection;
      }
    });
  };

  // Toggle folder selection (select/deselect all files in folder)
  const toggleFolderSelection = (folderPath: string, isSelected: boolean) => {
    // Normalize the folder path
    const normalizedFolderPath = normalizePath(folderPath);

    const filesInFolder = allFiles.filter(
      (file: FileData) =>
        normalizePath(file.path).startsWith(normalizedFolderPath) &&
        !file.isBinary &&
        !file.isSkipped
    );

    if (isSelected) {
      // Add all files from this folder that aren't already selected
      const filePaths = filesInFolder.map((file: FileData) =>
        normalizePath(file.path)
      );

      setSelectedFiles((prev: string[]) => {
        const newSelection = [...prev];
        filePaths.forEach((path: string) => {
          if (!newSelection.some((p) => arePathsEqual(p, path))) {
            newSelection.push(path);
          }
        });
        return newSelection;
      });
    } else {
      // Remove all files from this folder
      setSelectedFiles((prev: string[]) => {
        const newSelection = prev.filter(
          (path: string) =>
            !filesInFolder.some((file: FileData) =>
              arePathsEqual(normalizePath(file.path), path)
            )
        );
        return newSelection;
      });
    }
  };

  // Refresh the current folder to show new files/directories
  const refreshFolder = () => {
    if (!selectedFolder || !isElectron) return;

    setProcessingStatus({
      status: "processing",
      message: "Refreshing folder...",
    });

    // Save current selection before refreshing
    const currentSelection = [...selectedFiles];

    // Set up a listener for file list data that preserves selection
    const handleRefreshFileListData = (files: FileData[]) => {
      console.log("Received refreshed file list data:", files.length, "files");
      setAllFiles(files);

      // Apply filters and sort to the new files
      applyFiltersAndSort(files, sortOrder, searchTerm);

      // Keep only the previously selected files that still exist
      const updatedSelection = currentSelection.filter((selectedPath) =>
        files.some((file) => arePathsEqual(file.path, selectedPath))
      );

      setSelectedFiles(updatedSelection);

      setProcessingStatus({
        status: "complete",
        message: `Refreshed ${files.length} files`,
      });

      // Remove this one-time listener
      window.electron.ipcRenderer.removeListener(
        "file-list-data",
        handleRefreshFileListData
      );
    };

    // Add the one-time listener
    window.electron.ipcRenderer.on("file-list-data", handleRefreshFileListData);

    // Request file list from main process
    window.electron.ipcRenderer.send("request-file-list", selectedFolder);
  };

  // Reload the current folder (reset selection to default state)
  const reloadFolder = () => {
    if (!selectedFolder || !isElectron) return;

    setProcessingStatus({
      status: "processing",
      message: "Reloading folder...",
    });

    // Set up a listener for file list data that resets selection
    const handleReloadFileListData = (files: FileData[]) => {
      console.log("Received reloaded file list data:", files.length, "files");
      setAllFiles(files);

      // Apply filters and sort to the new files
      applyFiltersAndSort(files, sortOrder, searchTerm);

      // Reset selection to default state (all unselected)
      setSelectedFiles([]);

      setProcessingStatus({
        status: "complete",
        message: `Reloaded ${files.length} files`,
      });

      // Remove this one-time listener
      window.electron.ipcRenderer.removeListener(
        "file-list-data",
        handleReloadFileListData
      );
    };

    // Add the one-time listener
    window.electron.ipcRenderer.on("file-list-data", handleReloadFileListData);

    // Request file list from main process
    window.electron.ipcRenderer.send("request-file-list", selectedFolder);
  };

  // Handle sort change
  const handleSortChange = (newSort: string) => {
    setSortOrder(newSort);
    applyFiltersAndSort(allFiles, newSort, searchTerm);
    setSortDropdownOpen(false); // Close dropdown after selection
  };

  // Handle search change
  const handleSearchChange = (newSearch: string) => {
    setSearchTerm(newSearch);
    applyFiltersAndSort(allFiles, sortOrder, newSearch);
  };

  // Handle view change
  const handleViewChange = (newView: "structured" | "flat") => {
    setFileListView(newView);
  };

  // Toggle sort dropdown
  const toggleSortDropdown = () => {
    setSortDropdownOpen(!sortDropdownOpen);
  };

  // Calculate total tokens from selected files
  const calculateTotalTokens = () => {
    return selectedFiles.reduce((total: number, path: string) => {
      const file = allFiles.find((f: FileData) => f.path === path);
      return total + (file ? file.tokenCount : 0);
    }, 0);
  };

  // Concatenate selected files content for copying
  const getSelectedFilesContent = () => {
    // Sort selected files according to current sort order
    const [sortKey, sortDir] = sortOrder.split("-");
    const sortedSelected = allFiles
      .filter((file: FileData) => selectedFiles.includes(file.path))
      .sort((a: FileData, b: FileData) => {
        let comparison = 0;

        if (sortKey === "name") {
          comparison = a.name.localeCompare(b.name);
        } else if (sortKey === "tokens") {
          comparison = a.tokenCount - b.tokenCount;
        } else if (sortKey === "size") {
          comparison = a.size - b.size;
        } else if (sortKey === "path") {
          comparison = comparePaths(a.path, b.path);
        }

        return sortDir === "asc" ? comparison : -comparison;
      });

    if (sortedSelected.length === 0) {
      return "No files selected.";
    }

    let concatenatedString = "";

    // Add ASCII file tree if enabled
    if (includeFileTree && selectedFolder) {
      const asciiTree = generateAsciiFileTree(sortedSelected, selectedFolder);
      concatenatedString += `Project structure:\n${selectedFolder}\n${asciiTree}`;
    }

    sortedSelected.forEach((file: FileData) => {
      // Get relative path from selected folder
      let relativePath = file.path;
      if (selectedFolder && file.path.startsWith(selectedFolder)) {
        relativePath = file.path.substring(selectedFolder.length + 1); // +1 for the slash
      }

      concatenatedString += `\n\n#### File: ${relativePath}\n\n`;
      concatenatedString += file.content;
    });

    return concatenatedString;
  };

  // Handle select all files
  const selectAllFiles = () => {
    const selectablePaths = displayedFiles
      .filter((file: FileData) => !file.isBinary && !file.isSkipped)
      .map((file: FileData) => file.path);

    setSelectedFiles((prev: string[]) => {
      const newSelection = [...prev];
      selectablePaths.forEach((path: string) => {
        if (!newSelection.includes(path)) {
          newSelection.push(path);
        }
      });
      return newSelection;
    });
  };

  // Handle deselect all files
  const deselectAllFiles = () => {
    const displayedPaths = displayedFiles.map((file: FileData) => file.path);
    setSelectedFiles((prev: string[]) =>
      prev.filter((path: string) => !displayedPaths.includes(path))
    );
  };

  // Sort options for the dropdown
  const sortOptions = [
    {
      value: "path-asc",
      label: "Structure: A-Z",
      icon: <FolderUp size={16} />,
      description: "Structure: A-Z",
    },
    {
      value: "path-desc",
      label: "Structure: Z-A",
      icon: <FolderDown size={16} />,
      description: "Structure: Z-A",
    },
    {
      value: "tokens-asc",
      label: "Tokens: Low to High",
      icon: <ChartNoAxesColumnIncreasingIcon size={16} />,
      description: "Tokens: Low to High",
    },
    {
      value: "tokens-desc",
      label: "Tokens: High to Low",
      icon: <ChartNoAxesColumnDecreasingIcon size={16} />,
      description: "Tokens: High to Low",
    },
    {
      value: "name-asc",
      label: "Name: A to Z",
      icon: <SortAsc size={16} />,
      description: "Name: A to Z",
    },
    {
      value: "name-desc",
      label: "Name: Z to A",
      icon: <SortDesc size={16} />,
      description: "Name: Z to A",
    },
  ];

  // Handle expand/collapse state changes
  const toggleExpanded = (nodeId: string) => {
    setExpandedNodes((prev: Record<string, boolean>) => {
      const newState = {
        ...prev,
        [nodeId]: prev[nodeId] === undefined ? false : !prev[nodeId],
      };

      // Save to localStorage
      localStorage.setItem(
        STORAGE_KEYS.EXPANDED_NODES,
        JSON.stringify(newState)
      );

      return newState;
    });
  };

  // Update recent folders list
  const updateRecentFolders = (folderPath: string) => {
    if (!folderPath) return;

    setRecentFolders((prev: string[]) => {
      // Remove the folderPath if it already exists (to avoid duplicates)
      const filteredFolders = prev.filter(
        (path: string) => path !== folderPath
      );
      // Add the folderPath to the beginning of the array
      const updatedFolders = [folderPath, ...filteredFolders];
      // Limit the number of recent folders
      return updatedFolders.slice(0, MAX_RECENT_FOLDERS);
    });
  };

  // Select a folder from the recent folders list
  const selectRecentFolder = (folderPath: string) => {
    if (!folderPath || !isElectron) return;

    // Set selected folder
    setSelectedFolder(folderPath);

    // Reset related states
    setSelectedFiles([]);
    setAllFiles([]);
    setDisplayedFiles([]);
    setSearchTerm("");

    // Set processing status
    setProcessingStatus({
      status: "processing",
      message: "Loading files from selected folder...",
    });

    // Request file list from main process
    window.electron.ipcRenderer.send("request-file-list", folderPath);

    // Update recent folders list
    updateRecentFolders(folderPath);
  };

  // Remove a folder from the recent folders list
  const removeRecentFolder = (folderPath: string, event: any) => {
    // Prevent the click from bubbling up to the button
    event.stopPropagation();

    setRecentFolders((prev: string[]) =>
      prev.filter((path: string) => path !== folderPath)
    );
  };

  // Handle exit from the current folder
  const handleExitFolder = () => {
    // Reset all states to initial values
    setSelectedFolder(null);
    setSelectedFiles([]);
    setAllFiles([]);
    setDisplayedFiles([]);
    setSearchTerm("");
    setProcessingStatus({ status: "idle", message: "" });

    // Remove the selected folder from localStorage
    localStorage.removeItem(STORAGE_KEYS.SELECTED_FOLDER);
  };

  // Handle clicks outside of sort dropdown
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

  return (
    <ThemeProvider>
      <div className="app-container">
        {processingStatus.status === "processing" && (
          <div className="processing-indicator">
            <div className="spinner"></div>
            <span>{processingStatus.message}</span>
          </div>
        )}

        {processingStatus.status === "error" && (
          <div className="error-message">Error: {processingStatus.message}</div>
        )}

        {!selectedFolder && (
          <div className="initial-prompt">
            <div className="initial-prompt-content">
              <div className="initial-header">
                <h2>PasteMax</h2>
                <div className="initial-actions">
                  <ThemeToggle />
                  <button className="select-folder-btn" onClick={openFolder}>
                    <FolderOpen size={16} />
                    <span>Select Folder</span>
                  </button>
                </div>
              </div>

              {recentFolders.length > 0 && (
                <div className="recent-folders-section">
                  <div className="recent-folders-title">Recent folders</div>
                  <ul className="recent-folders-list">
                    {recentFolders.map((folderPath: string, index: number) => (
                      <button
                        key={index}
                        className="recent-folder-item"
                        onClick={() => selectRecentFolder(folderPath)}
                        title={folderPath}
                      >
                        <div className="recent-folder-content">
                          <span className="recent-folder-name">
                            {basename(folderPath)}
                          </span>
                          <span className="recent-folder-path">
                            {folderPath}
                          </span>
                        </div>
                        <button
                          className="recent-folder-delete"
                          onClick={(e) => removeRecentFolder(folderPath, e)}
                          title="Remove from recent folders"
                        >
                          <X size={16} />
                        </button>
                      </button>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
        {selectedFolder && (
          <div className="main-content">
            <Sidebar
              selectedFolder={selectedFolder}
              openFolder={openFolder}
              allFiles={allFiles}
              selectedFiles={selectedFiles}
              toggleFileSelection={toggleFileSelection}
              toggleFolderSelection={toggleFolderSelection}
              searchTerm={searchTerm}
              onSearchChange={handleSearchChange}
              selectAllFiles={selectAllFiles}
              deselectAllFiles={deselectAllFiles}
              refreshFolder={refreshFolder}
              reloadFolder={reloadFolder}
              expandedNodes={expandedNodes}
              toggleExpanded={toggleExpanded}
            />
            <div className="content-area">
              <div className="content-header">
                {/* <div className="content-title">Selected Files</div> */}
                <h1>PasteMax</h1>
                <div className="header-actions">
                  <ThemeToggle />
                  <div className="folder-info">
                    {selectedFolder ? (
                      <div className="selected-folder">{selectedFolder}</div>
                    ) : (
                      <span>No folder selected</span>
                    )}
                    <button
                      className="select-folder-btn"
                      onClick={openFolder}
                      disabled={processingStatus.status === "processing"}
                      title="Select Folder"
                    >
                      <FolderOpen size={16} />
                    </button>
                    {selectedFolder && (
                      <button
                        className="select-folder-btn"
                        onClick={reloadFolder}
                        disabled={processingStatus.status === "processing"}
                        title="Reload"
                      >
                        <RefreshCw size={16} />
                      </button>
                    )}
                    {selectedFolder && (
                      <button
                        className="select-folder-btn"
                        onClick={handleExitFolder}
                        title="Exit"
                      >
                        <LogOut size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="content-header">
                <div className="content-title">Selected Files</div>
                <div className="content-actions">
                  <FileListToggle
                    view={fileListView}
                    onChange={handleViewChange}
                  />
                  <div className="sort-dropdown" ref={sortDropdownRef}>
                    <button
                      className="sort-dropdown-button"
                      onClick={toggleSortDropdown}
                      title={
                        sortOptions.find((opt) => opt.value === sortOrder)
                          ?.description
                      }
                    >
                      {sortOptions.find((opt) => opt.value === sortOrder)?.icon}
                      <ArrowUpDown size={13} />
                    </button>
                    {sortDropdownOpen && (
                      <div className="sort-options">
                        {sortOptions.map((option) => (
                          <div
                            key={option.value}
                            className={`sort-option ${
                              sortOrder === option.value ? "active" : ""
                            }`}
                            onClick={() => handleSortChange(option.value)}
                            title={option.description}
                          >
                            {option.icon}
                            <span>{option.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="file-stats">
                    {selectedFiles.length} files | ~
                    {calculateTotalTokens().toLocaleString()} tokens
                  </div>
                </div>
              </div>

              <FileList
                files={displayedFiles}
                selectedFiles={selectedFiles}
                toggleFileSelection={toggleFileSelection}
                selectedFolder={selectedFolder}
                view={fileListView}
              />

              <div className="copy-button-container">
                <FileTreeToggle
                  checked={includeFileTree}
                  onChange={() => setIncludeFileTree(!includeFileTree)}
                />
                <CopyButton
                  text={getSelectedFilesContent()}
                  className="primary full-width copy-files-btn"
                >
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
