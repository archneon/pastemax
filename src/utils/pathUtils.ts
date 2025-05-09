/**
 * Browser-compatible path utilities to replace Node.js path module
 */

/**
 * Normalizes a file path to use forward slashes regardless of operating system
 * This helps with path comparison across different platforms
 *
 * @param filePath The file path to normalize
 * @returns The normalized path with forward slashes
 */
export function normalizePath(filePath: string): string {
  if (!filePath) return filePath;

  // Replace backslashes with forward slashes
  return filePath.replace(/\\/g, "/");
}

/**
 * Detects the operating system
 *
 * @returns The detected operating system ('windows', 'mac', 'linux', or 'unknown')
 */
export function detectOS(): "windows" | "mac" | "linux" | "unknown" {
  if (typeof window !== "undefined" && window.navigator) {
    const platform = window.navigator.platform.toLowerCase();

    if (platform.includes("win")) {
      return "windows";
    } else if (platform.includes("mac")) {
      return "mac";
    } else if (platform.includes("linux")) {
      return "linux";
    }
  }

  return "unknown";
}

/**
 * Compares two paths for equality, handling different OS path separators
 *
 * @param path1 First path to compare
 * @param path2 Second path to compare
 * @returns True if the paths are equivalent, false otherwise
 */
export function arePathsEqual(path1: string, path2: string): boolean {
  return normalizePath(path1) === normalizePath(path2);
}

/**
 * Extract the basename from a path string
 * @param path The path to extract the basename from
 * @returns The basename (last part of the path)
 */
export function basename(path: string | null | undefined): string {
  if (!path) return "";

  // Ensure path is a string
  const pathStr = String(path);

  // Handle both forward and backslashes
  const normalizedPath = pathStr.replace(/\\/g, "/");
  // Remove trailing slashes
  const trimmedPath = normalizedPath.endsWith("/")
    ? normalizedPath.slice(0, -1)
    : normalizedPath;
  // Get the last part after the final slash
  const parts = trimmedPath.split("/");
  return parts[parts.length - 1] || "";
}

/**
 * Extract the directory name from a path string
 * @param path The path to extract the directory from
 * @returns The directory (everything except the last part)
 */
export function dirname(path: string | null | undefined): string {
  if (!path) return ".";

  // Ensure path is a string
  const pathStr = String(path);

  // Handle both forward and backslashes
  const normalizedPath = pathStr.replace(/\\/g, "/");
  // Remove trailing slashes
  const trimmedPath = normalizedPath.endsWith("/")
    ? normalizedPath.slice(0, -1)
    : normalizedPath;
  // Get everything before the final slash
  const lastSlashIndex = trimmedPath.lastIndexOf("/");
  return lastSlashIndex === -1 ? "." : trimmedPath.slice(0, lastSlashIndex);
}

/**
 * Join path segments together
 * @param segments The path segments to join
 * @returns The joined path
 */
export function join(...segments: (string | null | undefined)[]): string {
  return segments
    .filter(Boolean)
    .map((seg) => String(seg))
    .join("/")
    .replace(/\/+/g, "/"); // Replace multiple slashes with a single one
}

/**
 * Get the file extension
 * @param path The path to get the extension from
 * @returns The file extension including the dot
 */
export function extname(path: string | null | undefined): string {
  if (!path) return "";

  const basenameValue = basename(path);
  const dotIndex = basenameValue.lastIndexOf(".");
  return dotIndex === -1 || dotIndex === 0 ? "" : basenameValue.slice(dotIndex);
}

/**
 * Generate an ASCII representation of the file tree for the selected files
 * @param files Array of selected FileData objects
 * @param rootPath The root directory path
 * @returns ASCII string representing the file tree
 */
