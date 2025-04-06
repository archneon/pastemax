import React from "react";
import { Plus, X, FileText } from "lucide-react";
import CopyButton from "./CopyButton";
import { getRelativePath } from "../utils/pathUtils";
import { PromptSectionDefinition } from "../types/promptConfigTypes";

interface FileCardComponentProps {
  file: {
    name: string;
    path: string;
    tokenCount: number;
    content: string;
  };
  isSelected: boolean;
  toggleSelection: (path: string) => void;
  selectedFolder: string | null;
  section?: PromptSectionDefinition; // Type from the new file
}

const FileCard = ({
  file,
  isSelected,
  toggleSelection,
  selectedFolder,
  section,
}: FileCardComponentProps) => {
  const { name, path: filePath, tokenCount } = file;

  // Format token count for display
  const formattedTokens = tokenCount.toLocaleString();

  // Get relative path using the utility function
  const relativePath = getRelativePath(filePath, selectedFolder);

  return (
    // <div
    //   className={`file-card ${isSelected ? "selected" : ""}`}
    //   style={{
    //     borderLeft: section
    //       ? `4px solid ${section.color}`
    //       : "1px solid var(--border-color)",
    //     paddingLeft: section ? "7px" : "10px",
    //   }}
    // >
    <div
      className={`file-card ${isSelected ? "selected" : ""}`}
      style={{
        border: section
          ? `2px solid ${section.color}`
          : "1px solid var(--border-color)",
        // padding: "10px",
      }}
    >
      <div className="file-card-header">
        <div className="file-card-icon">
          <FileText size={16} />
        </div>
        <div className="file-card-name monospace">{name}</div>
      </div>
      <div className="file-card-info">
        <div className="file-card-path">
          <span title={relativePath}>{relativePath}</span>
        </div>
      </div>
      <div className="file-card-info">
        <div className="file-card-tokens">
          <span className="tokens-count">~{formattedTokens} tokens</span>
          {section ? (
            <span
              className="file-type"
              style={{ color: section.color, fontWeight: 500 }}
            >
              {section.label}
            </span>
          ) : (
            <span className="file-type"></span> // Fallback empty span
          )}
        </div>
      </div>

      <div className="file-card-actions">
        <button
          className="file-card-action"
          onClick={() => toggleSelection(filePath)}
          title={isSelected ? "Remove from selection" : "Add to selection"}
        >
          {isSelected ? <X size={16} /> : <Plus size={16} />}
        </button>
        <CopyButton text={file.content} className="file-card-action">
          {""}
        </CopyButton>
      </div>
    </div>
  );
};

export default FileCard;
