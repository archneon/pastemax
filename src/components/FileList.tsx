import React from "react";
import { FileListProps, FileData } from "../types/FileTypes";
import FileCard from "./FileCard";
import { normalizePath } from "../utils/pathUtils";
import { PROMPT_SECTIONS } from "../constants";
import { PromptSectionDefinition } from "../types/promptConfigTypes";

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
  const selectedPathsSet = new Set(selectedFiles.map(normalizePath)); // Keep using normalized paths for checking selection

  // Filter for files to *display* in the list (selected, not binary/skipped, only regular files)
  const displayableFiles = files.filter(
    (file) =>
      selectedPathsSet.has(normalizePath(file.path)) && // Use normalizePath for consistency
      !file.isBinary &&
      !file.isSkipped &&
      file.fileKind === "regular"
  );

  // Grouping logic for structured view
  const filesBySection: Record<string, FileData[]> = {};
  if (view === "structured") {
    const defaultSectionId =
      PROMPT_SECTIONS.find((s) => s.directory === null)?.id || "project_files";
    displayableFiles.forEach((file) => {
      const sectionId = file.sectionId || defaultSectionId;
      if (!filesBySection[sectionId]) filesBySection[sectionId] = [];
      filesBySection[sectionId].push(file);
    });
  }

  // Helper to find section config for a file
  const findSectionConfig = (
    file: FileData
  ): PromptSectionDefinition | undefined => {
    const defaultSectionId =
      PROMPT_SECTIONS.find((s) => s.directory === null)?.id || "project_files";
    return PROMPT_SECTIONS.find(
      (s) => s.id === (file.sectionId || defaultSectionId)
    );
  };

  // Render Flat View
  const renderFlatView = () => (
    <div className={`file-list view-flat`}>
      {displayableFiles.map((file: FileData) => (
        <FileCard
          key={file.path}
          file={file}
          isSelected={true}
          toggleSelection={toggleFileSelection}
          selectedFolder={selectedFolder}
          section={findSectionConfig(file)} // Pass resolved section object
        />
      ))}
    </div>
  );

  // Render Structured View
  const renderStructuredView = () => (
    <div className={`file-list-structured`}>
      {PROMPT_SECTIONS.map((sectionConfig) => {
        // Iterate in constant order
        const sectionFiles = filesBySection[sectionConfig.id];
        if (!sectionFiles || sectionFiles.length === 0) return null;

        return (
          <div
            key={sectionConfig.id}
            className="file-list-section"
            // style={{
            //   borderLeft: `3px solid ${sectionConfig.color || "transparent"}`,
            // }}
          >
            <div
              className="file-list-section-header"
              // style={{
              //   backgroundColor: sectionConfig.color
              //     ? `${sectionConfig.color}20`
              //     : "transparent",
              // }}
            >
              {sectionConfig.label} ({sectionFiles.length})
            </div>
            <div className="file-list view-structured-items">
              {/* Files are already sorted by App.tsx sortOrder */}
              {sectionFiles.map((file: FileData) => (
                <FileCard
                  key={file.path}
                  file={file}
                  isSelected={true}
                  toggleSelection={toggleFileSelection}
                  selectedFolder={selectedFolder}
                  section={sectionConfig} // Pass the current section config
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Return logic
  return (
    <div className="file-list-container">
      <div className="file-list-container-header">
        {view === "structured" ? "Structured" : "Flat"} view
      </div>
      {displayableFiles.length > 0 ? (
        view === "flat" ? (
          renderFlatView()
        ) : (
          renderStructuredView()
        )
      ) : (
        <div className="file-list-empty">
          {files.length > 0 // Check original files length passed down
            ? "No content file is selected, or selected files are descriptions/overview."
            : selectedFolder
            ? "The loaded folder is empty or all files were filtered out."
            : "Select a folder to display files."}
        </div>
      )}
    </div>
  );
};

export default FileList;
