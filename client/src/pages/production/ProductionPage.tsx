import { useState } from "react";
import { useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrganization } from "../../hooks/useOrganizations";
import { DeploymentsTab } from "./components/DeploymentsTab";
import { IncidentsTab } from "./components/IncidentsTab";
import { IntegrationsTab } from "./components/IntegrationsTab";
import { OverviewTab } from "./components/OverviewTab";
import { ServicesTab } from "./components/ServicesTab";

const TABS = ["overview", "incidents", "services", "deployments", "integrations"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  incidents: "Incidents",
  services: "Services",
  deployments: "Deployments",
  integrations: "Integrations",
};

export function ProductionPage() {
  const { orgSlug = "" } = useParams();
  const { data: organization } = useOrganization(orgSlug);
  const [tab, setTab] = useState<Tab>("overview");

  const canManage = organization?.role === "OWNER" || organization?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Production Intelligence</h1>
        <p className="text-sm text-muted-foreground">Incidents, root cause analysis, deployments, and service health - grounded in your connected systems.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList variant="line" className="w-full justify-start gap-5 overflow-x-auto border-b border-border p-0">
          {TABS.map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="rounded-none border-0 px-0.5 pb-2.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase after:bg-primary data-active:bg-transparent data-active:text-foreground"
            >
              {TAB_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <OverviewTab orgSlug={orgSlug} />
        </TabsContent>
        <TabsContent value="incidents" className="pt-4">
          <IncidentsTab orgSlug={orgSlug} />
        </TabsContent>
        <TabsContent value="services" className="pt-4">
          <ServicesTab orgSlug={orgSlug} />
        </TabsContent>
        <TabsContent value="deployments" className="pt-4">
          <DeploymentsTab orgSlug={orgSlug} />
        </TabsContent>
        <TabsContent value="integrations" className="pt-4">
          <IntegrationsTab orgSlug={orgSlug} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
