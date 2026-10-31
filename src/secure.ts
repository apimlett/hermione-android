// Native credentials stay in SecureStore. Web is a demo-only preview, not a live client.
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const web = Platform.OS === "web";
export const liveConnectionError = web
  ? "Web preview is demo-only. Use the native Android app to connect to your Hermes server; do not enter real credentials here."
  : null;

// Block only connection configuration, not demo flags, preferences, bots, or appearance.
// Ignore legacy localStorage config as well, so a preview cannot reconnect on startup.
const connectionKeys = new Set([
  "hermes.baseUrl", "hermes.apiKey", "hermes.cfClientId", "hermes.cfClientSecret",
  "hermes.bridgeUrl", "hermes.bridgeKey",
]);
function credentialBearingRoster(k: string, value: string | null): boolean {
  if (k !== "hermes.roster" || value === null) return false;
  try {
    const bots: unknown = JSON.parse(value);
    // LiveBackend stores per-profile API keys in this array. Harmless sample bots are allowed.
    return !Array.isArray(bots) || bots.some((bot) => Boolean(bot?.apiKey));
  } catch { return true; } // Malformed live roster must not bypass the web boundary.
}
export const getItem = async (k: string) => {
  if (!web) return SecureStore.getItemAsync(k);
  if (connectionKeys.has(k)) return null;
  const value = globalThis.localStorage?.getItem(k) ?? null;
  return credentialBearingRoster(k, value) ? null : value;
};
export const setItem = async (k: string, v: string) => {
  if (web && (connectionKeys.has(k) || credentialBearingRoster(k, v))) throw new Error(liveConnectionError!);
  return web ? globalThis.localStorage?.setItem(k, v) : SecureStore.setItemAsync(k, v);
};
export const deleteItem = async (k: string) => (web ? globalThis.localStorage?.removeItem(k) : SecureStore.deleteItemAsync(k));