export function generateAsciiFileTree(
  files: { path: string }[],
  rootPath: string
): string {
  if (!files.length) return "No files selected.";

  // Normalize the root path for consistent path handling
  const normalizedRoot = rootPath.replace(/\\/g, "/").replace(/\/$/, "");

  // Create a tree structure from the file paths
  interface TreeNode {
    name: string;
    isFile: boolean;
    children: Record<string, TreeNode>;
  }

  const root: TreeNode = {
    name: basename(normalizedRoot),
    isFile: false,
    children: {},
  };

  // Insert a file path into the tree
  const insertPath = (filePath: string, node: TreeNode) => {
    const normalizedPath = filePath.replace(/\\/g, "/");
    if (!normalizedPath.startsWith(normalizedRoot)) return;

    const relativePath = normalizedPath
      .substring(normalizedRoot.length)
      .replace(/^\//, "");
    if (!relativePath) return;

    const pathParts = relativePath.split("/");
    let currentNode = node;

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      const isFile = i === pathParts.length - 1;

      if (!currentNode.children[part]) {
        currentNode.children[part] = {
          name: part,
          isFile,
          children: {},
        };
      }

      currentNode = currentNode.children[part];
    }
  };

  // Insert all files into the tree
  files.forEach((file) => insertPath(file.path, root));

  // Generate ASCII representation
  const generateAscii = (
    node: TreeNode,
    prefix = "",
    isLast = true,
    isRoot = true
  ): string => {
    if (!isRoot) {
      let result = prefix;
      result += isLast ? "└── " : "├── ";
      result += node.name;
      result += "\n";
      prefix += isLast ? "    " : "│   ";

      const children = Object.values(node.children).sort((a, b) => {
        // Sort by type (directories first) then by name
        if (a.isFile !== b.isFile) {
          return a.isFile ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      });

      return (
        result +
        children
          .map((child, index) =>
            generateAscii(child, prefix, index === children.length - 1, false)
          )
          .join("")
      );
    } else {
      // Root node special handling
      const children = Object.values(node.children).sort((a, b) => {
        // Sort by type (directories first) then by name
        if (a.isFile !== b.isFile) {
          return a.isFile ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      });

      return children
        .map((child, index) =>
          generateAscii(child, prefix, index === children.length - 1, false)
        )
        .join("");
    }
  };

  return generateAscii(root);
}

/**
 * Calculates the relative path from a root directory to a file path
 * @param filePath The absolute file path
 * @param rootPath The root directory path
 * @returns The relative path from rootPath to filePath
 */
export function getRelativePath(
  filePath: string,
  rootPath: string | null
): string {
  if (!rootPath || !filePath) return filePath;

  // Normalize paths for consistent handling
  const normalizedFilePath = normalizePath(filePath);
  const normalizedRootPath = normalizePath(rootPath).replace(/\/$/, "");

  // Check if filePath starts with rootPath
  if (normalizedFilePath.startsWith(normalizedRootPath)) {
    return normalizedFilePath.substring(normalizedRootPath.length + 1); // +1 for the slash
  }

  // Return original path if not within the root path
  return filePath;
}

/**
 * Compares two file paths based on directory structure and filename.
 * Uses localeCompare for natural sorting within directories.
 * @param pathA First path
 * @param pathB Second path
 * @returns -1 if pathA < pathB, 0 if equal, 1 if pathA > pathB
 */
export function comparePaths(pathA: string, pathB: string): number {
  // Normalize paths before comparison for robustness
  const normalizedA = normalizePath(pathA);
  const normalizedB = normalizePath(pathB);

  return normalizedA.localeCompare(normalizedB);
}

/**
 * Compares two file paths structurally, mimicking file tree sorting (dirs first, then files, within each level).
 * This maintains the same hierarchy as shown in the sidebar file tree.
 * @param pathA First path
 * @param pathB Second path
 * @param rootPath The root directory to make paths relative to
 * @returns -1 if pathA < pathB, 0 if equal, 1 if pathA > pathB
 */
export function comparePathsStructurally(
  pathA: string,
  pathB: string,
  rootPath: string | null
): number {
  // Fallback to simple localeCompare if no root is defined or paths are identical
  if (!rootPath) return comparePaths(pathA, pathB);
  if (pathA === pathB) return 0;

  // Get relative paths from the root folder
  const relA = getRelativePath(pathA, rootPath);
  const relB = getRelativePath(pathB, rootPath);

  // Split paths into segments
  const partsA = relA.split("/");
  const partsB = relB.split("/");

  const lenA = partsA.length;
  const lenB = partsB.length;
  const maxLen = Math.max(lenA, lenB);

  // Compare path segments one by one
  for (let i = 0; i < maxLen; i++) {
    const segmentA = partsA[i];
    const segmentB = partsB[i];

    // Handle reaching the end of one path (one is an ancestor of the other)
    if (segmentA === undefined) return -1; // A is shorter (ancestor dir), comes first
    if (segmentB === undefined) return 1; // B is shorter (ancestor dir), comes first

    // If we're at the last segment for both paths, compare them directly
    if (i === lenA - 1 && i === lenB - 1) {
      return segmentA.localeCompare(segmentB);
    }

    // Compare segments if they differ
    if (segmentA !== segmentB) {
      // Determine if the paths at this level represent a directory or a file
      // A path segment is a directory if it's not the last segment
      const isDirA = i < lenA - 1;
      const isDirB = i < lenB - 1;

      // Apply directories before files logic
      if (isDirA && !isDirB) return -1; // Directory A comes before File B
      if (!isDirA && isDirB) return 1; // File A comes after Directory B

      // Both are dirs or both are files at this level, sort alphabetically
      return segmentA.localeCompare(segmentB);
    }
  }

  // Should be unreachable if paths are different, but return 0 for safety
  return 0;
}
