MOJ PROMPT GEMINI 2.5 MODELU - ZACETEK:

Ce kliknem "reload" buton ali "refresh" button. Ce pa izberem sistemski "view / reload" ali "view / force reload" potem pa v sidebaru checkboxi niso izbrani. Razlog za to je, ker se ocitno v local storage resetira "selectedFiles" array. Ker vidim, da postane [] ,ce kliknem sistemski "view / reload". Prosim analiziraj tezavo in pripravi nacrt za implementacijo.
Zanimivo je, da se ostali state-i ohranijo, kot fileListView, searchTerm, sortOrder ,theme itd.

MOJ PROMPT GEMINI 2.5 MODELU - KONEC:

ODGOVOR GEMINI 2.5 MODELA - ZACETEK:

Pravilno si opazil! Težava je v tem, kako se obravnava dogodek `file-list-data` ob _začetnem nalaganju_ po sistemskem ponovnem nalaganju v primerjavi s tem, kako ga obravnavata funkciji `refreshFolder` in `reloadFolder`.

**Analiza Težave:**

1.  **Sistemski Reload:** Ko uporabiš "View -> Reload" ali "View -> Force Reload", se celoten renderer proces ponovno zažene.
    - Komponenta `App.tsx` se ponovno "mounta".
    - `useState` klice se izvedejo z vrednostmi, prebranimi iz `localStorage` preko `loadInitialState(selectedFolder)`. V tem trenutku je `selectedFiles` pravilno nastavljen na shranjeno vrednost.
    - `useEffect` hook, ki nastavi IPC listenerje, se zažene.
    - `useEffect` hook, ki zahteva začetni seznam datotek (`request-file-list`), se zažene (ker `selectedFolder` obstaja).
    - Ko Electron main proces vrne podatke (`file-list-data`), se sproži _glavni_ listener `handleFileListData` znotraj primarnega `useEffect`-a.
    - **Kritična napaka:** Ta _glavni_ `handleFileListData` (v tvoji trenutni kodi) vsebuje `setSelectedFiles([])`. Ta vrstica _povozi_ pravilno stanje, ki je bilo ravnokar naloženo iz `localStorage`, in nastavi izbrane datoteke na prazen seznam.
2.  **In-App Refresh/Reload:** Ko klikneš gumba "Refresh" ali "Reload":
    - Sproži se funkcija `refreshOrReloadFolder`.
    - Ta funkcija _najprej_ shrani trenutno stanje `selectedFiles` v lokalno spremenljivko (`selectionToPreserve`).
    - Nato registrira _začasni, enkratni_ IPC listener (`handleDataForRefresh`).
    - Pošlje zahtevo `request-file-list`.
    - Ko podatki pridejo nazaj, se sproži _samo začasni listener_ (`handleDataForRefresh`).
    - Ta začasni listener uporabi `selectionToPreserve` za pravilno obnovitev stanja `selectedFiles` in se nato odstrani. _Glavni listener `handleFileListData` se v tem primeru ne uporablja za obnovo izbire._
3.  **Zakaj se Ostalo Ohrani:** Ostala stanja (kot `sortOrder`, `searchTerm`, `fileListView`) se ohranijo, ker `handleFileListData` ne kliče njihovih `set` funkcij (npr. `setSortOrder`, `setSearchTerm`). Samo `setSelectedFiles([])` povzroča težavo.

**Načrt Implementacije:**

Rešitev je preprosta: glavni listener `handleFileListData` _ne sme_ spreminjati stanja `selectedFiles`. Začetno stanje `selectedFiles` mora biti nastavljeno _samo_ ob inicializaciji komponente iz `localStorage` (kar že počneš pravilno z `loadInitialState`), uporabniške interakcije pa ga nato posodabljajo. Funkciji za refresh/reload imata svojo logiko za ohranjanje.

**Koraki:**

