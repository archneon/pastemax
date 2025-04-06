import { useContext } from "react";
import { ThemeContext } from "./ThemeContext";

// Custom hook to use the theme context
export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useThemeContext must be used within a ThemeProvider");
  }
  return context;
};

// Export with both names for backward compatibility
export const useTheme = useThemeContext;
