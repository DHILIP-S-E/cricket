import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Franchise =
  | "IPL_GOLD"
  | "CSK"
  | "MI"
  | "RCB"
  | "KKR"
  | "RR"
  | "SRH"
  | "GT"
  | "LSG"
  | "DC"
  | "PBKS";

export type ColorMode = "dark" | "light";

export interface TeamConfig {
  short: Franchise;
  name: string;
  primaryColor: { light: string; dark: string };
  secondaryColor: { light: string; dark: string };
}

export const FRANCHISE_CONFIGS: Record<Franchise, TeamConfig> = {
  IPL_GOLD: {
    short: "IPL_GOLD",
    name: "IPL Default",
    primaryColor: { light: "#ab8300", dark: "#e2b400" },
    secondaryColor: { light: "#003b7d", dark: "#005ea6" },
  },
  CSK: {
    short: "CSK",
    name: "Chennai Super Kings",
    primaryColor: { light: "#b88e00", dark: "#f9cd05" },
    secondaryColor: { light: "#0062b8", dark: "#0081e9" },
  },
  MI: {
    short: "MI",
    name: "Mumbai Indians",
    primaryColor: { light: "#004ba0", dark: "#0066d4" },
    secondaryColor: { light: "#b58a00", dark: "#d1ab3e" },
  },
  RCB: {
    short: "RCB",
    name: "Royal Challengers Bengaluru",
    primaryColor: { light: "#b80000", dark: "#ff3333" },
    secondaryColor: { light: "#8c7000", dark: "#d1ab3e" },
  },
  KKR: {
    short: "KKR",
    name: "Kolkata Knight Riders",
    primaryColor: { light: "#3b1f8c", dark: "#7d50ff" },
    secondaryColor: { light: "#b89500", dark: "#f1c40f" },
  },
  RR: {
    short: "RR",
    name: "Rajasthan Royals",
    primaryColor: { light: "#d6006b", dark: "#ff3399" },
    secondaryColor: { light: "#004ba0", dark: "#0081e9" },
  },
  SRH: {
    short: "SRH",
    name: "Sunrisers Hyderabad",
    primaryColor: { light: "#cc5200", dark: "#ff8225" },
    secondaryColor: { light: "#2b2b2b", dark: "#a0a0a0" },
  },
  GT: {
    short: "GT",
    name: "Gujarat Titans",
    primaryColor: { light: "#111529", dark: "#384585" },
    secondaryColor: { light: "#b58a00", dark: "#e2b400" },
  },
  LSG: {
    short: "LSG",
    name: "Lucknow Super Giants",
    primaryColor: { light: "#2a7ab8", dark: "#4fa3e3" },
    secondaryColor: { light: "#289945", dark: "#34c759" },
  },
  DC: {
    short: "DC",
    name: "Delhi Capitals",
    primaryColor: { light: "#004e8a", dark: "#007fff" },
    secondaryColor: { light: "#c92a2a", dark: "#ff4d4d" },
  },
  PBKS: {
    short: "PBKS",
    name: "Punjab Kings",
    primaryColor: { light: "#b50e14", dark: "#ff333d" },
    secondaryColor: { light: "#7a7a7a", dark: "#cccccc" },
  },
};

interface ThemeContextValue {
  franchise: Franchise;
  colorMode: ColorMode;
  setFranchise: (f: Franchise) => void;
  toggleColorMode: () => void;
  getThemeColors: () => { primary: string; secondary: string };
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [franchise, setFranchiseState] = useState<Franchise>(() => {
    const saved = localStorage.getItem("ipl-franchise-theme");
    return (saved as Franchise) || "IPL_GOLD";
  });

  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    const saved = localStorage.getItem("ipl-theme-mode");
    return (saved as ColorMode) || "dark";
  });

  const setFranchise = (f: Franchise) => {
    setFranchiseState(f);
    localStorage.setItem("ipl-franchise-theme", f);
  };

  const toggleColorMode = () => {
    setColorModeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("ipl-theme-mode", next);
      return next;
    });
  };

  // Sync classes to HTML element
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove existing themes
    Object.keys(FRANCHISE_CONFIGS).forEach((k) => {
      root.classList.remove(`theme-${k.toLowerCase()}`);
    });
    root.classList.remove("dark", "light");

    // Add active values
    root.classList.add(`theme-${franchise.toLowerCase()}`);
    root.classList.add(colorMode);
  }, [franchise, colorMode]);

  const getThemeColors = () => {
    const cfg = FRANCHISE_CONFIGS[franchise];
    return {
      primary: colorMode === "dark" ? cfg.primaryColor.dark : cfg.primaryColor.light,
      secondary: colorMode === "dark" ? cfg.secondaryColor.dark : cfg.secondaryColor.light,
    };
  };

  return (
    <ThemeContext.Provider
      value={{
        franchise,
        colorMode,
        setFranchise,
        toggleColorMode,
        getThemeColors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
