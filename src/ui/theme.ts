// One look, always dark: near-black space, hairline edges, white type and a single ice-blue accent.
// Colour is reserved for meaning (accent = action, green = kept, red = slipped, amber = needs you).
const space = {
  background: "#05060A",
  surface: "#0B0D13",
  text: "#ECEEF3",
  muted: "#7D8496",
  border: "#1A1D27",
  borderStrong: "#343A4A",
  raised: "#1E222D", // the selected segment of a segmented control
  accent: "#9AD8FF",
  accentText: "#05060A",
  subtle: "#0F1A24",
  danger: "#FF7A7A",
  dangerSoft: "#1A0C0F",
  warning: "#FFB86B", // the no-partner prompt: loud on purpose
  warningText: "#05060A",
  warningSoft: "#1C1409",
  success: "#7CF2C0",
  successSoft: "#0A1A14",
  // Primary buttons and selected chips: white on black.
  primary: "#ECEEF3",
  primaryText: "#05060A",
  // The streak card on the main screen.
  hero: "#080A10",
  heroText: "#FFFFFF",
  heroMuted: "#8A92A6",
  heroTrack: "#1C2030",
  shadow: "#000000",
};

export type Theme = typeof space;

export function useTheme(): Theme {
  return space;
}
