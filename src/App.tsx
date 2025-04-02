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
import logger from "./utils/logger";
import {
  generateAsciiFileTree,
  normalizePath,
  arePathsEqual,
  comparePaths,
  comparePathsStructurally,
  basename,
  getRelativePath,
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
import {
  MAX_RECENT_FOLDERS,
  PROMPT_SECTIONS,
  PROMPT_MARKERS,
  PROJECT_TREE_CONFIG,
  LOCAL_STORAGE_KEYS,
  DESCRIPTIONS_DIR,
  OVERVIEW_FILENAME,
  DEFAULT_INCLUDE_FILE_TREE_GLOBAL,
  DEFAULT_INCLUDE_PROMPT_OVERVIEW_GLOBAL,
} from "./constants";
import { PromptSectionDefinition } from "./types/promptConfigTypes";

logger.info("App.tsx component function starting");

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

// Define categorizeFile function outside the component to avoid reference issues
const categorizeFile = (
  file: FileData,
  currentSelectedFolder: string | null,
  sections: PromptSectionDefinition[]
): string => {
  const defaultSection = sections.find((s) => s.directory === null);
  const defaultSectionId = defaultSection?.id || "project_files";

  // Special files don't get categorized by path for content sections
  if (
    file.descriptionForSectionId ||
    file.isOverviewTemplate ||
    file.isProjectTreeDescription ||
    !currentSelectedFolder
  ) {
    return defaultSectionId; // Assign default, won't be treated as content file anyway
  }

  const relativePath = getRelativePath(file.path, currentSelectedFolder);
  if (!relativePath) {
    return defaultSectionId;
  }

  for (const section of sections) {
    if (section.directory) {
      if (
        relativePath === section.directory ||
        relativePath.startsWith(section.directory + "/")
      ) {
        return section.id;
      }
    }
  }
  return defaultSectionId;
};

const App = () => {
  // Določimo tip za lastSelectedFolder
  const lastSelectedFolder = getLastSelectedFolder();
  // Uporabimo ustrezno tipizirano začetno vrednost brez eksplicitne tipizacije v useState
  const [selectedFolder, setSelectedFolder] = useState(lastSelectedFolder);

  // Reference za sledenje zahtevam za nalaganje datotek
  const initialLoadTriggered = useRef(false);
  const lastRequestedFolder = useRef(null);

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
    initialState.expandedNodes
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
  const [includePromptOverview, setIncludePromptOverview] = useState(
    initialState.includePromptOverview
  );
  const [recentFolders, setRecentFolders] = useState(loadRecentFolders());

  // State for sort dropdown
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  // Bolj neposredna uporaba useRef
  const sortDropdownRef = useRef(null);

  // Check if we're running in Electron or browser environment
  const isElectron = window.electron !== undefined;

  // Format marker helper function
  const formatMarker = useCallback(
    (
      template: string,
      context: { section_name?: string; file_path?: string }
    ): string => {
      let result = template;
      if (context.section_name !== undefined)
        result = result.replace("{section_name}", context.section_name);
      if (context.file_path !== undefined)
        result = result.replace("{file_path}", context.file_path);
      return result;
    },
    []
  );

  // Get selected files content
  const getSelectedFilesContent = useCallback(() => {
    // 1. Filter for *selected* files that are actual content (not binary, skipped, special)
    const contentFiles = allFiles.filter(
      (file: FileData) =>
        selectedFiles.includes(file.path) &&
        !file.isBinary &&
        !file.isSkipped &&
        !file.descriptionForSectionId &&
        !file.isOverviewTemplate &&
        !file.isProjectTreeDescription
    );

    // 2. Find special files (descriptions, overview) from *all* files
    const descriptionMap: Record<string, string> = {}; // Key: sectionId or 'project_tree'
    let overviewContent: string | null = null;
    allFiles.forEach((file: FileData) => {
      if (file.content) {
        // Ensure content exists
        if (file.descriptionForSectionId) {
          descriptionMap[file.descriptionForSectionId] = file.content;
        } else if (file.isProjectTreeDescription) {
          descriptionMap["project_tree"] = file.content; // Use special key
        } else if (file.isOverviewTemplate) {
          overviewContent = file.content;
        }
      }
    });

    // Early exit if nothing to output
    if (
      contentFiles.length === 0 &&
      !includeFileTree &&
      !includePromptOverview
    ) {
      return "No text files selected, or tree/overview not included.";
    }

    // 3. Sort content files based on UI settings
    const [sortKey, sortDir] = sortOrder.split("-");
    const sortedContentFiles = [...contentFiles].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "name") comparison = a.name.localeCompare(b.name);
      else if (sortKey === "tokens") comparison = a.tokenCount - b.tokenCount;
      else if (sortKey === "size") comparison = a.size - b.size;
      else if (sortKey === "path")
        comparison = comparePathsStructurally(a.path, b.path, selectedFolder);
      return sortDir === "asc" ? comparison : -comparison;
    });

    // --- Build Output ---
    let output = "";
    const markers = PROMPT_MARKERS;

    // 4. Add Overview (if enabled and content exists)
    if (includePromptOverview && overviewContent) {
      output += "==== SYSTEM_PROMPT_OVERVIEW ====\n";
      const contentString = String(overviewContent); // Eksplicitno pretvorimo v string
      output += contentString.trim() + "\n\n"; // Trim just in case, add spacing
    }

    // 5. Add Project Tree (if enabled)
    if (includeFileTree && selectedFolder) {
      const treeSectionName = PROJECT_TREE_CONFIG.name;
      const treeDescription = descriptionMap["project_tree"];

      output +=
        formatMarker(markers.section_open, { section_name: treeSectionName }) +
        "\n";
      if (treeDescription) {
        output += markers.description_open + "\n";
        output += String(treeDescription).trim() + "\n";
        output += markers.description_close + "\n\n";
      }
      // Generate tree from the *selected content* files
      output += ".\n"; // root directory indicator
      const asciiTree = generateAsciiFileTree(
        sortedContentFiles,
        selectedFolder
      );
      output += asciiTree + "\n";
      output +=
        formatMarker(markers.section_close, { section_name: treeSectionName }) +
        "\n\n";
    }

    // 6. Group sorted content files by sectionId
    const filesBySection: Record<string, FileData[]> = {};
    const defaultSectionId =
      PROMPT_SECTIONS.find((s) => s.directory === null)?.id || "project_files";
    sortedContentFiles.forEach((file) => {
      const sectionId = file.sectionId || defaultSectionId;
      if (!filesBySection[sectionId]) filesBySection[sectionId] = [];
      filesBySection[sectionId].push(file);
    });

    // 7. Iterate through sections IN DEFINED ORDER
    for (const section of PROMPT_SECTIONS) {
      const sectionFiles = filesBySection[section.id];
      if (!sectionFiles || sectionFiles.length === 0) continue; // Skip empty sections

      // --- Section Start ---
      output +=
        formatMarker(markers.section_open, { section_name: section.name }) +
        "\n\n";

      // --- Description ---
      const description = descriptionMap[section.id];
      if (description) {
        output += markers.description_open + "\n";
        output += String(description).trim() + "\n";
        output += markers.description_close + "\n\n";
      }

      // --- Files ---
      sectionFiles.forEach((file) => {
        const relativePath = getRelativePath(file.path, selectedFolder);
        output +=
          formatMarker(markers.file_open, { file_path: relativePath }) + "\n";
        output += file.content; // Raw content
        if (file.content && !file.content.endsWith("\n")) output += "\n"; // Ensure newline before end marker
        output +=
          formatMarker(markers.file_close, { file_path: relativePath }) +
          "\n\n";
      });

      // --- Section End ---
      output +=
        formatMarker(markers.section_close, { section_name: section.name }) +
        "\n\n";
    }

    return output.trim();
  }, [
    allFiles,
    selectedFiles,
    sortOrder,
    selectedFolder,
    includeFileTree,
    includePromptOverview,
    formatMarker,
  ]);

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
          comparison = comparePathsStructurally(a.path, b.path, selectedFolder);
        }

        return sortDir === "asc" ? comparison : -comparison;
      });

      setDisplayedFiles(sorted);
    },
    [selectedFolder]
  );

  // Obstoječi useEffect za 'file-list-data' listener
  useEffect(() => {
    if (!isElectron) return;

    const handleFolderSelected = (folderPath: string) => {
      // Obstoječa koda - brez sprememb
      if (typeof folderPath === "string") {
        logger.info("Folder selected:", folderPath);
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
        setIncludePromptOverview(newState.includePromptOverview);

        // Počistimo sezname datotek
        setAllFiles([]);
        setDisplayedFiles([]);

        // Nastavimo status in zahtevamo seznam datotek
        setProcessingStatus({
          status: "processing",
          message: "Requesting file list...",
        });

        // Update our request tracking references
        lastRequestedFolder.current = normalizedPath;

        window.electron.ipcRenderer.send("request-file-list", normalizedPath);

        // Update recent folders when a new folder is selected
        updateRecentFolders(normalizedPath);
      } else {
        logger.error("Invalid folder path received:", folderPath);
        setProcessingStatus({
          status: "error",
          message: "Invalid folder path received",
        });
      }
    };

    const handleFileListData = (receivedFiles: FileData[]) => {
      logger.info("Received file list data:", receivedFiles.length, "files");

      // POMEMBNO: Ponovno naložimo project state pred uporabo prejetih datotek
      // To zagotovi, da imamo najnovejše vrednosti vseh nastavitev po Force Reload
      if (selectedFolder) {
        const currentState = loadInitialState(selectedFolder);

        // Posodobimo vse vrednosti iz localStorage
        setSelectedFiles(currentState.selectedFiles);
        setExpandedNodes(currentState.expandedNodes);
        setSortOrder(currentState.sortOrder);
        setSearchTerm(currentState.searchTerm);
        setFileListView(currentState.fileListView);
        setIncludeFileTree(currentState.includeFileTree);
        setIncludePromptOverview(currentState.includePromptOverview);
        logger.info("Ponovno naloženo stanje iz localStorage:", {
          selectedFiles: currentState.selectedFiles.length,
          includeFileTree: currentState.includeFileTree,
          includePromptOverview: currentState.includePromptOverview,
        });
      }

      // Nadaljujemo z običajno obdelavo prejetih datotek
      const categorizedFiles = receivedFiles.map((file) => ({
        ...file,
        sectionId: categorizeFile(file, selectedFolder, PROMPT_SECTIONS),
      }));
      setAllFiles(categorizedFiles);
      setProcessingStatus({
        status: "complete",
        message: `Found ${categorizedFiles.length} files`,
      });
      applyFiltersAndSort(categorizedFiles, sortOrder, searchTerm);
    };

    // Ostali del useEffect-a ostane enak
    const handleProcessingStatus = (status: {
      status: "idle" | "processing" | "complete" | "error";
      message: string;
    }) => {
      logger.info("Processing status:", status);
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
    selectedFolder,
  ]);

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

  // Persist include prompt overview setting when it changes
  useEffect(() => {
    updateProjectProperty(
      selectedFolder,
      "includePromptOverview",
      includePromptOverview
    );
  }, [includePromptOverview, selectedFolder]);

  // Persist recent folders when they change
  useEffect(() => {
    saveRecentFolders(recentFolders);
  }, [recentFolders]);

  // Load initial data from saved folder
  useEffect(() => {
    if (!isElectron || !selectedFolder) return;

    // Prevent duplicate loading
    if (
      initialLoadTriggered.current &&
      lastRequestedFolder.current === selectedFolder
    ) {
      logger.debug("Skipping duplicate load for folder:", selectedFolder);
      return;
    }

    logger.info("Loading saved folder on startup:", selectedFolder);
    setProcessingStatus({
      status: "processing",
      message: "Loading files from previously selected folder...",
    });

    // Mark this folder as requested
    initialLoadTriggered.current = true;
    lastRequestedFolder.current = selectedFolder;

    window.electron.ipcRenderer.send("request-file-list", selectedFolder);

    // Update recent folders when loading initial folder
    updateRecentFolders(selectedFolder);
  }, [isElectron, selectedFolder, updateRecentFolders]);

  const openFolder = () => {
    if (isElectron) {
      logger.info("Opening folder dialog");
      setProcessingStatus({ status: "idle", message: "Select a folder..." });
      window.electron.ipcRenderer.send("open-folder");
    } else {
      logger.warn("Folder selection not available in browser");
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

    logger.info(
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
    const handleDataForRefresh = (
      data: FileData[] | { files: FileData[]; totalTokenCount: number }
    ) => {
      // Podprimo obe strukturi - array ali objekt s files poljem
      const receivedFiles = Array.isArray(data) ? data : data.files;

      logger.info(`Received data for ${action}: ${receivedFiles.length} files`);

      // Kategoriziraj datoteke - podobno kot v handleFileListData
      const categorizedFiles = receivedFiles.map((file) => ({
        ...file,
        sectionId: categorizeFile(file, selectedFolder, PROMPT_SECTIONS),
      }));

      // Obnovimo izbiro na podlagi shranjenih datotek in novega seznama datotek
      const validPaths = new Set(
        categorizedFiles.map((f) => normalizePath(f.path))
      );
      const restoredSelection = selectionToPreserve.filter((p) =>
        validPaths.has(normalizePath(p))
      );

      setAllFiles(categorizedFiles);
      applyFiltersAndSort(categorizedFiles, sortOrder, searchTerm);
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

    // Update request tracking reference
    lastRequestedFolder.current = selectedFolder;

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
  const toggleExpanded = (nodePath: string) => {
    setExpandedNodes((prevSet: Set<string>) => {
      const newSet = new Set(prevSet); // Create a new Set to ensure state update
      if (newSet.has(nodePath)) {
        newSet.delete(nodePath); // Remove if exists (collapse)
      } else {
        newSet.add(nodePath); // Add if doesn't exist (expand)
      }
      return newSet;
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
    setIncludePromptOverview(projectState.includePromptOverview);

    // Ponastavimo sezname datotek
    setAllFiles([]);
    setDisplayedFiles([]);

    // Nastavimo status
    setProcessingStatus({
      status: "processing",
      message: "Nalagam datoteke iz izbrane mape...",
    });

    // Update request tracking reference
    lastRequestedFolder.current = folderPath;

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
    setIncludePromptOverview(defaultState.includePromptOverview);

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
                  checked={includePromptOverview}
                  onChange={() =>
                    setIncludePromptOverview(!includePromptOverview)
                  }
                  title={
                    includePromptOverview
                      ? "Exclude prompt overview from output"
                      : "Include prompt overview in output"
                  }
                >
                  <span>Include Overview</span>
                </FileTreeToggle>

                <FileTreeToggle
                  checked={includeFileTree}
                  onChange={() => setIncludeFileTree(!includeFileTree)}
                  title={
                    includeFileTree
                      ? "Exclude file tree from output"
                      : "Include file tree in output"
                  }
                >
                  <span>Include File Tree</span>
                </FileTreeToggle>

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
