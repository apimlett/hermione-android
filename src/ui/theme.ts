// Design tokens: Hermione DS v0.2, "Swiss Civic / Coral Parchment" (../Hermione-DS-v0.2/tokens).
// Warm parchment canvas, charcoal ink, coral for titles, active states, primary actions and key
// metrics. Flat surfaces, 1px rules, square-ish 4dp corners. Coral is never a status colour: run
// states keep their own colours and always come with a word.
//
// Contrast (WCAG 2.x, on canvas #F4F0E6): coral #FF4438 is 3.0:1, so it is used only for large text
// (display titles, metrics, 18dp+ bold button labels) and fills. Small coral text uses `coralText`
// (5.0:1). Status dots use the DS status colours; status *text* uses the darker `*Text` variants.
import { Platform } from "react-native";

const light = {
  // DS colour tokens
  canvas: "#F4F0E6", surface: "#FBF8F0", surfaceAlt: "#EAE5DB",
  ink: "#181818", inkMuted: "#66645F",
  coral: "#FF4438", coralPressed: "#DE332A", onCoral: "#FFFFFF", coralText: "#C42B21",
  rule: "#C9C5BA", ruleStrong: "#8E8B83", focus: "#2455A4",
  ready: "#32986B", running: "#E4B600", waiting: "#D48427", failed: "#C93F40", offline: "#6C7C8B",
  readyText: "#1F7A52", runningText: "#7A6200", waitingText: "#9A5A12", failedText: "#A8302F", offlineText: "#536170",
  // App roles, mapped onto the DS tokens (screens use these names)
  floating: "#FBF8F0", control: "#EAE5DB", controlActive: "#DED8CB",
  border: "#C9C5BA", borderStrong: "#8E8B83", text: "#181818", textSecondary: "#3B3A37", muted: "#66645F", dim: "#66645F",
  accentText: "#C42B21", action: "#FF4438", actionForeground: "#FFFFFF", star: "#D48427",
  danger: "#A8302F", success: "#1F7A52", warning: "#9A5A12",
  userBubble: "#EAE5DB", botBubble: "#FBF8F0", approvalSurface: "#FBF3E4", approvalDetail: "#FBF8F0", approvalIcon: "rgba(212,132,39,0.16)", scrim: "rgba(24,24,24,0.45)",
};

// The DS is a light direction. Dark keeps the same civic system on charcoal for people who ask for it.
const dark: typeof light = {
  canvas: "#141413", surface: "#1D1C1A", surfaceAlt: "#262522",
  ink: "#F4F0E6", inkMuted: "#A9A59B",
  coral: "#FF5A4F", coralPressed: "#E8483D", onCoral: "#FFFFFF", coralText: "#FF6B5F",
  rule: "#3A3833", ruleStrong: "#5E5B54", focus: "#7FA6E8",
  ready: "#4CC38A", running: "#E4B600", waiting: "#F0A04B", failed: "#F07070", offline: "#93A3B2",
  readyText: "#4CC38A", runningText: "#E4B600", waitingText: "#F0A04B", failedText: "#F07070", offlineText: "#93A3B2",
  floating: "#1D1C1A", control: "#262522", controlActive: "#302E2A",
  border: "#3A3833", borderStrong: "#5E5B54", text: "#F4F0E6", textSecondary: "#D2CEC4", muted: "#A9A59B", dim: "#A9A59B",
  accentText: "#FF6B5F", action: "#FF4438", actionForeground: "#FFFFFF", star: "#F0A04B",
  danger: "#F07070", success: "#4CC38A", warning: "#F0A04B",
  userBubble: "#262522", botBubble: "#1D1C1A", approvalSurface: "#231E16", approvalDetail: "#141413", approvalIcon: "rgba(240,160,75,0.16)", scrim: "rgba(0,0,0,0.62)",
};

