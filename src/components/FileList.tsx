import React from "react";
import { FileListProps, FileData } from "../types/FileTypes";
import FileCard from "./FileCard";
import { arePathsEqual, normalizePath } from "../utils/pathUtils";

interface ExtendedFileListProps extends FileListProps {
  view: "structured" | "flat";
}

const FileList = ({
  files,
  selectedFiles,
  toggleFileSelection,
  selectedFolder,
  view,
}: ExtendedFileListProps) => {
  // Create a Set of normalized selected paths for efficient searching
  const selectedPathsSet = new Set(selectedFiles.map(normalizePath));

  // Filter files - show only the selected ones
  const displayableFiles = files.filter(
    (file: FileData) =>
      selectedPathsSet.has(normalizePath(file.path)) &&
      !file.isBinary &&
      !file.isSkipped
  );

  return (
    <div className="file-list-container">
      <div className="file-list-container-header">
        {view === "structured" ? "Structured" : "Flat"} view
      </div>
      {displayableFiles.length > 0 ? (
        <div className={`file-list view-${view}`}>
          {displayableFiles.map((file: FileData) => (
            <FileCard
              key={file.path}
              file={file}
              isSelected={true} // All displayed files are selected
              toggleSelection={toggleFileSelection}
              selectedFolder={selectedFolder}
            />
          ))}
        </div>
      ) : (
        <div className="file-list-empty">
          {files.length > 0
            ? "No file is selected. Select files in the sidebar."
            : selectedFolder
            ? "The loaded file or folder is empty."
            : "Select a folder to display files."}
        </div>
      )}
    </div>
  );
};

export default FileList;
