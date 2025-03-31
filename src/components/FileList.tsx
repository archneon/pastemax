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
  // Ustvarimo Set normaliziranih izbranih poti za učinkovito iskanje
  const selectedPathsSet = new Set(selectedFiles.map(normalizePath));

  // Filtriramo datoteke - prikažemo samo tiste, ki so izbrane
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
              isSelected={true} // Vse prikazane datoteke so izbrane
              toggleSelection={toggleFileSelection}
              selectedFolder={selectedFolder}
            />
          ))}
        </div>
      ) : (
        <div className="file-list-empty">
          {files.length > 0
            ? "Nobena datoteka ni izbrana. Izberite datoteke v stranski vrstici."
            : selectedFolder
            ? "Nalaganje datotek ali mapa je prazna."
            : "Izberite mapo za prikaz datotek."}
        </div>
      )}
    </div>
  );
};

export default FileList;
