import { SignIn } from "@clerk/clerk-react";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { useTheme } from "@/lib/theme";

export function SignInPage() {
  const { theme } = useTheme();
  return (
    <SignIn
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/organizations"
      appearance={clerkAppearance(theme)}
    />
  );
}
