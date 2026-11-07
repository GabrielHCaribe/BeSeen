import { useColorScheme } from "react-native";

const light = {
  background: "#F5F5F4",
  surface: "#FFFFFF",
  text: "#1C1917",
  muted: "#78716C",
  border: "#E7E5E4",
  accent: "#455CDB",
  accentText: "#FFFFFF",
  danger: "#B91C1C",
  warning: "#C2410C", // the no-partner banner: loud on purpose
  warningText: "#FFFFFF",
  success: "#15803D",
  subtle: "#EEF0FB",
};

const dark: typeof light = {
  background: "#0C0A09",
  surface: "#1C1917",
  text: "#FAFAF9",
  muted: "#A8A29E",
  border: "#292524",
  accent: "#8B9CF7",
  accentText: "#0C0A09",
  danger: "#F87171",
  warning: "#C2410C",
  warningText: "#FFFFFF",
  success: "#4ADE80",
  subtle: "#1E2140",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
