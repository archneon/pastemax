// src/components/CopyButton.tsx
import React, { useState } from "react";
import logger from "../utils/logger";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  text: string;
  className?: string;
  children?: JSX.Element | string | JSX.Element[]; // Allow multiple children elements
  onCopy?: () => void;
  disabled?: boolean; // <-- ADDED: disabled prop definition
}

const CopyButton = ({
  text,
  className = "",
  children,
  onCopy,
  disabled = false, // <-- ADDED: Destructure disabled prop with default value
}: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // Don't copy if disabled or already copied
    if (disabled || copied) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      logger.info("Content copied to clipboard.");

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
        if (onCopy) onCopy();
      }, 200);
    } catch (err) {
      logger.error("Failed to copy:", err);
      // Optionally provide user feedback on error
    }
  };

  // Add inline styles to ensure no focus outline appears (optional, can be CSS)
  const buttonStyle: React.CSSProperties = {
    // Use React.CSSProperties for type safety
    outline: "none",
  };

  // Dynamically add 'copied' class if state is copied
  const finalClassName = `${className} ${copied ? "copied" : ""}`;

  return (
    <button
      type="button"
      className={finalClassName} // Use combined class name
      onClick={handleCopy}
      title={
        disabled
          ? "Nothing to copy" // Title when disabled
          : copied
          ? "Copied!"
          : "Copy to clipboard"
      }
      style={buttonStyle}
      disabled={disabled || copied} // <-- MODIFIED: Use the disabled prop, also disable briefly after copy
    >
      {/* Show Check icon when copied, otherwise Copy icon */}
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {/* Render children */}
      {children}
    </button>
  );
};

export default CopyButton;
