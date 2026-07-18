const PALETTE = {
  light: {
    colorPrimary: "#17a396",
    colorBackground: "#ffffff",
    colorForeground: "#12181a",
    colorMutedForeground: "#5c6669",
    colorInputBackground: "#ffffff",
    colorInputForeground: "#12181a",
    colorNeutral: "#12181a",
    colorDanger: "#e8544b",
    colorShadow: "rgba(18, 24, 26, 0.06)",
  },
  dark: {
    colorPrimary: "#2ec4b6",
    colorBackground: "#171e1f",
    colorForeground: "#eef2f2",
    colorMutedForeground: "#99a3a5",
    colorInputBackground: "#0d1213",
    colorInputForeground: "#eef2f2",
    colorNeutral: "#eef2f2",
    colorDanger: "#ef6a61",
    colorShadow: "rgba(0, 0, 0, 0.35)",
  },
} as const;

/** Themes Clerk's hosted auth widgets to match the app's own palette and
 * type system, since their internal markup can't be restyled with Tailwind. */
export function clerkAppearance(mode: "dark" | "light") {
  const p = PALETTE[mode];
  return {
    variables: {
      colorPrimary: p.colorPrimary,
      colorBackground: p.colorBackground,
      colorForeground: p.colorForeground,
      colorMutedForeground: p.colorMutedForeground,
      colorInputBackground: p.colorInputBackground,
      colorInputForeground: p.colorInputForeground,
      colorNeutral: p.colorNeutral,
      colorDanger: p.colorDanger,
      colorShadow: p.colorShadow,
      fontFamily: '"Geist Variable", sans-serif',
      fontFamilyButtons: '"Geist Variable", sans-serif',
      borderRadius: "0.5rem",
    },
    elements: {
      rootBox: "w-full",
      cardBox: "w-full shadow-none border rounded-xl",
      card: "shadow-none gap-4 p-6",
      header: "hidden",
      footer: "px-6 pb-6",
      dividerLine: "bg-border",
      formButtonPrimary: "text-sm font-medium normal-case shadow-none",
      socialButtonsBlockButton: "border rounded-md",
      formFieldInput: "rounded-md",
      footerActionLink: "font-medium",
    },
  };
}
