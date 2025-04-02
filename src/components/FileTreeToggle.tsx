import React from "react";

interface FileTreeToggleProps {
  checked: boolean;
  onChange: () => void;
  title?: string;
  children?: JSX.Element | JSX.Element[] | string;
}

const FileTreeToggle = ({
  checked,
  onChange,
  title,
  children,
}: FileTreeToggleProps): JSX.Element => {
  return (
    <button
      className="file-tree-toggle"
      onClick={onChange}
      type="button"
      title={
        title ||
        (checked
          ? "Exclude file tree from output"
          : "Include file tree in output")
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="file-tree-toggle-input"
      />
      {children || <span>Include File Tree</span>}
    </button>
  );
};

export default FileTreeToggle;
