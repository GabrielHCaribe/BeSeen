import { useColorScheme } from "react-native";

// 16-bit look: a small fixed palette, chunky outlines, square corners and hard drop shadows.
// Day mode is ink on parchment; night mode is the classic blue RPG menu window with white borders.

// Loaded in src/app/_layout.tsx. Never pair these with fontWeight: Android drops a custom font
// that has no matching bold face.
export const fonts = {
  // Headings, numbers, buttons. Wide, so keep it small.
  pixel: "PressStart2P_400Regular",
  // Everything people read. Narrow, so keep it large.
  text: "VT323_400Regular",
};

// Outline, shadow offset and frame sizes, in points. Even numbers keep edges on the pixel grid.
export const px = {
  border: 3,
  thin: 2,
  shadow: 4,
};

const light = {
  background: "#F4ECD8",
  surface: "#FFFAEE",
  text: "#1A1C2C",
  muted: "#5D5768",
  border: "#1A1C2C",
  accent: "#3B5DC9",
  accentText: "#FFFFFF",
  subtle: "#C9D6FF",
  danger: "#B13E53",
  dangerSoft: "#F7CCD2",
  warning: "#E0603A", // the no-partner prompt: loud on purpose
  warningText: "#FFFFFF",
  warningSoft: "#FFDCC4",
  success: "#2A9D55",
  successSoft: "#CDF2D6",
  gold: "#F2B23E",
  // The streak card on the main screen.
  hero: "#3B5DC9",
  heroText: "#FFFFFF",
  heroMuted: "#D6E0FF",
  heroTrack: "#1A1C2C",
  heroFrame: "#FFFFFF",
  shadow: "#1A1C2C",
};

const dark: typeof light = {
  background: "#10121C",
  surface: "#29366F",
  text: "#F4F4F4",
  muted: "#A9BCD6",
  border: "#F4F4F4",
  accent: "#FFCD75",
  accentText: "#1A1C2C",
  subtle: "#3B4A8A",
  danger: "#FF7A88",
  dangerSoft: "#5A2236",
  warning: "#FF9A5C",
  warningText: "#1A1C2C",
  warningSoft: "#5A3424",
  success: "#A7F070",
  successSoft: "#244F3A",
  gold: "#FFCD75",
  hero: "#3B5DC9",
  heroText: "#FFFFFF",
  heroMuted: "#D6E0FF",
  heroTrack: "#10121C",
  heroFrame: "#FFCD75",
  shadow: "#000000",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

// Hard, unblurred drop shadow down and to the right, like a sprite's.
export function hardShadow(color: string, offset: number = px.shadow) {
  return { boxShadow: `${offset}px ${offset}px 0px 0px ${color}` };
}
