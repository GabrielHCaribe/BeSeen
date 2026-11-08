import { useColorScheme } from "react-native";

const light = {
  background: "#F6F5F2",
  surface: "#FFFFFF",
  text: "#17161C",
  muted: "#6F6B78",
  border: "#E8E5E0",
  accent: "#4F46E5",
  accentText: "#FFFFFF",
  subtle: "#EEEDFE",
  danger: "#DC2626",
  dangerSoft: "#FDECEC",
  warning: "#EA580C", // the no-partner prompt: loud on purpose
  warningText: "#FFFFFF",
  warningSoft: "#FFF1E7",
  success: "#15803D",
  successSoft: "#E6F6EC",
  // The streak card on the main screen.
  hero: "#4F46E5",
  heroText: "#FFFFFF",
  heroMuted: "#C9C6FB",
  heroTrack: "#6D66EC",
  shadow: "#1B1636",
};

const dark: typeof light = {
  background: "#0E0D12",
  surface: "#19181F",
  text: "#F4F3F7",
  muted: "#9D99A8",
  border: "#2A2833",
  accent: "#8E8CF9",
  accentText: "#0E0D12",
  subtle: "#232249",
  danger: "#F87171",
  dangerSoft: "#3A1C1C",
  warning: "#F97316",
  warningText: "#FFFFFF",
  warningSoft: "#3A2516",
  success: "#4ADE80",
  successSoft: "#15301F",
  hero: "#2C2A73",
  heroText: "#FFFFFF",
  heroMuted: "#B3B0F2",
  heroTrack: "#403D92",
  shadow: "#000000",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
