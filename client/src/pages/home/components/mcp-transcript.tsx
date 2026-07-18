/** Real tool names and a real install command - this isn't illustrative
 * the way the ledger/specimens above are, it's what actually happens if you
 * run it (see mcp-server/README.md). */
export function McpTranscript() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">Claude Code</div>
      <div className="space-y-2.5 px-4 py-3.5 font-mono text-[13px]">
        <p className="text-muted-foreground">$ npx -y @engineerbrain/mcp-server</p>
        <p className="text-foreground">&gt; review pull request #42</p>
        <p className="pl-4 text-muted-foreground">↳ pr_diff, ci_status, pr_dependency_impact, run_engineering_workflow</p>
        <p className="pl-4 text-success">↳ Verdict: safe to merge — one suggestion in the retry logic</p>
      </div>
    </div>
  );
}
