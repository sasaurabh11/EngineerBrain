import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDeclareIncident } from "@/hooks/useProduction";
import { useServices } from "@/hooks/useProduction";
import type { IncidentSeverity } from "@/types/production.types";

const SEVERITIES: IncidentSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function DeclareIncidentDialog({ orgSlug, open, onOpenChange }: { orgSlug: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: services } = useServices(orgSlug);
  const declareIncident = useDeclareIncident(orgSlug);

  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>("HIGH");
  const [serviceId, setServiceId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await declareIncident.mutateAsync({ title, severity, serviceId: serviceId || undefined });
      setTitle("");
      setSeverity("HIGH");
      setServiceId("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to declare incident");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Declare an incident</DialogTitle>
          <DialogDescription>
            This immediately runs the real correlation, root-cause, and recommendation pipeline against it - not a placeholder.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="incident-title">
              Title
            </label>
            <Input id="incident-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Checkout returning 500s" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Severity</label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as IncidentSeverity)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Service (optional)</label>
              <Select value={serviceId || "none"} onValueChange={(v) => setServiceId(v === "none" ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {services?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={declareIncident.isPending || !title.trim()}>
              {declareIncident.isPending && <Loader2 className="animate-spin" />}
              Declare incident
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
