// src/context/ThemeContext.tsx
import React from "react";
import { LOCAL_STORAGE_KEYS, THEME_OPTIONS, ThemeValue } from "../constants";

type ThemeType = ThemeValue;
type AppliedTheme = "light" | "dark"; // Explicit type for applied theme

interface ThemeContextType {
  theme: ThemeType;
  currentTheme: AppliedTheme; // Use the explicit type
  setTheme: (theme: ThemeType) => void;
}

// Create context with proper typing
const defaultThemeContext: ThemeContextType = {
  theme: "system",
  currentTheme: "light",
  setTheme: () => {},
};

const ThemeContext = React.createContext(defaultThemeContext);

type ThemeProviderProps = { children: React.ReactNode }; // Use React.ReactNode for children

export const ThemeProvider = ({
  children,
}: ThemeProviderProps): JSX.Element => {
  const [theme, setThemeState] = React.useState<ThemeType>(() => {
    // Explicit type for theme state
    const savedTheme = localStorage.getItem(
      LOCAL_STORAGE_KEYS.THEME
    ) as ThemeType | null; // Allow null initially
    return savedTheme &&
      Object.values(THEME_OPTIONS).includes(savedTheme as any) // Check against values
      ? savedTheme
      : THEME_OPTIONS.SYSTEM;
  });

  // Explicitly define the type for currentTheme state
  const [currentTheme, setCurrentTheme] = React.useState<AppliedTheme>(
    THEME_OPTIONS.LIGHT
  );

  // Function to set theme and save to localStorage
  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem(LOCAL_STORAGE_KEYS.THEME, newTheme);
  };

  // Effect to apply the correct theme
  React.useEffect(() => {
    // Function now expects AppliedTheme type
    const applyTheme = (themeName: AppliedTheme) => {
      setCurrentTheme(themeName); // This should now work

      if (themeName === THEME_OPTIONS.DARK) {
        document.body.classList.add("dark-mode");
      } else {
        document.body.classList.remove("dark-mode");
      }
    };

    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    if (theme === THEME_OPTIONS.SYSTEM) {
      applyTheme(prefersDark ? THEME_OPTIONS.DARK : THEME_OPTIONS.LIGHT);
    } else {
      // Theme is 'light' or 'dark', which matches AppliedTheme
      applyTheme(theme as AppliedTheme);
    }

    // Listener for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (theme === THEME_OPTIONS.SYSTEM) {
        applyTheme(e.matches ? THEME_OPTIONS.DARK : THEME_OPTIONS.LIGHT);
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () =>
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [theme]); // Dependency remains theme

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Export the context for the custom hook
export { ThemeContext };
