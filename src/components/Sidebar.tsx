// src/components/Sidebar.tsx
import React, { useState, useEffect, useMemo } from "react";
import logger from "../utils/logger";
import { SidebarProps, TreeNode, FileData } from "../types/FileTypes"; // Import FileData if needed here
import { UseStateType, MouseEventType } from "../types/ReactTypes"; // Keep custom types for now if used
import SearchBar from "./SearchBar";
import TreeItem from "./TreeItem";
import {
  useProjectStore,
  selectCurrentProjectState,
  selectAllFiles as selectStoreAllFilesHook, // Rename selector hook if needed
} from "../store/projectStore"; // Import store and selectors

const Sidebar = ({
  selectedFolder, // Keep from props for context
  // openFolder, // Not used directly inside Sidebar logic, remove if only used in App
  refreshFolder, // Keep handler from props
}: // reloadFolder, // Keep handler from props if needed, otherwise remove
SidebarProps) => {
  // --- State from Zustand Store ---
  const allFiles = useProjectStore(selectStoreAllFilesHook);
  // Get state specific to the current project
  const {
    selectedFiles,
    searchTerm,
    expandedNodes: expandedNodesArray,
  } = useProjectStore(selectCurrentProjectState);
  // Get actions from store
  const {
    setSearchTerm,
    selectAllFiles, // Renamed store action getter if needed
    deselectAllFiles,
    toggleFileSelection,
    toggleFolderSelection,
    toggleExpandedNode,
  } = useProjectStore.getState();

  // --- Internal Component State ---
  const [fileTree, setFileTree] = useState<TreeNode[]>([]); // Correct useState typing
  const [isTreeBuildingComplete, setIsTreeBuildingComplete] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);

  // Convert expandedNodesArray (string[]) from store to a Set for efficient lookups
  const expandedNodesSet = useMemo(
    () => new Set(expandedNodesArray),
    [expandedNodesArray]
  );

  // Min and max width constraints
  const MIN_SIDEBAR_WIDTH = 200;
  const MAX_SIDEBAR_WIDTH = 500;

  // --- Resize Logic (remains the same) ---
  const handleResizeStart = (e: MouseEventType<HTMLDivElement>) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleResize = (e: globalThis.MouseEvent) => {
      if (isResizing) {
        const newWidth = e.clientX;
        if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
          setSidebarWidth(newWidth);
        }
      }
    };
    const handleResizeEnd = () => setIsResizing(false);
    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", handleResizeEnd);
    return () => {
      document.removeEventListener("mousemove", handleResize);
      document.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [isResizing]);

  // --- File Tree Building Logic ---
  useEffect(() => {
    // Depends on allFiles from the store now
    if (allFiles.length === 0) {
      setFileTree([]);
      setIsTreeBuildingComplete(false);
      return;
    }

    const buildTree = () => {
      logger.info("Building file tree from", allFiles.length, "files");
      setIsTreeBuildingComplete(false);

      try {
        const fileMap: Record<string, any> = {};

        allFiles.forEach((file) => {
          if (!file.path) return;
          // Use selectedFolder from props/store
          const relativePath =
            selectedFolder && file.path.startsWith(selectedFolder)
              ? file.path
                  .substring(selectedFolder.length)
                  .replace(/^\/|^\\/, "")
              : file.path;

          const parts = relativePath.split(/[/\\]/);
          let currentPath = "";
          let current = fileMap;

          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part) continue;

            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const fullPath =
              i === parts.length - 1
                ? file.path
                : selectedFolder
                ? `${selectedFolder}/${currentPath}`
                : currentPath;

            if (i === parts.length - 1) {
              // File node
              current[part] = {
                id: `node-${fullPath}`,
                name: part,
                path: file.path, // Use original path
                type: "file",
                level: i,
                fileData: file, // Attach original FileData
              };
            } else {
              // Directory node
              if (!current[part]) {
                current[part] = {
                  id: `node-${fullPath}`,
                  name: part,
                  path: fullPath,
                  type: "directory",
                  level: i,
                  children: {},
                };
              }
              current = current[part].children;
            }
          }
        });

        // Convert map to TreeNode array structure
        const convertToTreeNodes = (
          node: Record<string, any>,
          level = 0
        ): TreeNode[] => {
          return Object.values(node).map((item: any): TreeNode => {
            // Use any temporarily or define a map item type
            if (item.type === "file") {
              return item as TreeNode;
            } else {
              const children = convertToTreeNodes(item.children, level + 1);
              // Check expanded status using the Set derived from store state
              const isExpanded = expandedNodesSet.has(item.path);

              return {
                ...item,
                children: children.sort((a, b) => {
                  // Sort: dirs first, then hidden, then alphabetically
                  if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
                  const aIsHidden = a.name.startsWith(".");
                  const bIsHidden = b.name.startsWith(".");
                  if (aIsHidden !== bIsHidden) return aIsHidden ? -1 : 1;
                  return a.name.localeCompare(b.name);
                }),
                isExpanded, // Set isExpanded based on the Set
              };
            }
          });
        };

        const treeRoots = convertToTreeNodes(fileMap);
        const sortedTree = treeRoots.sort((a, b) => {
          // Sort root level
          if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
          const aIsHidden = a.name.startsWith(".");
          const bIsHidden = b.name.startsWith(".");
          if (aIsHidden !== bIsHidden) return aIsHidden ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        setFileTree(sortedTree);
        setIsTreeBuildingComplete(true);
      } catch (err) {
        logger.error("Error building file tree:", err);
        setFileTree([]);
        setIsTreeBuildingComplete(true); // Mark as complete even on error
      }
    };

    const buildTreeTimeoutId = setTimeout(buildTree, 0); // Build async
    return () => clearTimeout(buildTreeTimeoutId);
    // Depend on allFiles and selectedFolder (for relative paths)
    // expandedNodesSet is derived, so expandedNodesArray is the real dependency
  }, [allFiles, selectedFolder, expandedNodesArray]); // Re-run if files, folder, or expanded state changes

  // Effect to apply expanded state changes (can potentially be merged into the main build effect)
  // Or kept separate if we want to avoid rebuilding the whole structure just for expansion toggle
  useEffect(() => {
    // This effect primarily ensures that toggling expansion reflects immediately
    // without a full tree rebuild, by updating the isExpanded flag on existing nodes.
    // It depends on expandedNodesSet (derived from store's expandedNodesArray).
    if (fileTree.length === 0 || !isTreeBuildingComplete) return;

    const applyExpandedState = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map((node): TreeNode => {
        if (node.type === "directory") {
          // Get expansion state from the derived Set
          const isExpanded = expandedNodesSet.has(node.path);
          // Recursively apply to children if they exist
          const children = node.children
            ? applyExpandedState(node.children)
            : [];
          // Return new node object only if isExpanded or children changed to maintain immutability
          if (node.isExpanded !== isExpanded || node.children !== children) {
            return { ...node, isExpanded, children };
          }
        }
        return node; // Return original node if no change
      });
    };

    setFileTree((prevTree) => applyExpandedState(prevTree));
    // Depend on the Set derived from the store's array.
  }, [expandedNodesSet, isTreeBuildingComplete]); // Add isTreeBuildingComplete dependency

  // --- Tree Filtering and Flattening (remains similar, uses store's searchTerm) ---
  const flattenTree = (nodes: TreeNode[]): TreeNode[] => {
    let result: TreeNode[] = [];
    nodes.forEach((node) => {
      result.push(node);
      if (node.type === "directory" && node.isExpanded && node.children) {
        result = [...result, ...flattenTree(node.children)];
      }
    });
    return result;
  };

  const filterTree = (nodes: TreeNode[], term: string): TreeNode[] => {
    if (!term) return nodes;
    const lowerTerm = term.toLowerCase();

    const nodeMatches = (node: TreeNode): boolean => {
      if (node.name.toLowerCase().includes(lowerTerm)) return true;
      if (node.type === "directory" && node.children) {
        // Important: Also filter children recursively when checking match
        const filteredChildren = node.children.filter(nodeMatches);
        return filteredChildren.length > 0; // Match if any child matches
      }
      return false;
    };

    // Filter nodes and map to potentially update children and expansion
    return nodes.filter(nodeMatches).map((node) => {
      if (node.type === "directory" && node.children) {
        return {
          ...node,
          children: filterTree(node.children, term), // Recursively filter children
          isExpanded: true, // Auto-expand directories matching search
        };
      }
      return node;
    });
  };

  // Use searchTerm from store state for filtering
  const visibleTree = useMemo(() => {
    logger.debug("Recalculating visibleTree");
    return flattenTree(filterTree(fileTree, searchTerm));
  }, [fileTree, searchTerm]); // Recalculate when tree structure or search term changes

  // --- Render ---
  return (
    <div className="sidebar" style={{ width: `${sidebarWidth}px` }}>
      <div className="sidebar-search">
        {/* SearchBar now uses searchTerm from store and calls store action */}
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm} // Call store action directly
          placeholder="Search files..."
        />
      </div>

      <div className="sidebar-actions">
        {/* Buttons now call store actions */}
        <button className="sidebar-action-btn" onClick={selectAllFiles}>
          Select All
        </button>
        <button className="sidebar-action-btn" onClick={deselectAllFiles}>
          Deselect All
        </button>
        {/* Refresh button calls prop function */}
        <button className="sidebar-action-btn" onClick={refreshFolder}>
          Refresh
        </button>
      </div>

      {/* Conditional rendering based on file loading/presence */}
      {
        allFiles.length > 0 ? (
          isTreeBuildingComplete ? (
            <div className="file-tree">
              {visibleTree.length > 0 ? (
                // Pass necessary state and actions down to TreeItem
                // TreeItem will also need refactoring later
                visibleTree.map((node) => (
                  <TreeItem
                    key={node.id}
                    node={node}
                    // Pass selectedFiles from store state
                    selectedFiles={selectedFiles}
                    // Pass actions from store
                    toggleFileSelection={toggleFileSelection}
                    toggleFolderSelection={toggleFolderSelection}
                    toggleExpanded={toggleExpandedNode} // Pass renamed action
                  />
                ))
              ) : (
                <div className="tree-empty">No files match your search.</div>
              )}
            </div>
          ) : (
            <div className="tree-loading">
              <div className="spinner"></div>
              <span>Building file tree...</span>
            </div>
          )
        ) : // Show appropriate message if allFiles is empty (could be initial state or empty folder)
        selectedFolder ? ( // Check if a folder is actually selected
          <div className="tree-empty">No files found in this folder.</div>
        ) : (
          <div className="tree-empty">Select a folder to view files.</div>
        ) // Should not happen if App logic is correct
      }

      <div
        className="sidebar-resize-handle"
        onMouseDown={handleResizeStart}
        title="Drag to resize sidebar"
      ></div>
    </div>
  );
};

export default Sidebar;
