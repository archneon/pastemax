// src/components/TreeItem.tsx
import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { TreeNode } from "../types/FileTypes"; // Keep TreeNode
// Removed unused type imports like MouseEventType, ChangeEventType if not needed elsewhere in this file specifically
import { ChevronRight, File } from "lucide-react"; // Removed Folder if not used
import { normalizePath } from "../utils/pathUtils";
import { useProjectStore } from "../store/projectStore";

interface TreeItemProps {
  node: TreeNode;
}

const TreeItem = ({ node }: TreeItemProps) => {
  const {
    name,
    path,
    type,
    level,
    isExpanded: isExpandedFromNode,
    fileData,
  } = node;
  const checkboxRef = useRef<HTMLInputElement>(null);

  // --- Get State & Actions from Store ---
  const selectedFiles = useProjectStore(
    (state) => state.projects[state.currentSelectedFolder!]?.selectedFiles ?? []
  );
  const { toggleFileSelection, toggleFolderSelection, toggleExpandedNode } =
    useProjectStore.getState();

  // --- State Calculations (using selectedFiles from store) ---
  const selectedPathSet = useMemo(
    () => new Set(selectedFiles.map(normalizePath)),
    [selectedFiles]
  );

  const isSelected = useMemo(
    () => type === "file" && selectedPathSet.has(normalizePath(path)),
    [type, path, selectedPathSet]
  );

  // --- Corrected Helper Functions ---

  // Helper to recursively get all *selectable* file paths within a directory node
  const getAllSelectableFilePaths = useCallback(
    (dirNode: TreeNode): string[] => {
      let paths: string[] = [];
      if (!dirNode.children) {
        return paths; // Return empty array if no children
      }
      for (const child of dirNode.children) {
        if (
          child.type === "file" &&
          child.fileData &&
          !child.fileData.isBinary &&
          !child.fileData.isSkipped
        ) {
          paths.push(normalizePath(child.path));
        } else if (child.type === "directory") {
          // Correctly concatenate results from recursive calls
          paths = paths.concat(getAllSelectableFilePaths(child));
        }
      }
      return paths; // Ensure array is always returned
    },
    []
  ); // Empty dependency array is correct here

  // Check if *any* file within this directory (or subdirectories) is selected
  const isAnyFileInDirectorySelected = useMemo(() => {
    if (type !== "directory") return false; // Only for directories

    // Recursive check function
    const checkRecursively = (currentNode: TreeNode): boolean => {
      if (currentNode.type === "file") {
        return selectedPathSet.has(normalizePath(currentNode.path));
      }
      // If it's a directory with children, check if *some* child matches
      if (currentNode.children && currentNode.children.length > 0) {
        return currentNode.children.some((child) => checkRecursively(child));
      }
      // If it's an empty directory or unexpected type, return false
      return false;
    };
    // Start the check from the current node
    return checkRecursively(node);
  }, [type, node, selectedPathSet]); // Dependencies: node structure and selection set

  // Check if all selectable files within this directory are selected
  const isDirectorySelected = useMemo(() => {
    if (type !== "directory") return false; // Only applicable to directories

    const allChildFiles = getAllSelectableFilePaths(node);
    // Directory is selected if it contains at least one selectable file,
    // and *all* of those selectable files are present in the selectedPathSet.
    return (
      allChildFiles.length > 0 &&
      allChildFiles.every((filePath) => selectedPathSet.has(filePath))
    );
  }, [type, node, selectedPathSet, getAllSelectableFilePaths]); // Dependencies: node, selection, and the helper function

  // Determine if the directory is partially selected (some selected, but not all)
  // Ensure boolean values are used
  const isDirectoryPartiallySelected: boolean = useMemo(
    () =>
      type === "directory" &&
      isAnyFileInDirectorySelected &&
      !isDirectorySelected,
    [type, isAnyFileInDirectorySelected, isDirectorySelected]
  ); // Explicitly boolean based on boolean inputs

  // --- Effects ---
  useEffect(() => {
    if (checkboxRef.current) {
      // Assign the calculated boolean value
      checkboxRef.current.indeterminate = isDirectoryPartiallySelected;
    }
  }, [isDirectoryPartiallySelected]);

  // --- Other Logic ---
  const isDisabled = useMemo(
    () => !!(fileData && (fileData.isBinary || fileData.isSkipped)),
    [fileData]
  );
  const isExcludedByDefault = useMemo(
    () => !!(fileData && fileData.excludedByDefault),
    [fileData]
  );
  // Use the correctly passed prop from Sidebar (which got it from store state)
  const isNodeExpanded = type === "directory" && isExpandedFromNode;

  // --- Event Handlers ---
  const handleToggle = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Use React.MouseEvent
      e.stopPropagation();
      if (type === "directory") {
        toggleExpandedNode(path);
      }
    },
    [type, path, toggleExpandedNode]
  );

  const handleItemClick = useCallback(() => {
    if (type === "directory") {
      toggleExpandedNode(path);
    } else if (type === "file" && !isDisabled) {
      toggleFileSelection(path);
    }
  }, [type, path, isDisabled, toggleExpandedNode, toggleFileSelection]);

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Use React.ChangeEvent
      e.stopPropagation();
      const isChecked = e.target.checked;
      if (type === "file" && !isDisabled) {
        toggleFileSelection(path); // Action handles the logic
      } else if (type === "directory") {
        toggleFolderSelection(path, isChecked);
      }
    },
    [type, path, isDisabled, toggleFileSelection, toggleFolderSelection]
  );

  // --- Render ---
  return (
    <div
      className={`tree-item ${isSelected ? "selected" : ""} ${
        isExcludedByDefault ? "excluded-by-default" : ""
      }`}
      style={{ paddingLeft: `${level * 8}px` }}
      onClick={handleItemClick}
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={type === "directory" ? isNodeExpanded : undefined}
      aria-disabled={isDisabled}
    >
      {/* Toggle chevron */}
      {type === "directory" && (
        <div
          className={`tree-item-toggle ${isNodeExpanded ? "expanded" : ""}`}
          onClick={handleToggle}
          aria-label={isNodeExpanded ? "Collapse folder" : "Expand folder"}
          role="button"
        >
          <ChevronRight size={16} />
        </div>
      )}
      {/* Indentation */}
      {type === "file" && <div className="tree-item-indent"></div>}
      {/* Checkbox */}
      <input
        type="checkbox"
        className="tree-item-checkbox"
        // Assign calculated boolean values
        checked={!!(type === "file" ? isSelected : isDirectorySelected)} // Ensure boolean
        ref={checkboxRef}
        onChange={handleCheckboxChange}
        disabled={isDisabled}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select ${type} ${name}`}
      />
      {/* Content */}
      <div className="tree-item-content">
        {type === "file" && (
          <div className="tree-item-icon">
            {" "}
            <File size={14} />{" "}
          </div>
        )}
        <div className="tree-item-name">{name}</div>
        {fileData && fileData.tokenCount > 0 && (
          <span className="tree-item-tokens">
            {" "}
            (~{fileData.tokenCount.toLocaleString()}){" "}
          </span>
        )}
        {isDisabled && fileData && (
          <span className="tree-item-badge">
            {" "}
            {fileData.isBinary ? "Binary" : "Skipped"}{" "}
          </span>
        )}
        {!isDisabled && isExcludedByDefault && (
          <span className="tree-item-badge excluded">Excluded</span>
        )}
      </div>
    </div>
  );
};

export default TreeItem;
