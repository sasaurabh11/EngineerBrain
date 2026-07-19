import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const AI_PROVIDER_ERROR_CODES = new Set(["rate_limited", "not_configured", "auth_error", "provider_error"]);

export function isAiProviderErrorCode(code: string | null | undefined): boolean {
  return Boolean(code && AI_PROVIDER_ERROR_CODES.has(code));
}

/** Renders nothing unless `code` is one of the known AI-provider error codes. */
export function GoToProfileAction({ code }: { code?: string | null }) {
  if (!isAiProviderErrorCode(code)) return null;
  return (
    <Button asChild type="button" variant="outline" size="sm">
      <Link to="/profile">Go to profile settings</Link>
    </Button>
  );
}
