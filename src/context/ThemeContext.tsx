import React, { createContext, useState, useEffect, useContext } from "react";
import { LOCAL_STORAGE_KEYS, THEME_OPTIONS, ThemeValue } from "../constants";

type ThemeType = ThemeValue;

interface ThemeContextType {
  theme: ThemeType;
  currentTheme: "light" | "dark"; // The actual applied theme
  setTheme: (theme: ThemeType) => void;
}

// Create context with proper typing
const defaultThemeContext: ThemeContextType = {
  theme: "system",
  currentTheme: "light",
  setTheme: () => {},
};

const ThemeContext = createContext(defaultThemeContext);

type ThemeProviderProps = { children: JSX.Element | JSX.Element[] };

export const ThemeProvider = ({
  children,
}: ThemeProviderProps): JSX.Element => {
  // Initialize theme from localStorage or default to "system"
  const [theme, setThemeState] = useState(() => {
    const savedTheme = localStorage.getItem(
      LOCAL_STORAGE_KEYS.THEME
    ) as ThemeType;
    return savedTheme &&
      [THEME_OPTIONS.LIGHT, THEME_OPTIONS.DARK, THEME_OPTIONS.SYSTEM].includes(
        savedTheme as any
      )
      ? savedTheme
      : THEME_OPTIONS.SYSTEM;
  });

  const [currentTheme, setCurrentTheme] = useState(THEME_OPTIONS.LIGHT);

  // Function to set theme and save to localStorage
  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem(LOCAL_STORAGE_KEYS.THEME, newTheme);
  };

  // Effect to apply the correct theme based on selection or system preference
  useEffect(() => {
    const applyTheme = (themeName: "light" | "dark") => {
      setCurrentTheme(themeName);

      if (themeName === THEME_OPTIONS.DARK) {
        document.body.classList.add("dark-mode");
      } else {
        document.body.classList.remove("dark-mode");
      }
    };

    // Check for system preference
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    // Apply theme based on selection or system preference
    if (theme === THEME_OPTIONS.SYSTEM) {
      applyTheme(prefersDark ? THEME_OPTIONS.DARK : THEME_OPTIONS.LIGHT);
    } else {
      applyTheme(theme as "light" | "dark");
    }

    // Listen for system preference changes if in auto mode
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (theme === THEME_OPTIONS.SYSTEM) {
        applyTheme(e.matches ? THEME_OPTIONS.DARK : THEME_OPTIONS.LIGHT);
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () =>
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
