import React from "react";
import { FileListProps, FileData } from "../types/FileTypes";
import FileCard from "./FileCard";
import { arePathsEqual } from "../utils/pathUtils";

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
  // Only show files that are in the selectedFiles array and not binary/skipped
  const displayableFiles = files.filter(
    (file: FileData) =>
      selectedFiles.some((selectedPath) =>
        arePathsEqual(selectedPath, file.path)
      ) &&
      !file.isBinary &&
      !file.isSkipped
  );

  return (
    <div className="file-list-container">
      <div className="file-list-container-header">
        {view === "structured" ? "Structured" : "Flat"} view
      </div>
      {displayableFiles.length > 0 ? (
        <div className="file-list">
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
            ? "No files selected. Select files from the sidebar."
            : "Select a folder to view files"}
        </div>
      )}
    </div>
  );
};

export default FileList;
