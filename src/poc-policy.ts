export type PocConnection = { baseUrl: string; bridgeUrl?: string };

/** POC boundary: private tailnet HTTPS only. Serve vs Funnel must also be checked on the server. */
export function validatePocConnection(config: PocConnection): string | null {
  let server: URL;
  try { server = new URL(config.baseUrl); } catch { return "Enter a valid HTTPS Tailscale server URL."; }
  if (server.protocol !== "https:") return "Use HTTPS; credentials must never travel over plaintext HTTP.";
  if (server.username || server.password) return "Do not put credentials in the URL.";
  if (server.search || server.hash) return "Remove query strings and fragments from the server URL.";
  if (!server.hostname.endsWith(".ts.net")) return "This POC connects only to a Tailscale HTTPS hostname (.ts.net).";
  if (config.bridgeUrl?.trim()) {
    let bridge: URL;
    try { bridge = new URL(config.bridgeUrl); } catch { return "Enter a valid HTTPS bridge URL."; }
    if (bridge.protocol !== "https:") return "The bridge must use HTTPS too.";
    if (bridge.username || bridge.password) return "Do not put bridge credentials in the URL.";
    if (bridge.search || bridge.hash) return "Remove query strings and fragments from the bridge URL.";
    if (bridge.hostname !== server.hostname) return "The bridge must run on the same host as your selected Hermes server.";
  }
  return null;
}
