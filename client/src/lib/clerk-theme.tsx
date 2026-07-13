import { ClerkProvider } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import type { ReactNode } from "react";
import { useTheme } from "./theme";

const CLERK_VARIABLES = {
  colorPrimary: "#2ec4b6",
  colorTextOnPrimaryBackground: "#04201d",
  borderRadius: "0.5rem",
  fontFamily: "'Geist Variable', sans-serif",
};

export function ClerkThemedProvider({ publishableKey, children }: { publishableKey: string; children: ReactNode }) {
  const { theme } = useTheme();

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl="/sign-in"
      appearance={{
        baseTheme: theme === "dark" ? dark : undefined,
        variables: CLERK_VARIABLES,
      }}
    >
      {children}
    </ClerkProvider>
  );
}
