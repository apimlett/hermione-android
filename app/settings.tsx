import { router } from "expo-router";
import { ChevronDown, ChevronRight, X } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BridgeClient } from "../src/bridge";
import { bridgeTarget, type HermesConfig } from "../src/config";
import { HermesClient } from "../src/hermes";
import { validatePocConnection } from "../src/poc-policy";
import { liveConnectionError } from "../src/secure";
import { useApp } from "../src/app-state";
import { Logo } from "../src/ui/logo";
import { colors, font, radii, type } from "../src/ui/theme";

export default function Settings() {
  const { config, save, demo, setDemo } = useApp();
  const insets = useSafeAreaInsets();
  const [f, setF] = useState<HermesConfig>({ bridgeUrl: "", bridgeKey: "", ...(config ?? { baseUrl: "", apiKey: "", cfClientId: "", cfClientSecret: "" }) });
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [failed, setFailed] = useState(false);
  // The POC expects private Tailscale Serve; Cloudflare fields stay empty unless explicitly configured.
  const [cfOpen, setCfOpen] = useState(!!(config?.cfClientId || config?.cfClientSecret));
  const field = (k: keyof HermesConfig, label: string, opts: { secret?: boolean; placeholder: string; hint: string; url?: boolean }) => (
    <View style={{ gap: 6 }}>
      <Text style={[type.label, { color: colors.text }]}>{label}</Text>
      <TextInput value={f[k]} editable={!liveConnectionError} onChangeText={(v) => setF({ ...f, [k]: v })} secureTextEntry={opts.secret} autoCapitalize="none" autoCorrect={false}
        placeholder={opts.placeholder} keyboardType={opts.url ? "url" : "default"} accessibilityLabel={label}
        placeholderTextColor={colors.muted} style={{ backgroundColor: colors.surface, color: colors.text, fontFamily: font.regular, fontSize: 15, minHeight: 48,
          borderRadius: radii.inset, borderWidth: 1, borderColor: colors.rule, paddingHorizontal: 14, paddingVertical: 12 }} />
      <Text style={[type.label, { fontSize: 12, color: colors.dim }]}>{opts.hint}</Text>
    </View>
  );
  // Trim, drop trailing slashes, and add https:// when the scheme is missing.
  const url = (v = "") => { const u = v.trim().replace(/\/+$/, ""); return u && !/^https?:\/\//i.test(u) ? `https://${u}` : u; };
  const normalized = (): HermesConfig => ({
    baseUrl: url(f.baseUrl), apiKey: f.apiKey.trim(), cfClientId: f.cfClientId.trim(), cfClientSecret: f.cfClientSecret.trim(),
    bridgeUrl: url(f.bridgeUrl), bridgeKey: (f.bridgeKey ?? "").trim(),
  });
  /** hermes-bridge is optional: a problem with it is reported, but the Hermes connection is still saved. */
  async function checkBridge(c: HermesConfig): Promise<string | null> {
    const error = validatePocConnection(c) ?? liveConnectionError;
    if (error) return error;
    const t = bridgeTarget(c);
    if (!t) return null;
    try {
      const st = await new BridgeClient({ ...t, cfClientId: c.cfClientId, cfClientSecret: c.cfClientSecret }).status();
      return st.ok ? null : (st.message ?? st.code ?? "not ready");
    } catch (e: any) { return String(e?.message ?? e); }
  }
  const explain = (msg: string) =>
    /^403\b/.test(msg) ? (f.cfClientId ? "Cloudflare Access refused (403). Check the Access client ID and secret, and that the app's policy is Service Auth with this token." : "The server refused the request (403). If it sits behind Cloudflare Access, fill in the Cloudflare Access section.")
    : /^401\b/.test(msg) ? "Hermes refused the API key (401). Use the API_SERVER_KEY from your Hermes server."
    : /^404\b/.test(msg) ? "Reached a server, but not the Hermes API (404). Check the server URL."
    : /network|fetch|failed to connect|unable to resolve/i.test(msg) ? `Can't reach the Hermes server (${msg}). Check Tailscale on your phone, the confirmed API endpoint, and Tailscale Serve on the server (tailscale serve status).`
    : msg;
  async function saveOnly() {
    const c = normalized();
    const error = validatePocConnection(c) ?? liveConnectionError;
    if (error || !c.apiKey) { setStatus({ ok: false, text: error || "Enter the Hermes API key (not the webapp password)." }); return; }
    setBusy(true);
    try { await save(c); router.replace("/"); }
    catch (e: any) { setStatus({ ok: false, text: explain(String(e?.message ?? e)) }); }
    finally { setBusy(false); }
  }

  async function testAndSave() {
    setBusy(true); setStatus(null); setFailed(false);
    const c = normalized(); setF(c);
    const error = validatePocConnection(c) ?? liveConnectionError;
    if (error || !c.apiKey) { setStatus({ ok: false, text: error || "Enter the Hermes API key (not the webapp password)." }); setBusy(false); return; }
    try {
      await new HermesClient(c).capabilities(); // authenticated: proves CF Access + Hermes key
      await save(c);
      const bridgeProblem = await checkBridge(c);
      if (bridgeProblem) { setStatus({ ok: false, text: `Connected to Hermes and saved. hermes-bridge isn't working yet: ${bridgeProblem}` }); return; }
      setStatus({ ok: true, text: bridgeTarget(c) ? "Connected · hermes-bridge ready" : "Connected" });
      router.replace("/");
    } catch (e: any) { setStatus({ ok: false, text: explain(String(e?.message ?? e)) }); setFailed(true); } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, gap: 18 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Logo /><Text style={type.eyebrow}>Hermione POC</Text></View>
          {config || demo ? <Pressable hitSlop={4} accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><X size={24} color={colors.text} /></Pressable> : null}
        </View>
        <View style={{ gap: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
          <Text style={type.eyebrow}>Server</Text>
          <Text accessibilityRole="header" style={type.civic}>Connect</Text>
          <Text style={type.bodySm}>Link this phone to your Hermes agents.</Text>
        </View>
        <Text style={type.bodySm}>Live connection: use the separately configured Hermes API over private Tailscale Serve HTTPS, not public Funnel. Tailscale must be connected on your phone. Native credentials are kept in Android Keystore-backed secure storage.</Text>
        <Text style={type.bodySm}>The API endpoint and API key are NOT the existing webapp login/password. A desktop webapp on the same host is not this client's API. Confirm the API endpoint separately before connecting.</Text>
        <Text style={type.bodySm}>Offline sample demo uses sample bots and conversations, with no live server connection. Live mode runs code on your Hermes server; cloud LLM calls remain possible if the backend is explicitly configured to use them.</Text>
        {liveConnectionError ? <Text style={[type.bodySm, { color: colors.danger }]}>{liveConnectionError}</Text> : null}
        {field("baseUrl", "Hermes API URL", { url: true, placeholder: "Confirmed Tailscale HTTPS API endpoint", hint: "For example https://your-host.your-tailnet.ts.net. Confirm the API port/path and tailscale serve status; do not use the desktop webapp URL." })}
        {field("apiKey", "Hermes API key", { secret: true, placeholder: "API_SERVER_KEY", hint: "Use the separately configured API_SERVER_KEY, not your webapp password. Do not paste credentials into web preview." })}
        <Pressable onPress={() => setCfOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: cfOpen }}
          accessibilityLabel="Cloudflare Access (optional)" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 }}>
          {cfOpen ? <ChevronDown size={16} color={colors.muted} /> : <ChevronRight size={16} color={colors.muted} />}
          <Text style={[type.label, { color: colors.textSecondary }]}>Cloudflare Access (optional)</Text>
          {!cfOpen && (f.cfClientId || f.cfClientSecret) ? <Text style={[type.label, { color: colors.dim }]}>· set</Text> : null}
        </Pressable>
        {cfOpen ? (
          <View style={{ gap: 18, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: colors.rule }}>
            <Text style={[type.label, { fontSize: 12, color: colors.dim }]}>Leave empty for a private Tailscale Serve setup. Only use these if Cloudflare Access is separately configured; the headers are sent only when both are filled in.</Text>
            {field("cfClientId", "Cloudflare Access Client ID", { placeholder: "xxxxxxxx.access", hint: "Zero Trust → Access → Service Tokens." })}
            {field("cfClientSecret", "Cloudflare Access Client Secret", { secret: true, placeholder: "Client Secret", hint: "Shown once when the service token is created." })}
          </View>
        ) : null}
        <View style={{ gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.rule }}>
          <Text style={type.eyebrow}>Hermes bridge (optional)</Text>
          <Text style={[type.label, { fontSize: 12, color: colors.dim }]}>Disabled by default: leave both bridge fields empty. Only enable an independently configured bridge on the same host with explicit authorization. Bridge features can change real profiles and server settings; this setup screen does not install a bridge or change the server.</Text>
        </View>
        {field("bridgeKey", "Bridge key", { secret: true, placeholder: "Leave empty to skip", hint: "On the server: the key hermes-bridge was started with" })}
        {f.bridgeKey?.trim() ? field("bridgeUrl", "Bridge URL", { url: true, placeholder: `${url(f.baseUrl) || "https://your-host.your-tailnet.ts.net"}/bridge`, hint: "Leave empty to use your server URL + /bridge" }) : null}
        <Pressable disabled={busy} onPress={testAndSave}
          accessibilityRole="button" accessibilityState={{ disabled: busy, busy }}
          style={({ pressed }) => ({ backgroundColor: busy ? colors.surfaceAlt : pressed ? colors.coralPressed : colors.coral, borderRadius: radii.inset, minHeight: 52, paddingVertical: 14, alignItems: "center", justifyContent: "center" })}>
          <Text style={{ fontFamily: font.display, fontWeight: "700", fontSize: 19, textTransform: "uppercase", color: busy ? colors.muted : colors.onCoral }}>{busy ? "Testing…" : "Test & save"}</Text>
        </Pressable>
        <Pressable onPress={async () => { await setDemo(!demo); router.replace("/"); }}
          accessibilityRole="button"
          style={({ pressed }) => ({ borderRadius: radii.inset, minHeight: 52, paddingVertical: 14, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.text, backgroundColor: pressed ? colors.surfaceAlt : "transparent" })}>
          <Text style={{ fontFamily: font.semibold, fontSize: 15, textAlign: "center", color: colors.text }}>{demo ? "Leave offline sample demo" : "Try offline sample demo (no server connection)"}</Text>
        </Pressable>
        {status ? <Text selectable style={[type.bodySm, { color: status.ok ? colors.success : colors.danger }]}>{status.text}</Text> : null}
        {failed ? (
          <Pressable disabled={busy} onPress={saveOnly} accessibilityLabel="Save without testing" style={{ alignItems: "center", justifyContent: "center", minHeight: 48 }}>
            <Text style={[type.label, { color: colors.accentText }]}>Save anyway (test later)</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
