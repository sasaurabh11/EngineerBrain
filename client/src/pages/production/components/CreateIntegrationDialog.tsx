import { Check, Copy, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateIntegration } from "@/hooks/useProduction";
import type { Integration, ProductionProvider } from "@/types/production.types";

function webhookUrlFor(integrationId: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string).replace(/\/$/, "");
  return `${base}/webhooks/production/alertmanager/${integrationId}`;
}

function CreatedIntegrationPanel({ integration, credential, onDone }: { integration: Integration; credential: string | undefined; onDone: () => void }) {
  const [copied, setCopied] = useState<"url" | "token" | null>(null);

  async function copy(value: string, which: "url" | "token") {
    await navigator.clipboard.writeText(value);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }

  if (integration.provider !== "PROMETHEUS") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          "{integration.name}" is connected. GitHub Actions deployments are synced automatically every 10 minutes via your existing GitHub App
          installation - no further setup needed.
        </p>
        <DialogFooter>
          <Button type="button" onClick={onDone}>
            Done
          </Button>
        </DialogFooter>
      </div>
    );
  }

  const url = webhookUrlFor(integration.id);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Point your Alertmanager <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">webhook_config</code> at this URL{credential ? ", with the bearer token below as its " : ""}
        {credential && <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">bearer_token</code>}. Alerts must carry a{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">service</code> label matching a registered service name exactly.
      </p>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Webhook URL</label>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted p-2.5">
          <code className="flex-1 truncate font-mono text-xs text-foreground">{url}</code>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => copy(url, "url")} aria-label="Copy webhook URL">
            {copied === "url" ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
      </div>
      {credential && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Bearer token (shown once - store it now)</label>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted p-2.5">
            <code className="flex-1 truncate font-mono text-xs text-foreground">{credential}</code>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => copy(credential, "token")} aria-label="Copy bearer token">
              {copied === "token" ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
        </div>
      )}
      <DialogFooter>
        <Button type="button" onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    </div>
  );
}

export function CreateIntegrationDialog({ orgSlug, open, onOpenChange }: { orgSlug: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const createIntegration = useCreateIntegration(orgSlug);

  const [provider, setProvider] = useState<ProductionProvider>("PROMETHEUS");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [errorRateQuery, setErrorRateQuery] = useState("");
  const [p95LatencyQuery, setP95LatencyQuery] = useState("");
  const [credential, setCredential] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Integration | null>(null);

  function reset() {
    setProvider("PROMETHEUS");
    setName("");
    setBaseUrl("");
    setErrorRateQuery("");
    setP95LatencyQuery("");
    setCredential("");
    setError(null);
    setCreated(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const config =
        provider === "PROMETHEUS"
          ? {
              baseUrl,
              ...(errorRateQuery ? { errorRateQuery } : {}),
              ...(p95LatencyQuery ? { p95LatencyQuery } : {}),
            }
          : {};
      const integration = await createIntegration.mutateAsync({ provider, name, config, credential: credential || undefined });
      setCreated(integration);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create integration");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect a production integration</DialogTitle>
          <DialogDescription>
            {created ? "Connected." : "Prometheus for metrics/alerts, or GitHub Actions for deployment history."}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <CreatedIntegrationPanel
            integration={created}
            credential={credential || undefined}
            onDone={() => {
              reset();
              onOpenChange(false);
            }}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Provider</label>
                <Select value={provider} onValueChange={(v) => setProvider(v as ProductionProvider)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROMETHEUS">Prometheus</SelectItem>
                    <SelectItem value="GITHUB_ACTIONS">GitHub Actions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="integration-name">
                  Name
                </label>
                <Input id="integration-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production Prometheus" />
              </div>
            </div>

            {provider === "PROMETHEUS" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="prom-url">
                    Prometheus base URL
                  </label>
                  <Input id="prom-url" required value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://prometheus.internal:9090" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="prom-error-query">
                      Error rate PromQL (optional)
                    </label>
                    <Input id="prom-error-query" value={errorRateQuery} onChange={(e) => setErrorRateQuery(e.target.value)} placeholder="sum(rate(http_requests_total{status=~&quot;5..&quot;}[5m]))" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="prom-latency-query">
                      P95 latency PromQL (optional)
                    </label>
                    <Input id="prom-latency-query" value={p95LatencyQuery} onChange={(e) => setP95LatencyQuery(e.target.value)} placeholder="histogram_quantile(0.95, ...)" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="prom-credential">
                    Shared secret (optional)
                  </label>
                  <Input
                    id="prom-credential"
                    type="password"
                    value={credential}
                    onChange={(e) => setCredential(e.target.value)}
                    placeholder="Used as a Prometheus bearer token, and as the Alertmanager webhook's shared secret"
                  />
                </div>
              </>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={createIntegration.isPending || !name.trim() || (provider === "PROMETHEUS" && !baseUrl.trim())}>
                {createIntegration.isPending && <Loader2 className="animate-spin" />}
                Connect
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
