import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

function shortLabel(path: string): string {
  const segments = path.split("/");
  return segments.length > 2 ? `.../${segments.slice(-2).join("/")}` : path;
}

export function DependencyCycleGraph({ cycle }: { cycle: string[] }) {
  const uniqueFiles = Array.from(new Set(cycle));
  const radius = 110;
  const center = 140;

  const nodes: Node[] = uniqueFiles.map((path, i) => {
    const angle = (2 * Math.PI * i) / uniqueFiles.length;
    return {
      id: path,
      position: { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) },
      data: { label: shortLabel(path) },
      style: { fontSize: 11, width: 160 },
    };
  });

  const edges: Edge[] = cycle.slice(0, -1).map((source, i) => ({
    id: `${source}-${cycle[i + 1]}-${i}`,
    source,
    target: cycle[i + 1],
    animated: true,
  }));

  return (
    <div style={{ height: 280 }} className="overflow-hidden rounded-lg border border-border bg-muted/40">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ style: { stroke: "var(--destructive)" } }}
      >
        <Background color="var(--border)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
