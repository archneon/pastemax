import React, {
  useState,
  useEffect,
  MouseEvent,
  useRef,
  RefObject,
  useCallback,
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
  getLastSelectedFolder,
  saveLastSelectedFolder,
  loadInitialState,
  updateProjectProperty,
  getProjectState,
  saveProjectState,
  loadRecentFolders,
  saveRecentFolders,
} from "./utils/storageUtils";
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

// Maximum number of recent folders to store
const MAX_RECENT_FOLDERS = 10;

const App = () => {
  // Določimo tip za lastSelectedFolder
  const lastSelectedFolder = getLastSelectedFolder();
  // Uporabimo ustrezno tipizirano začetno vrednost brez eksplicitne tipizacije v useState
  const [selectedFolder, setSelectedFolder] = useState(lastSelectedFolder);

  // Naloži začetno stanje za trenutno izbrano mapo
  const initialState = loadInitialState(selectedFolder);

  const [allFiles, setAllFiles] = useState([] as FileData[]);
  const [selectedFiles, setSelectedFiles] = useState(
    initialState.selectedFiles
  );
  const [sortOrder, setSortOrder] = useState(initialState.sortOrder);
  const [searchTerm, setSearchTerm] = useState(initialState.searchTerm);
  const [fileListView, setFileListView] = useState(
    initialState.fileListView as "structured" | "flat"
  );
  const [expandedNodes, setExpandedNodes] = useState(
    initialState.expandedNodes as Record<string, boolean>
  );
  const [displayedFiles, setDisplayedFiles] = useState([] as FileData[]);

  // Definiramo tip za statusni objekt
  type ProcessingStatus = {
    status: "idle" | "processing" | "complete" | "error";
    message: string;
  };

  // Uporabimo ta tip pri useState
  const [processingStatus, setProcessingStatus] = useState({
    status: "idle" as const,
    message: "",
  } satisfies ProcessingStatus);

  const [includeFileTree, setIncludeFileTree] = useState(
    initialState.includeFileTree
  );
  const [recentFolders, setRecentFolders] = useState(loadRecentFolders());

  // State for sort dropdown
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  // Bolj neposredna uporaba useRef
  const sortDropdownRef = useRef(null);

  // Check if we're running in Electron or browser environment
  const isElectron = window.electron !== undefined;

  // Update recent folders list - najprej definiramo funkcijo
  const updateRecentFolders = useCallback((folderPath: string) => {
    if (!folderPath) return;

    setRecentFolders((prev: string[]) => {
      // Odstranimo duplicirane poti
      const filtered = prev.filter(
        (path: string) => !arePathsEqual(path, folderPath)
      );
      // Dodamo novo pot na začetek in omejimo število na MAX_RECENT_FOLDERS
      return [normalizePath(folderPath), ...filtered].slice(
        0,
        MAX_RECENT_FOLDERS
      );
    });
  }, []);

  // Apply filters and sorting to files - pretvorimo v useCallback za pravilno referenciranje
  const applyFiltersAndSort = useCallback(
    (files: FileData[], sort: string, filter: string) => {
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
    },
    []
  );

  // Persist selected folder when it changes
  useEffect(() => {
    saveLastSelectedFolder(selectedFolder);
  }, [selectedFolder]);

  // Persist selected files when they change
  useEffect(() => {
    updateProjectProperty(selectedFolder, "selectedFiles", selectedFiles);
  }, [selectedFiles, selectedFolder]);

  // Persist sort order when it changes
  useEffect(() => {
    updateProjectProperty(selectedFolder, "sortOrder", sortOrder);
  }, [sortOrder, selectedFolder]);

  // Persist search term when it changes
  useEffect(() => {
    updateProjectProperty(selectedFolder, "searchTerm", searchTerm);
  }, [searchTerm, selectedFolder]);

  // Persist file list view when it changes
  useEffect(() => {
    updateProjectProperty(selectedFolder, "fileListView", fileListView);
  }, [fileListView, selectedFolder]);

  // Persist expanded nodes when they change
  useEffect(() => {
    updateProjectProperty(selectedFolder, "expandedNodes", expandedNodes);
  }, [expandedNodes, selectedFolder]);

  // Persist include file tree setting when it changes
  useEffect(() => {
    updateProjectProperty(selectedFolder, "includeFileTree", includeFileTree);
  }, [includeFileTree, selectedFolder]);

  // Persist recent folders when they change
  useEffect(() => {
    saveRecentFolders(recentFolders);
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
  }, [isElectron, selectedFolder, updateRecentFolders]);

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
        const normalizedPath = normalizePath(folderPath);

        // Najprej nastavimo novo izbrano mapo
        setSelectedFolder(normalizedPath);

        // Naložimo stanje za novo mapo iz localStorage
        const newState = loadInitialState(normalizedPath);
        setSelectedFiles(newState.selectedFiles);
        setExpandedNodes(newState.expandedNodes);
        setSortOrder(newState.sortOrder);
        setSearchTerm(newState.searchTerm);
        setFileListView(newState.fileListView);
        setIncludeFileTree(newState.includeFileTree);

        // Počistimo sezname datotek
        setAllFiles([]);
        setDisplayedFiles([]);

        // Nastavimo status in zahtevamo seznam datotek
        setProcessingStatus({
          status: "processing",
          message: "Requesting file list...",
        });
        window.electron.ipcRenderer.send("request-file-list", normalizedPath);

        // Update recent folders when a new folder is selected
        updateRecentFolders(normalizedPath);
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

      // Ne resetiramo več izbranih datotek, saj jih že naložimo iz localStorage
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
  }, [
    isElectron,
    sortOrder,
    searchTerm,
    applyFiltersAndSort,
    updateRecentFolders,
    loadInitialState,
  ]);

  const openFolder = () => {
    if (isElectron) {
      console.log("Opening folder dialog");
      setProcessingStatus({ status: "idle", message: "Select a folder..." });
      window.electron.ipcRenderer.send("open-folder");
    } else {
      console.warn("Folder selection not available in browser");
    }
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

  // Generic function for refresh/reload behavior (preserves selection)
  const refreshOrReloadFolder = (action: "refresh" | "reload") => {
    if (!selectedFolder || !isElectron) return;

    console.log(
      `${
        action === "refresh" ? "Refreshing" : "Reloading"
      } folder: ${selectedFolder}`
    );
    setProcessingStatus({
      status: "processing",
      message: `${action === "refresh" ? "Refreshing" : "Reloading"} folder...`,
    });

    // Pomembno: shranimo trenutno stanje izbranih datotek
    const selectionToPreserve = [...selectedFiles];

    // Definiramo listener za trenutno osvežitev/ponovno nalaganje
    const handleDataForRefresh = (refreshedFiles: FileData[]) => {
      console.log(
        `Received data for ${action}: ${refreshedFiles.length} files`
      );

      // Obnovimo izbiro na podlagi shranjenih datotek in novega seznama datotek
      const validPaths = new Set(
        refreshedFiles.map((f) => normalizePath(f.path))
      );
      const restoredSelection = selectionToPreserve.filter((p) =>
        validPaths.has(normalizePath(p))
      );

      setAllFiles(refreshedFiles);
      applyFiltersAndSort(refreshedFiles, sortOrder, searchTerm);
      setSelectedFiles(restoredSelection);

      setProcessingStatus({
        status: "complete",
        message: `Folder ${action === "refresh" ? "refreshed" : "reloaded"}`,
      });

      // Odstranimo listener po uporabi
      window.electron.ipcRenderer.removeListener(
        "file-list-data",
        handleDataForRefresh
      );
    };

    // Dodamo listener preden pošljemo zahtevo
    window.electron.ipcRenderer.on("file-list-data", handleDataForRefresh);

    // Zahtevamo osvežitev seznama datotek
    window.electron.ipcRenderer.send("request-file-list", selectedFolder);
  };

  const refreshFolder = () => refreshOrReloadFolder("refresh");
  const reloadFolder = () => refreshOrReloadFolder("reload");

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
      label: "Structure (A-Z)",
      icon: <FolderUp size={16} />,
      description: "Structure (A-Z)",
    },
    {
      value: "path-desc",
      label: "Structure (Z-A)",
      icon: <FolderDown size={16} />,
      description: "Structure (Z-A)",
    },
    {
      value: "tokens-asc",
      label: "Tokens (Low to High)",
      icon: <ChartNoAxesColumnIncreasingIcon size={16} />,
      description: "Tokens (Low to High)",
    },
    {
      value: "tokens-desc",
      label: "Tokens (High to Low)",
      icon: <ChartNoAxesColumnDecreasingIcon size={16} />,
      description: "Tokens (High to Low)",
    },
    {
      value: "name-asc",
      label: "Name (A to Z)",
      icon: <SortAsc size={16} />,
      description: "Name (A to Z)",
    },
    {
      value: "name-desc",
      label: "Name (Z to A)",
      icon: <SortDesc size={16} />,
      description: "Name (Z to A)",
    },
  ];

  // Handle expand/collapse state changes
  const toggleExpanded = (nodeId: string) => {
    setExpandedNodes((prev: Record<string, boolean>) => {
      const newState = {
        ...prev,
        [nodeId]: prev[nodeId] === undefined ? false : !prev[nodeId],
      };

      // Posodobimo stanje v localStorage preko storageUtils
      updateProjectProperty(selectedFolder, "expandedNodes", newState);

      return newState;
    });
  };

  // Select a folder from the recent folders list
  const selectRecentFolder = (folderPath: string) => {
    if (!folderPath || !isElectron) return;

    // Nastavimo izbrano mapo
    setSelectedFolder(folderPath);

    // Naložimo stanje za to projektno mapo
    const projectState = loadInitialState(folderPath);
    setSelectedFiles(projectState.selectedFiles);
    setExpandedNodes(projectState.expandedNodes);
    setSortOrder(projectState.sortOrder);
    setSearchTerm(projectState.searchTerm);
    setFileListView(projectState.fileListView);
    setIncludeFileTree(projectState.includeFileTree);

    // Ponastavimo sezname datotek
    setAllFiles([]);
    setDisplayedFiles([]);

    // Nastavimo status
    setProcessingStatus({
      status: "processing",
      message: "Nalagam datoteke iz izbrane mape...",
    });

    // Zahtevamo seznam datotek
    window.electron.ipcRenderer.send("request-file-list", folderPath);

    // Posodobimo seznam nedavnih map
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
    // Ponastavimo vse na začetne vrednosti
    saveLastSelectedFolder(null);
    setSelectedFolder(null);

    // Naložimo privzeto stanje
    const defaultState = loadInitialState(null);
    setSelectedFiles(defaultState.selectedFiles);
    setExpandedNodes(defaultState.expandedNodes);
    setSortOrder(defaultState.sortOrder);
    setSearchTerm(defaultState.searchTerm);
    setFileListView(defaultState.fileListView);
    setIncludeFileTree(defaultState.includeFileTree);

    setAllFiles([]);
    setDisplayedFiles([]);
    setProcessingStatus({ status: "idle", message: "" });
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