export const colors = { ...light };
export function setTheme(mode: "light" | "dark") {
  Object.assign(colors, mode === "light" ? light : dark);
  for (const style of Object.values(type)) (style as { color: string }).color = colors.text;
  type.label.color = colors.muted;
  type.bodySm.color = colors.textSecondary;
  type.caption.color = colors.dim;
  type.eyebrow.color = colors.muted;
  type.civic.color = colors.coral;
  type.hero.color = colors.coral;
  type.metric.color = colors.coral;
}

/** Square-ish, flat. Only the bot avatars stay soft; pills are reserved for dots and switches. */
export const radii = { bubble: 6, pill: 4, card: 4, inset: 4, chip: 4, avatar: 12, round: 999 } as const;

/** n steps of the 4-point grid. */
export const space = (n: number) => n * 4;

/** Minimum touch target (DS layout.touchTarget). */
export const hit = 48;

/** DS layout tokens. */
export const layout = { gutter: 20, bottomNav: 64, rule: 1 } as const;

/** Minimal elevation: rules do the separating. Only sheets and toasts float. */
export const elevation = {
  raised: { elevation: 0, shadowOpacity: 0 },
  floating: { elevation: 6, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
};

/** Durations for the few UI motions: short and calm, never bouncy. */
export const motion = { fast: 140, base: 200, slow: 260 } as const;

// Roboto Condensed / Roboto / Roboto Mono, from the platform (no font binaries are bundled).
// Android's system families carry the weight in the name; the web preview falls back to CSS stacks.
export const font = Platform.OS === "android" ? {
  regular: "sans-serif",
  medium: "sans-serif-medium",
  semibold: "sans-serif-medium",
  display: "sans-serif-condensed",
  mono: "monospace",
} : {
  regular: "Roboto, Arial, sans-serif",
  medium: "Roboto, Arial, sans-serif",
  semibold: "Roboto, Arial, sans-serif",
  display: "'Roboto Condensed', 'Arial Narrow', sans-serif-condensed, sans-serif",
  mono: "'Roboto Mono', monospace",
};

/** Medium weight for the web preview only; on Android the weight is in the family name. */
export const medium = Platform.OS === "android" ? {} : { fontWeight: "500" as const };

export const type = {
  /** Masthead: oversized condensed coral (HERMIONE). */
  hero: { fontFamily: font.display, fontWeight: "700" as const, fontSize: 48, lineHeight: 48, letterSpacing: -0.5, textTransform: "uppercase" as const, color: colors.coral },
  /** Screen titles: condensed coral, uppercase. */
  civic: { fontFamily: font.display, fontWeight: "700" as const, fontSize: 32, lineHeight: 34, letterSpacing: -0.2, textTransform: "uppercase" as const, color: colors.coral },
  /** Huge metric numbers. */
  metric: { fontFamily: font.display, fontWeight: "700" as const, fontSize: 56, lineHeight: 58, color: colors.coral },
  /** Mono uppercase technical label with generous tracking. */
  eyebrow: { fontFamily: font.mono, fontSize: 11, lineHeight: 15, letterSpacing: 1.6, textTransform: "uppercase" as const, color: colors.muted },
  display: { fontFamily: font.display, fontWeight: "700" as const, fontSize: 26, lineHeight: 30, color: colors.text },
  h: { fontFamily: font.display, fontWeight: "700" as const, fontSize: 22, lineHeight: 26, color: colors.text },
  title: { fontFamily: font.semibold, ...medium, fontSize: 17, lineHeight: 23, color: colors.text },
  chat: { fontFamily: font.regular, fontSize: 16, lineHeight: 24, color: colors.text },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 21, color: colors.text },
  bodySm: { fontFamily: font.regular, fontSize: 14, lineHeight: 19, color: colors.textSecondary },
  label: { fontFamily: font.medium, fontSize: 12.5, lineHeight: 17, color: colors.muted },
  caption: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: colors.dim },
};
