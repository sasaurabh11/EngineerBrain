const WARMUP_URLS = [
  "https://engineerbrain-ai-service.onrender.com",
  "https://engineerbrain.onrender.com",
  "https://engineerbrain-mcp-server.onrender.com",
];

export function warmupServices(): void {
  for (const url of WARMUP_URLS) {
    fetch(url, { mode: "no-cors", cache: "no-store" }).catch(() => {
    });
  }
}
