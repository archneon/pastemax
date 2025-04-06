export interface FileData {
  name: string;
  path: string;
  content: string;
  tokenCount: number;
  size: number;
  isBinary: boolean;
  isSkipped: boolean;
  error?: string;
  fileType?: string;
  excludedByDefault?: boolean;
  sectionId?: string;
  fileKind: "overview" | "regular";
}

export interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
  isExpanded?: boolean;
  level: number;
  fileData?: FileData;
}

export interface SidebarProps {
  selectedFolder: string | null; // Still needed for context/display
  openFolder: () => void; // Handler from App
  refreshFolder: () => void; // Handler from App
  reloadFolder: () => void; // Handler from App
}
export interface FileListProps {
  files: FileData[];
  selectedFiles: string[];
  toggleFileSelection: (filePath: string) => void;
  selectedFolder: string | null;
}

export interface FileCardProps {
  file: FileData;
  isSelected: boolean;
  toggleSelection: (filePath: string) => void;
}

export interface TreeItemProps {
  node: TreeNode;
  selectedFiles: string[];
  toggleFileSelection: (filePath: string) => void;
  toggleFolderSelection: (folderPath: string, isSelected: boolean) => void;
  toggleExpanded: (path: string) => void;
}

export interface SortOption {
  value: string;
  label: string;
}

export interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export interface CopyButtonProps {
  onCopy: () => void;
  isDisabled: boolean;
  copyStatus: boolean;
}