1.  **Prilagodi `App.tsx`:**
    - Najdi `useEffect` hook, ki nastavlja glavne IPC listenerje (`folder-selected`, `file-list-data`, `file-processing-status`).
    - Znotraj funkcije `handleFileListData` v tem hooku **odstrani** vrstico `setSelectedFiles([])`.
    - Preglej in popravi polje odvisnosti (`dependency array`) tega `useEffect` hooka, da vključuje vse zunanje spremenljivke in funkcije, ki jih uporablja (npr. `applyFiltersAndSort`, `sortOrder`, `searchTerm`, `updateRecentFolders`). To preprečuje "stale closures".
    - (Manjša izboljšava) Poenostavi `handleFolderSelected` (ali `handleFolderSelectedIPC` v prejšnjem predlogu), da neposredno naloži novo stanje ob menjavi mape.
    - Ohrani obstoječo logiko v `refreshOrReloadFolder` z začasnim listenerjem, saj ta pravilno deluje.

**Implementacija (Spremembe v `App.tsx`):**

```typescript
import React, {
  useState,
  useEffect,
  // MouseEvent, // Ni več v uporabi?
  useRef,
  // RefObject, // Ni več v uporabi?
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
  // Odstrani neuporabljene importe iz storageUtils, če obstajajo
  getLastSelectedFolder,
  saveLastSelectedFolder,
  loadInitialState,
  updateProjectProperty,
  // getProjectState, // Uporabljeno znotraj loadInitialState
  // saveProjectState, // Uporabljeno posredno preko updateProjectProperty
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

const MAX_RECENT_FOLDERS = 10;

const App = () => {
  const lastSelectedFolder = getLastSelectedFolder();
  const [selectedFolder, setSelectedFolder] = useState(lastSelectedFolder);

  const initialState = loadInitialState(selectedFolder);

  const [allFiles, setAllFiles] = useState<FileData[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>(initialState.selectedFiles);
  const [sortOrder, setSortOrder] = useState<string>(initialState.sortOrder);
  const [searchTerm, setSearchTerm] = useState<string>(initialState.searchTerm);
  const [fileListView, setFileListView] = useState<"structured" | "flat">(initialState.fileListView);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(initialState.expandedNodes);
  const [displayedFiles, setDisplayedFiles] = useState<FileData[]>([]);

  type ProcessingStatus = { status: "idle" | "processing" | "complete" | "error"; message: string; };
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({ status: "idle", message: "" });

  const [includeFileTree, setIncludeFileTree] = useState(false);
  const [recentFolders, setRecentFolders] = useState(loadRecentFolders());
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const isElectron = window.electron !== undefined;

  // --- Persistence Effects ---
  useEffect(() => { saveLastSelectedFolder(selectedFolder); }, [selectedFolder]);
  useEffect(() => { updateProjectProperty(selectedFolder, "selectedFiles", selectedFiles); }, [selectedFiles, selectedFolder]);
  useEffect(() => { updateProjectProperty(selectedFolder, "sortOrder", sortOrder); }, [sortOrder, selectedFolder]);
  useEffect(() => { updateProjectProperty(selectedFolder, "searchTerm", searchTerm); }, [searchTerm, selectedFolder]);
  useEffect(() => { updateProjectProperty(selectedFolder, "fileListView", fileListView); }, [fileListView, selectedFolder]);
  useEffect(() => { updateProjectProperty(selectedFolder, "expandedNodes", expandedNodes); }, [expandedNodes, selectedFolder]);
  useEffect(() => { saveRecentFolders(recentFolders); }, [recentFolders]);


  // --- Utility Functions (Memoized) ---
  const applyFiltersAndSort = useCallback((files: FileData[], currentSortOrder: string, currentSearchTerm: string) => {
    console.log(`Applying filter '${currentSearchTerm}' and sort '${currentSortOrder}' to ${files.length} files`);
    let filtered = files;

    if (currentSearchTerm) {
      const lowerFilter = currentSearchTerm.toLowerCase();
      filtered = files.filter(file =>
        !file.isBinary && !file.isSkipped &&
        (file.name.toLowerCase().includes(lowerFilter) || normalizePath(file.path).toLowerCase().includes(lowerFilter))
      );
    } else {
      // Only filter out binary/skipped if no search term active in this view logic
      // Note: Sidebar might handle filtering differently for the tree view itself
       filtered = files.filter(file => !file.isBinary && !file.isSkipped);
    }

    const [sortKey, sortDir] = currentSortOrder.split("-");
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "name") comparison = a.name.localeCompare(b.name);
      else if (sortKey === "tokens") comparison = (a.tokenCount || 0) - (b.tokenCount || 0); // Handle potential undefined
      else if (sortKey === "size") comparison = (a.size || 0) - (b.size || 0); // Handle potential undefined
      else if (sortKey === "path") comparison = comparePaths(a.path, b.path);
      return sortDir === "asc" ? comparison : -comparison;
    });
    setDisplayedFiles(sorted);
  }, []); // Empty dependency array is okay here as it relies only on arguments

  const updateRecentFolders = useCallback((folderPath: string) => {
    if (!folderPath) return;
    const normalized = normalizePath(folderPath);
    setRecentFolders((prev) => {
      const filtered = prev.filter((path) => !arePathsEqual(path, normalized));
      const updated = [normalized, ...filtered];
      return updated.slice(0, MAX_RECENT_FOLDERS);
    });
  }, []);


  // --- Initial Data Load Effect ---
  useEffect(() => {
    if (isElectron && selectedFolder) {
      console.log("Requesting file list for initial folder:", selectedFolder);
      setProcessingStatus({ status: "processing", message: "Loading files..." });
      window.electron.ipcRenderer.send("request-file-list", selectedFolder);
      updateRecentFolders(selectedFolder);
    }
    // If no folder selected initially, ensure defaults (already handled by loadInitialState)
  }, [isElectron, selectedFolder, updateRecentFolders]); // updateRecentFolders added


  // --- Main IPC Listener Setup Effect ---
  useEffect(() => {
    if (!isElectron) return;

    // Handler for when a folder is *chosen* via the dialog or recent list
    const handleFolderSelected = (folderPath: string) => {
      if (typeof folderPath !== "string") {
        console.error("Invalid folder path received:", folderPath);
        setProcessingStatus({ status: "error", message: "Invalid folder path" });
        return;
      }

      const normalizedPath = normalizePath(folderPath);
      console.log("Folder selected/switched:", normalizedPath);

      // --- Logic for switching projects ---
      // 1. Update the selected folder state *first*
      setSelectedFolder(normalizedPath);

      // 2. Load state for the *new* folder
      const newState = loadInitialState(normalizedPath);
      setSelectedFiles(newState.selectedFiles); // Load saved selection
      setExpandedNodes(newState.expandedNodes);
      setSortOrder(newState.sortOrder);
      setSearchTerm(newState.searchTerm);
      setFileListView(newState.fileListView);

      // 3. Reset file lists and request new data
      setAllFiles([]);
      setDisplayedFiles([]);
      setProcessingStatus({ status: "processing", message: "Requesting file list..." });
      window.electron.ipcRenderer.send("request-file-list", normalizedPath);

      // 4. Update recent folders
      updateRecentFolders(normalizedPath);
    };

    // Handler for receiving file list data (for initial load / folder change)
    const handleFileListData = (files: FileData[]) => {
      console.log(`Received file list data (initial/change): ${files.length} files`);
      setAllFiles(files); // Update the full file list

      // Apply current filters and sort (using the current state values)
      applyFiltersAndSort(files, sortOrder, searchTerm);

      // *** CRUCIAL FIX: DO NOT RESET SELECTION HERE ***
      // The selection state is already loaded from localStorage via loadInitialState
      // setSelectedFiles([]); // <-- REMOVE THIS LINE

      setProcessingStatus({ status: "complete", message: `Loaded ${files.length} files` });
    };

    const handleProcessingStatus = (status: ProcessingStatus) => {
      console.log("Processing status:", status);
      setProcessingStatus(status);
    };

    // Register listeners
    // NOTE: Use the *same* handler for folder-selected IPC event
    window.electron.ipcRenderer.on("folder-selected", handleFolderSelected);
    window.electron.ipcRenderer.on("file-list-data", handleFileListData);
    window.electron.ipcRenderer.on("file-processing-status", handleProcessingStatus);

    // Cleanup listeners
    return () => {
      window.electron.ipcRenderer.removeListener("folder-selected", handleFolderSelected);
      window.electron.ipcRenderer.removeListener("file-list-data", handleFileListData);
      window.electron.ipcRenderer.removeListener("file-processing-status", handleProcessingStatus);
    };
    // **** IMPORTANT: Add all dependencies used inside the effect ****
  }, [isElectron, applyFiltersAndSort, sortOrder, searchTerm, updateRecentFolders]); // Add dependencies


  // --- Action Handlers ---

  const openFolder = () => {
    if (isElectron) {
      console.log("Opening folder dialog");
      setProcessingStatus({ status: "idle", message: "Select a folder..." });
      window.electron.ipcRenderer.send("open-folder");
    } else {
      console.warn("Folder selection not available in browser");
    }
  };

  // Generic function for refresh/reload behavior (preserves selection)
  const refreshOrReloadFolder = useCallback((action: "refresh" | "reload") => {
    if (!selectedFolder || !isElectron) return;

    console.log(`${action === "refresh" ? "Refreshing" : "Reloading"} folder: ${selectedFolder}`);
    setProcessingStatus({ status: "processing", message: `${action}ing folder...` });

    // Capture the current selection *before* the IPC call
    const selectionToPreserve = [...selectedFiles];

    const handleDataForRefresh = (refreshedFiles: FileData[]) => {
      console.log(`Received data for ${action}: ${refreshedFiles.length} files`);
      window.electron.ipcRenderer.removeListener("file-list-data", handleDataForRefresh); // Cleanup immediately

      const validPaths = new Set(refreshedFiles.map(f => normalizePath(f.path)));
      const restoredSelection = selectionToPreserve.filter(p => validPaths.has(normalizePath(p)));

      setAllFiles(refreshedFiles);
      applyFiltersAndSort(refreshedFiles, sortOrder, searchTerm); // Use current sort/search
      setSelectedFiles(restoredSelection); // Apply the restored selection

      setProcessingStatus({ status: "complete", message: `Folder ${action}ed` });
    };

    window.electron.ipcRenderer.on("file-list-data", handleDataForRefresh);
    window.electron.ipcRenderer.send("request-file-list", selectedFolder);
  }, [isElectron, selectedFolder, selectedFiles, sortOrder, searchTerm, applyFiltersAndSort]); // Add dependencies

  const refreshFolder = () => refreshOrReloadFolder("refresh");
  const reloadFolder = () => refreshOrReloadFolder("reload");

  const handleSortChange = (newSort: string) => {
    setSortOrder(newSort);
    applyFiltersAndSort(allFiles, newSort, searchTerm);
    setSortDropdownOpen(false);
  };

  const handleSearchChange = (newSearch: string) => {
    setSearchTerm(newSearch);
    applyFiltersAndSort(allFiles, sortOrder, newSearch);
  };

  const handleViewChange = (newView: "structured" | "flat") => {
    setFileListView(newView);
  };

  const toggleSortDropdown = () => {
    setSortDropdownOpen(!sortDropdownOpen);
  };

  const toggleFileSelection = useCallback((filePath: string) => {
    const normalizedPath = normalizePath(filePath);
    setSelectedFiles(prev => {
      const newSelection = new Set(prev.map(normalizePath)); // Work with a set for efficient add/delete
      if (newSelection.has(normalizedPath)) {
        newSelection.delete(normalizedPath);
      } else {
        newSelection.add(normalizedPath);
      }
      return Array.from(newSelection);
    });
  }, []); // No external dependencies needed for the state updater form

  const toggleFolderSelection = useCallback((folderPath: string, shouldBeSelected: boolean) => {
    const normalizedFolderPath = normalizePath(folderPath);
    // Ensure trailing slash for correct startsWith check
    const folderPrefix = normalizedFolderPath.endsWith('/') ? normalizedFolderPath : normalizedFolderPath + '/';

    const filesToToggle = allFiles
      .filter(file =>
          !file.isBinary &&
          !file.isSkipped &&
          normalizePath(file.path).startsWith(folderPrefix) // Check if path starts with folder/
      )
      .map(file => normalizePath(file.path));

    setSelectedFiles(prevSelected => {
      const currentSelectedSet = new Set(prevSelected.map(normalizePath));
      if (shouldBeSelected) {
        filesToToggle.forEach(path => currentSelectedSet.add(path));
      } else {
        filesToToggle.forEach(path => currentSelectedSet.delete(path));
      }
      return Array.from(currentSelectedSet);
    });
  }, [allFiles]); // Depends on allFiles

  const calculateTotalTokens = useCallback(() => {
    const selectedSet = new Set(selectedFiles.map(normalizePath));
    return allFiles.reduce((total, file) => {
      if (!file.isBinary && !file.isSkipped && selectedSet.has(normalizePath(file.path))) {
        return total + (file.tokenCount || 0);
      }
      return total;
    }, 0);
  }, [selectedFiles, allFiles]); // Depends on these state variables

  const getSelectedFilesContent = useCallback(() => {
      const selectedSet = new Set(selectedFiles.map(normalizePath));
      const filesToInclude = allFiles.filter(file =>
          !file.isBinary &&
          !file.isSkipped &&
          selectedSet.has(normalizePath(file.path))
      );

      const [sortKey, sortDir] = sortOrder.split("-");
      const sortedSelected = [...filesToInclude].sort((a, b) => {
          let comparison = 0;
          if (sortKey === "name") comparison = a.name.localeCompare(b.name);
          else if (sortKey === "tokens") comparison = (a.tokenCount || 0) - (b.tokenCount || 0);
          else if (sortKey === "size") comparison = (a.size || 0) - (b.size || 0);
          else if (sortKey === "path") comparison = comparePaths(a.path, b.path);
          return sortDir === "asc" ? comparison : -comparison;
      });

      if (sortedSelected.length === 0) return "No files selected.";

      let concatenatedString = "";
      if (includeFileTree && selectedFolder) {
          const normalizedRoot = normalizePath(selectedFolder);
          const asciiTree = generateAsciiFileTree(sortedSelected, normalizedRoot);
          concatenatedString += `Project structure:\n${normalizedRoot}\n${asciiTree}\n`;
      }

      sortedSelected.forEach((file) => {
          let relativePath = normalizePath(file.path);
          if (selectedFolder) {
              const normalizedRoot = normalizePath(selectedFolder);
              if(relativePath.startsWith(normalizedRoot)) {
                  relativePath = relativePath.substring(normalizedRoot.length).replace(/^\//, ''); // Remove leading slash
              }
          }
          concatenatedString += `\n#### File: ${relativePath}\n\n`;
          concatenatedString += file.content || ""; // Handle potentially null/undefined content
      });

      return concatenatedString;
  }, [selectedFiles, allFiles, sortOrder, includeFileTree, selectedFolder]); // Dependencies

  const selectAllFiles = useCallback(() => {
    const selectablePaths = displayedFiles // Select based on *currently displayed* files
      .filter(file => !file.isBinary && !file.isSkipped)
      .map(file => normalizePath(file.path));

    setSelectedFiles(prev => {
        const newSelected = new Set([...prev.map(normalizePath), ...selectablePaths]); // Use Set to avoid duplicates
        return Array.from(newSelected);
    });
  }, [displayedFiles]); // Depends on displayedFiles

  const deselectAllFiles = useCallback(() => {
     const displayedPathsSet = new Set(displayedFiles.map(file => normalizePath(file.path)));
     setSelectedFiles(prev => prev.filter(path => !displayedPathsSet.has(normalizePath(path))));
  }, [displayedFiles]); // Depends on displayedFiles

  const toggleExpanded = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newState = { ...prev, [nodeId]: !prev[nodeId] };
      // Persistence is handled by the useEffect hook for expandedNodes
      return newState;
    });
  }, []); // No external dependencies

  const selectRecentFolder = useCallback((folderPath: string) => {
      if (!folderPath || !isElectron) return;
      // Directly call the handler function instead of just setting state,
      // ensuring the full state load logic runs immediately.
      const handler = (fp: string) => {
        if (typeof fp !== "string") return;
        const normalizedPath = normalizePath(fp);
        setSelectedFolder(normalizedPath);
        const newState = loadInitialState(normalizedPath);
        setSelectedFiles(newState.selectedFiles);
        setExpandedNodes(newState.expandedNodes);
        setSortOrder(newState.sortOrder);
        setSearchTerm(newState.searchTerm);
        setFileListView(newState.fileListView);
        setAllFiles([]);
        setDisplayedFiles([]);
        setProcessingStatus({ status: "processing", message: "Requesting file list..." });
        window.electron.ipcRenderer.send("request-file-list", normalizedPath);
        updateRecentFolders(normalizedPath);
      };
      handler(folderPath);
  }, [isElectron, updateRecentFolders]); // Dependencies

  const removeRecentFolder = useCallback((folderPath: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const normalizedPath = normalizePath(folderPath);
    setRecentFolders(prev => prev.filter(path => !arePathsEqual(path, normalizedPath)));
  }, []); // No external dependencies

  const handleExitFolder = useCallback(() => {
    setSelectedFolder(null); // Triggers saving null to last selected
    const defaultState = loadInitialState(null); // Load defaults
    setSelectedFiles(defaultState.selectedFiles);
    setExpandedNodes(defaultState.expandedNodes);
    setSortOrder(defaultState.sortOrder);
    setSearchTerm(defaultState.searchTerm);
    setFileListView(defaultState.fileListView);
    setAllFiles([]);
    setDisplayedFiles([]);
    setProcessingStatus({ status: "idle", message: "" });
  }, []); // No external dependencies

  // Handle clicks outside sort dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
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

  // Sort options definition
  const sortOptions = [ /* ... ostaja enako ... */ ];
  const currentSortIcon = sortOptions.find(opt => opt.value === sortOrder)?.icon || <ArrowUpDown size={16}/>;
  const currentSortDesc = sortOptions.find(opt => opt.value === sortOrder)?.description || "Sort";

  // --- Render ---
  return (
    <ThemeProvider>
      <div className="app-container">
        {/* Indicators */}
        {processingStatus.status === "processing" && ( /* ... */ )}
        {processingStatus.status === "error" && ( /* ... */ )}

        {/* Initial Screen */}
        {!selectedFolder && processingStatus.status !== 'processing' && (
          <div className="initial-prompt">
             {/* ... ostaja enako ... */}
             {recentFolders.length > 0 && (
                <div className="recent-folders-section">
                  <div className="recent-folders-title">Recent folders</div>
                  <ul className="recent-folders-list">
                    {recentFolders.map((folderPath) => ( // index ni potreben, če je folderPath unikaten
                      <button
                        key={folderPath} // Uporabi folderPath kot ključ
                        className="recent-folder-item"
                        onClick={() => selectRecentFolder(folderPath)}
                        title={folderPath}
                      >
                        {/* ... vsebina gumba ostane enaka ... */}
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
        )}

        {/* Main App View */}
        {selectedFolder && (
          <div className="main-content">
            <Sidebar
              // ... props ostanejo enake ...
              reloadFolder={reloadFolder} // Posreduj novo funkcijo
              refreshFolder={refreshFolder}
            />
            <div className="content-area">
              <div className="content-header">
                 <h1>PasteMax</h1>
                 <div className="header-actions">
                   <ThemeToggle />
                   <div className="folder-info">
                     <div className="selected-folder" title={selectedFolder}>{basename(selectedFolder)}</div>
                     {/* Gumbi ostanejo enaki, uporabljajo posodobljene handlerje */}
                     <button className="select-folder-btn" onClick={openFolder} disabled={processingStatus.status === 'processing'} title="Select Different Folder"> <FolderOpen size={16} /> </button>
                     <button className="select-folder-btn" onClick={reloadFolder} disabled={processingStatus.status === 'processing'} title="Reload Folder (Keep Selection)"> <RefreshCw size={16} /> </button>
                     <button className="select-folder-btn" onClick={handleExitFolder} title="Exit Folder"> <LogOut size={16} /> </button>
                   </div>
                 </div>
              </div>
              <div className="content-header">
                <div className="content-title">Selected Files</div>
                <div className="content-actions">
                    <FileListToggle view={fileListView} onChange={handleViewChange} />
                    <div className="sort-dropdown" ref={sortDropdownRef}>
                        <button className="sort-dropdown-button" onClick={toggleSortDropdown} title={`Sort by: ${currentSortDesc}`}>
                            {currentSortIcon}
                            <ArrowUpDown size={13} />
                        </button>
                        {sortDropdownOpen && (
                            <div className="sort-options">
                                {sortOptions.map((option) => (
                                    <div key={option.value} className={`sort-option ${sortOrder === option.value ? 'active' : ''}`} onClick={() => handleSortChange(option.value)} title={option.description}>
                                        {option.icon}
                                        {/* Uporabi option.label namesto option.description za krajši prikaz */}
                                        <span>{option.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="file-stats">
                        {selectedFiles.length} files | ~{calculateTotalTokens().toLocaleString()} tokens
                    </div>
                </div>
              </div>

              {/* Prenesi allFiles v FileList, da lahko filtrira po selectedFiles */}
              <FileList
                files={displayedFiles} // Še vedno uporabno za prikaz števila v glavi? Lahko se odstrani.
                allFiles={allFiles} // Potrebno za iskanje dejanskih izbranih datotek
                selectedFiles={selectedFiles}
                toggleFileSelection={toggleFileSelection}
                selectedFolder={selectedFolder}
                view={fileListView}
              />

              <div className="copy-button-container">
                 <FileTreeToggle checked={includeFileTree} onChange={() => setIncludeFileTree(!includeFileTree)} />
                 <CopyButton text={getSelectedFilesContent()} className="primary copy-files-btn">
                    {/* Krajše besedilo */}
                    <span>COPY ({selectedFiles.length})</span>
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
```

**Ključne Spremembe v `App.tsx`:**

1.  **Odstranjeno `setSelectedFiles([])`:** V glavnem `useEffect` hooku za IPC listenerje je bila vrstica `setSelectedFiles([])` znotraj `handleFileListData` odstranjena. To je glavni popravek.
2.  **Popravljeno Polje Odvisnosti (`Dependency Array`):** V istem `useEffect` hooku je bilo polje odvisnosti posodobljeno, da vključuje `applyFiltersAndSort`, `sortOrder`, `searchTerm` in `updateRecentFolders`, saj se te vrednosti uporabljajo znotraj hooka. To zagotavlja, da hook vedno uporablja najnovejše vrednosti teh funkcij/spremenljivk.
3.  **Poenostavljen `handleFolderSelected` / `selectRecentFolder`:** Logika za menjavo mape zdaj neposredno naloži stanje za novo mapo, namesto da bi najprej brisala `selectedFiles`.
4.  **Uporaba `useCallback`:** Dodan `useCallback` za funkcije, ki se prenašajo kot props (`refreshOrReloadFolder`, `toggleFileSelection`, `toggleFolderSelection`, `calculateTotalTokens`, `getSelectedFilesContent`, `selectAllFiles`, `deselectAllFiles`, `toggleExpanded`, `selectRecentFolder`, `removeRecentFolder`, `handleExitFolder`), da se prepreči nepotrebno ponovno ustvarjanje teh funkcij ob vsakem renderju, kar lahko izboljša zmogljivost in stabilnost. Polja odvisnosti za `useCallback` so bila skrbno nastavljena.
5.  **Prenos `allFiles` v `FileList`:** Komponenta `FileList` zdaj prejme `allFiles` namesto `displayedFiles`, da lahko sama pravilno filtrira in prikaže kartice samo za datoteke, katerih poti so v `selectedFiles`.
6.  **Manjše Izboljšave:** Nekaj manjših popravkov pri tipizaciji, uporabi ključev (`key`) v seznamih in besedilu gumbov.

S temi spremembami bi moralo stanje `selectedFiles` ostati ohranjeno tudi po sistemskem ponovnem nalaganju, saj se ob inicializaciji pravilno naloži iz `localStorage`, glavni listener za `file-list-data` pa ga ne povozi več.

ODGOVOR GEMINI 2.5 MODELA - KONEC:

MOJA DODATNA NAVODILA ZATE CURSOR - ZACETEK:

Gemini model je torej pripravil nacrt za implementacijo. Ti imas svojo pamet in znanje zato lahko uporabis
njegova navodila za implementacijo a hkrati ,ce bos ugotovil, da si nasel kaksno napako ali kaksno boljso resitev
jo popravi in izboljsaj.

MOJA DODATNA NAVODILA ZATE CURSOR - KONEC:
