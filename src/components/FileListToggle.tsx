import React from "react";
import { LayoutGrid, List } from "lucide-react";

interface FileListToggleProps {
  view: "structured" | "flat";
  onChange: (view: "structured" | "flat") => void;
}

const FileListToggle = ({
  view,
  onChange,
}: FileListToggleProps): JSX.Element => {
  return (
    <div className="file-list-segmented-control">
      <button
        className={`file-list-segment ${view === "structured" ? "active" : ""}`}
        onClick={() => onChange("structured")}
        title="Structured View"
      >
        <LayoutGrid size={16} />
      </button>
      <button
        className={`file-list-segment ${view === "flat" ? "active" : ""}`}
        onClick={() => onChange("flat")}
        title="Flat View"
      >
        <List size={16} />
      </button>
    </div>
  );
};

export default FileListToggle;
