// src/components/Sidebar.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import logger from "../utils/logger";
// Ensure TreeNode and FileData are imported if used within this file beyond TreeItem
import { SidebarProps, TreeNode, FileData } from "../types/FileTypes";
// Keep custom types if still used for refs/state, otherwise can be removed
// import { UseStateType, MouseEventType } from "../types/ReactTypes";
import SearchBar from "./SearchBar";
import TreeItem from "./TreeItem";
import {
  useProjectStore,
  selectCurrentProjectState, // Selector for project-specific state
  selectAllFiles as selectStoreAllFilesHook, // Selector for allFiles
} from "../store/projectStore"; // Import store and selectors

// Define a type for the items created during the tree building process
type BuildMapItem = {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  level: number;
  fileData?: FileData; // Only for files
  children?: Record<string, BuildMapItem>; // Only for directories
  isExpanded?: boolean; // Added during conversion for directories
};

const Sidebar = ({
  selectedFolder, // Keep from props for context/display/relative path calculation
  // openFolder, // Removed, not used directly in Sidebar logic
  refreshFolder, // Keep handler from props
}: // reloadFolder, // Removed, assuming refreshFolder covers reload for now
SidebarProps) => {
  // Use updated SidebarProps
  // *** LOG: Sidebar render start ***
  const sidebarRenderCount = useRef(0);
  sidebarRenderCount.current++;
  logger.debug(`--- Sidebar render START #${sidebarRenderCount.current} ---`);

  // --- State from Zustand Store ---
  const allFiles = useProjectStore(selectStoreAllFilesHook);
  // Get state specific to the current project using selector
  const {
    searchTerm,
    expandedNodes: expandedNodesArray, // Get as array from store
  } = useProjectStore(selectCurrentProjectState);

  // Get actions from store using getState()
  const {
    setSearchTerm,
    selectAllFiles, // Action
    deselectAllFiles, // Action
  } = useProjectStore.getState();

  // --- Internal Component State ---
  const [fileTree, setFileTree] = useState<TreeNode[]>([]); // Correct useState typing
  const [isTreeBuildingComplete, setIsTreeBuildingComplete] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);

  // Convert expandedNodesArray (string[]) from store to a Set for efficient lookups in tree building/rendering
  const expandedNodesSet = useMemo(() => {
    logger.debug(
      `Sidebar Render #${sidebarRenderCount.current}: Recalculating expandedNodesSet. Array length: ${expandedNodesArray.length}`
    );
    return new Set(expandedNodesArray);
  }, [expandedNodesArray]); // Dependency is the array from the store

  // Min and max width constraints
  const MIN_SIDEBAR_WIDTH = 200;
  const MAX_SIDEBAR_WIDTH = 500;

  // --- Resize Logic (remains the same) ---
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    // Use React.MouseEvent
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleResize = (e: globalThis.MouseEvent) => {
      if (isResizing) {
        const newWidth = e.clientX;
        // Apply constraints
        const constrainedWidth = Math.max(
          MIN_SIDEBAR_WIDTH,
          Math.min(newWidth, MAX_SIDEBAR_WIDTH)
        );
        if (sidebarWidth !== constrainedWidth) {
          setSidebarWidth(constrainedWidth);
        }
      }
    };
    const handleResizeEnd = () => {
      if (isResizing) setIsResizing(false); // Only set if was resizing
    };

    // Add listeners only when resizing
    if (isResizing) {
      document.addEventListener("mousemove", handleResize);
      document.addEventListener("mouseup", handleResizeEnd);
      // Optional: Add mouse leave listener for window edge cases
      // window.addEventListener("mouseleave", handleResizeEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleResize);
      document.removeEventListener("mouseup", handleResizeEnd);
      // window.removeEventListener("mouseleave", handleResizeEnd);
    };
  }, [isResizing, sidebarWidth]); // Include sidebarWidth to recalculate if needed

  // --- File Tree Building Logic ---
  useEffect(() => {
    // Depends on allFiles from the store now
    logger.debug(
      `Sidebar Render #${sidebarRenderCount.current}: Running useEffect to build tree. allFiles length: ${allFiles.length}`
    );
    if (!selectedFolder || allFiles.length === 0) {
      // Added check for selectedFolder
      setFileTree([]);
      setIsTreeBuildingComplete(false); // Reset completion state
      logger.debug("Tree build skipped: No folder or no files.");
      return;
    }

    // Reset completion flag at the start of build
    setIsTreeBuildingComplete(false);
    logger.info("Building file tree from", allFiles.length, "files");

    // Use a try-finally block to ensure completion flag is set
    let buildCompleted = false;
    try {
      // Create a structured representation using nested objects first
      const fileMap: Record<string, BuildMapItem> = {}; // Use BuildMapItem type

      // First pass: create directories and files
      allFiles.forEach((file) => {
        if (!file.path) return;

        // Ensure selectedFolder exists for relative path calculation
        const relativePath = file.path.startsWith(selectedFolder)
          ? file.path.substring(selectedFolder.length).replace(/^\/|^\\/, "")
          : file.path; // Fallback to full path if not starting with selectedFolder (shouldn't happen ideally)

        const parts = relativePath.split(/[/\\]/);
        let currentPath = "";
        let currentLevel = fileMap; // Use currentLevel instead of current

        // Build the path in the tree
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (!part) continue; // Skip empty parts (e.g., from multiple slashes)

          currentPath = currentPath ? `${currentPath}/${part}` : part;
          // Use the original file.path for files to ensure uniqueness and correctness
          const fullNodePath =
            i === parts.length - 1
              ? file.path // For files, use the original absolute path
              : `${selectedFolder}/${currentPath}`; // For directories, construct absolute path

          if (i === parts.length - 1) {
            // This is a file node
            currentLevel[part] = {
              id: `node-${fullNodePath}`, // Use unique fullNodePath
              name: part,
              path: file.path, // Store original absolute file path
              type: "file",
              level: i,
              fileData: file, // Attach original FileData
            };
          } else {
            // This is a directory node
            if (!currentLevel[part]) {
              currentLevel[part] = {
                id: `node-${fullNodePath}`, // Use unique fullNodePath
                name: part,
                path: fullNodePath, // Store absolute directory path
                type: "directory",
                level: i,
                children: {},
              };
            } else if (currentLevel[part].type === "file") {
              // Handle edge case where a file and directory have the same name path segment (unlikely but possible)
              logger.warn(
                `Conflict: Directory path ${fullNodePath} conflicts with existing file. Skipping directory.`
              );
              // Decide how to handle - skip directory, overwrite file (dangerous), merge? Skipping is safest.
              return; // Skip processing further down this path for this file
            }
            // Ensure we are traversing down a directory
            if (
              currentLevel[part].type === "directory" &&
              currentLevel[part].children
            ) {
              currentLevel = currentLevel[part].children!; // Descend into children map
            } else {
              // This case should ideally not happen if logic is correct
              logger.error(
                `Tree building error: Expected directory at ${currentLevel[part]?.path}, but found ${currentLevel[part]?.type}. Skipping subtree.`
              );
              return; // Stop processing this file's path
            }
          }
        }
      });

      // Convert the nested object structure to the TreeNode array format
      const convertToTreeNodes = (
        nodeMap: Record<string, BuildMapItem>,
        level = 0
      ): TreeNode[] => {
        // Get values and sort them (directories first, then by name)
        const sortedItems = Object.values(nodeMap).sort((a, b) => {
          if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
          // Optional: sort hidden files/folders first if desired
          // const aIsHidden = a.name.startsWith('.');
          // const bIsHidden = b.name.startsWith('.');
          // if (aIsHidden !== bIsHidden) return aIsHidden ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        return sortedItems.map((item): TreeNode => {
          // Ensure item is typed correctly
          if (item.type === "file") {
            // File node - directly return relevant properties
            return {
              id: item.id,
              name: item.name,
              path: item.path,
              type: item.type,
              level: item.level,
              fileData: item.fileData,
              // No children or isExpanded for files
            };
          } else {
            // Directory node - recursively convert children
            const childrenNodes = item.children
              ? convertToTreeNodes(item.children, level + 1)
              : [];
            // Check if the directory's path exists in the expandedNodes Set
            const isExpanded = expandedNodesSet.has(item.path);

            return {
              id: item.id,
              name: item.name,
              path: item.path,
              type: item.type,
              level: item.level,
              children: childrenNodes, // Assign sorted children
              isExpanded, // Set based on the Set derived from store
              // No fileData for directories
            };
          }
        });
      };

      // Convert the root level fileMap to the final tree structure
      const finalTree = convertToTreeNodes(fileMap);

      setFileTree(finalTree);
      buildCompleted = true; // Mark build as successful
    } catch (err) {
      logger.error("Error building file tree:", err);
      setFileTree([]); // Reset tree on error
    } finally {
      // Always set completion flag in finally block
      setIsTreeBuildingComplete(true);
      logger.debug(`Tree build process finished. Success: ${buildCompleted}`);
    }

    // Depend on allFiles (from store) and selectedFolder (from props)
    // Also depend on expandedNodesSet to ensure 'isExpanded' is correct initially
  }, [allFiles, selectedFolder, expandedNodesSet]); // Re-run if files, folder, or expanded state changes

  // --- Tree Filtering and Flattening Logic ---
  // Using useMemo for performance optimizations
  const visibleTree = useMemo(() => {
    logger.debug(
      `Sidebar Render #${sidebarRenderCount.current}: Recalculating visibleTree. Tree length: ${fileTree.length}, Search: ${searchTerm}`
    );

    // Flattening function (recursive)
    const flatten = (
      nodes: TreeNode[],
      currentFlatList: TreeNode[] = []
    ): TreeNode[] => {
      for (const node of nodes) {
        currentFlatList.push(node);
        if (node.type === "directory" && node.isExpanded && node.children) {
          flatten(node.children, currentFlatList);
        }
      }
      return currentFlatList;
    };

    // Filtering function (recursive)
    const filter = (nodes: TreeNode[], term: string): TreeNode[] => {
      if (!term) return nodes; // Return all nodes if no search term
      const lowerTerm = term.toLowerCase();

      const nodeMatches = (node: TreeNode): boolean => {
        // Check node name
        if (node.name.toLowerCase().includes(lowerTerm)) return true;
        // For directories, check if any children match
        if (node.type === "directory" && node.children) {
          // Need to filter children first to see if any match
          const matchingChildren = node.children.filter(nodeMatches);
          return matchingChildren.length > 0;
        }
        return false;
      };

      // Filter the nodes at the current level
      return nodes.filter(nodeMatches).map((node) => {
        // If it's a directory, recursively filter its children and force expand
        if (node.type === "directory" && node.children) {
          return {
            ...node,
            children: filter(node.children, term),
            isExpanded: true, // Auto-expand on search match
          };
        }
        // If it's a file, return as is
        return node;
      });
    };

    // Apply filter first, then flatten the result
    const filteredTree = filter(fileTree, searchTerm);
    const flattenedTree = flatten(filteredTree);
    logger.debug(`Visible tree nodes: ${flattenedTree.length}`);
    return flattenedTree;
  }, [fileTree, searchTerm]); // Recalculate only when fileTree structure or searchTerm changes

  // --- Render ---
  logger.debug(
    `Sidebar Render #${sidebarRenderCount.current}: Rendering component.`
  );
  return (
    <div className="sidebar" style={{ width: `${sidebarWidth}px` }}>
      {/* Search Bar uses state and action from store */}
      <div className="sidebar-search">
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm} // Pass action directly
          placeholder="Search files..."
        />
      </div>

      {/* Action buttons use actions from store or props */}
      <div className="sidebar-actions">
        <button className="sidebar-action-btn" onClick={selectAllFiles}>
          {" "}
          Select All{" "}
        </button>
        <button className="sidebar-action-btn" onClick={deselectAllFiles}>
          {" "}
          Deselect All{" "}
        </button>
        <button className="sidebar-action-btn" onClick={refreshFolder}>
          {" "}
          Refresh{" "}
        </button>
      </div>

      {/* File Tree Display Area */}
      {/* Check if a folder is selected before attempting to display tree */}
      {selectedFolder ? (
        // Check if tree building is complete before rendering tree or loading/empty states
        isTreeBuildingComplete ? (
          <div className="file-tree">
            {visibleTree.length > 0 ? (
              // Map over the memoized visibleTree
              visibleTree.map((node) => (
                <TreeItem
                  key={node.id} // Use stable ID
                  node={node}
                />
              ))
            ) : (
              // Show message if filter yields no results
              <div className="tree-empty">
                {searchTerm
                  ? "No files match your search."
                  : "Folder is empty or files filtered."}
              </div>
            )}
          </div>
        ) : (
          // Show loading state while tree is building
          <div className="tree-loading">
            <div className="spinner"></div>
            <span>Building file tree...</span>
          </div>
        )
      ) : (
        // Show message if no folder is selected at all
        <div className="tree-empty">Select a folder to view files.</div>
      )}

      {/* Resize Handle */}
      <div
        className="sidebar-resize-handle"
        onMouseDown={handleResizeStart}
        title="Drag to resize sidebar"
      ></div>
    </div>
  );
};

export default Sidebar;
