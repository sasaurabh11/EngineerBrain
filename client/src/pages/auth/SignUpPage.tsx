import { SignUp } from "@clerk/clerk-react";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { useTheme } from "@/lib/theme";

export function SignUpPage() {
  const { theme } = useTheme();
  return (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
      fallbackRedirectUrl="/organizations"
      appearance={clerkAppearance(theme)}
    />
  );
}
