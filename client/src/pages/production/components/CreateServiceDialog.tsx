import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateService } from "@/hooks/useProduction";
import { useRepositories } from "@/hooks/useRepositories";
import type { ServiceCriticality } from "@/types/production.types";

const CRITICALITIES: ServiceCriticality[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function CreateServiceDialog({ orgSlug, open, onOpenChange }: { orgSlug: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: repositories } = useRepositories(orgSlug, {});
  const createService = useCreateService(orgSlug);

  const [name, setName] = useState("");
  const [repositoryId, setRepositoryId] = useState("");
  const [criticality, setCriticality] = useState<ServiceCriticality>("MEDIUM");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createService.mutateAsync({ name, repositoryId: repositoryId || undefined, criticality });
      setName("");
      setRepositoryId("");
      setCriticality("MEDIUM");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create service");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register a service</DialogTitle>
          <DialogDescription>
            Alerts labeled with this exact name will be matched to it, and deployments will be tracked against its linked repository.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="service-name">
              Name
            </label>
            <Input id="service-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. checkout-api" />
            <p className="text-xs text-muted-foreground">Must match the `service` label your alerting rules send.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Repository (optional)</label>
              <Select value={repositoryId || "none"} onValueChange={(v) => setRepositoryId(v === "none" ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {repositories?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Criticality</label>
              <Select value={criticality} onValueChange={(v) => setCriticality(v as ServiceCriticality)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRITICALITIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={createService.isPending || !name.trim()}>
              {createService.isPending && <Loader2 className="animate-spin" />}
              Register service
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
