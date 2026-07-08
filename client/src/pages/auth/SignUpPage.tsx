import { SignUp } from "@clerk/clerk-react";

export function SignUpPage() {
  return <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/organizations" />;
}
