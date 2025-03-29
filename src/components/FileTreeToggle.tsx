import React from "react";

interface FileTreeToggleProps {
  checked: boolean;
  onChange: () => void;
}

const FileTreeToggle = ({
  checked,
  onChange,
}: FileTreeToggleProps): JSX.Element => {
  return (
    <button
      className="file-tree-toggle"
      onClick={onChange}
      type="button"
      title={
        checked
          ? "Exclude file tree from output"
          : "Include file tree in output"
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="file-tree-toggle-input"
      />
      <span>Include File Tree</span>
    </button>
  );
};

export default FileTreeToggle;
