import React from "react";

interface FileTreeToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  title?: string;
  children?: JSX.Element | JSX.Element[] | string;
}

const FileTreeToggle = ({
  checked,
  onChange,
  disabled = false,
  title,
  children,
}: FileTreeToggleProps): JSX.Element => {
  return (
    <button
      className="file-tree-toggle"
      onClick={onChange}
      type="button"
      disabled={disabled}
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
        disabled={disabled}
        className="file-tree-toggle-input"
      />
      {children || <span>Include File Tree</span>}
    </button>
  );
};

export default FileTreeToggle;
