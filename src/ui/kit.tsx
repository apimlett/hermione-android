// Shared building blocks: Hermione DS v0.2 component contracts (Swiss Civic / Coral Parchment).
// Flat surfaces, 1px rules, condensed coral titles, mono eyebrows, 48dp touch targets.
import { router } from "expo-router";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Sparkles } from "lucide-react-native";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from "react-native";
import { doneHaptic, tapHaptic } from "./haptics";
import { toast } from "./toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Bot } from "../backend";
import { BotFace, type FaceMood } from "./bot-face";
import { colors, font, hit, layout, medium, radii, type } from "./theme";

/** A bot's animated face (see bot-face.tsx). Seed = bot id, so personality stays stable on rename. */
export const Avatar = memo(function Avatar({ bot, size = 36, busy = false, mood, animate = true, badge = true, poke }: {
  bot: Pick<Bot, "emoji" | "color" | "color2" | "shape" | "eyes"> & { id?: string; name?: string }; size?: number; busy?: boolean; mood?: FaceMood; animate?: boolean; badge?: boolean; poke?: number;
}) {
  return <BotFace seed={bot.id ?? slug(bot.name ?? "")} color={bot.color} color2={bot.color2} shape={bot.shape} eyes={bot.eyes} emoji={bot.emoji} size={size} mood={mood ?? (busy ? "thinking" : "idle")} animate={animate} badge={badge} poke={poke} />;
});

/** A face you can tap: it reacts (squash, blink, hop) with a light haptic. For big, standalone faces
 *  (bot settings, new bot, empty chat), not list rows, where a tap navigates. */
export function TapFace(props: Omit<Parameters<typeof Avatar>[0], "poke"> & { label?: string }) {
  const [poke, setPoke] = useState(0);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={props.label ?? `${props.bot.name ?? "Bot"} face`} accessibilityHint="Says hi"
      onPress={() => { tapHaptic(); setPoke((n) => n + 1); }} hitSlop={8}>
      <Avatar {...props} poke={poke} />
    </Pressable>
  );
}
export const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Mono, uppercase, tracked: the small technical label above titles and sections. */
export function Eyebrow({ children, color, style }: { children: ReactNode; color?: string; style?: object }) {
  return <Text style={[type.eyebrow, color ? { color } : null, style]}>{children}</Text>;
}

/** DS CivicHeader: small mono eyebrow, condensed coral title, optional subtitle and index number,
 *  then a thin rule. The title wraps rather than clips at large font sizes. */
export function CivicHeader({ eyebrow, title, subtitle, index, right, hero = false, rule = true }: {
  eyebrow?: string; title: string; subtitle?: string; index?: string; right?: ReactNode; hero?: boolean; rule?: boolean;
}) {
  return (
    <View style={{ gap: 4, paddingBottom: rule ? 12 : 0, borderBottomWidth: rule ? layout.rule : 0, borderBottomColor: colors.rule }}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <Text accessibilityRole="header" style={[hero ? type.hero : type.civic, { flex: 1 }]}>{title}</Text>
        {index ? <Text style={[type.display, { fontFamily: font.display, color: colors.text }]}>{index}</Text> : null}
        {right}
      </View>
      {subtitle ? <Text style={[type.bodySm, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  );
}

/** A coral condensed in-page heading (IDENTITY, APPEARANCE) over a thin rule. */
export function Heading({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 6, borderBottomWidth: layout.rule, borderBottomColor: colors.rule }}>
      <Text accessibilityRole="header" style={[type.civic, { fontSize: 24, lineHeight: 28, flexShrink: 1 }]}>{children}</Text>
      {right}
    </View>
  );
}

export function Screen({ title, subtitle, eyebrow, right, children, scroll = true }: { title: string; subtitle?: string; eyebrow?: string; right?: ReactNode; children: ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  const header = (
    <View style={{ paddingHorizontal: layout.gutter, paddingTop: 2 }}>
      <CivicHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: 52, paddingHorizontal: 8, gap: 6 }}>
        <Pressable hitSlop={4} accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={({ pressed }) => ({ width: hit, height: hit, borderRadius: radii.inset, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.surfaceAlt : "transparent" })}>
          <ChevronLeft size={26} color={colors.text} strokeWidth={1.75} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {right}
      </View>
      {scroll ? null : header}
      <Body style={{ flex: 1 }} contentContainerStyle={scroll ? { paddingHorizontal: layout.gutter, paddingTop: 2, paddingBottom: insets.bottom + 32, gap: 22 } : undefined} keyboardShouldPersistTaps="handled">
        {scroll ? <CivicHeader eyebrow={eyebrow} title={title} subtitle={subtitle} /> : null}
        {children}
      </Body>
    </View>
  );
}

/** A flat group: mono eyebrow title, rules above and below, no card, no shadow. */
export function Section({ title, children, footer }: { title?: string; children: ReactNode; footer?: string }) {
  return (
    <View style={{ gap: 8 }}>
      {title ? <Eyebrow style={{ color: colors.text }}>{title}</Eyebrow> : null}
      <View style={{ borderTopWidth: layout.rule, borderBottomWidth: layout.rule, borderColor: colors.rule, overflow: "hidden" }}>{children}</View>
      {footer ? <Text style={[type.caption, { color: colors.muted }]}>{footer}</Text> : null}
    </View>
  );
}

export function Row({ icon, title, detail, onPress, right, last, danger }: {
  icon?: ReactNode; title: string; detail?: string; onPress?: () => void; right?: ReactNode; last?: boolean; danger?: boolean;
}) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={detail ? `${title}, ${detail}` : title}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 56, paddingHorizontal: 4, paddingVertical: 12,
      backgroundColor: pressed ? colors.surfaceAlt : "transparent", borderBottomWidth: last ? 0 : layout.rule, borderBottomColor: colors.rule })}>
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.body, danger && { color: colors.danger }]} numberOfLines={2}>{title}</Text>
        {detail ? <Text style={type.label} numberOfLines={2}>{detail}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={20} color={colors.text} strokeWidth={1.75} /> : null)}
    </Pressable>
  );
}

/** A switch that answers at once: it flips immediately (with a tick) while the change is saved; if
 *  onChange returns a promise that fails, it flips back and a toast says why. */
export function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void | Promise<unknown>; disabled?: boolean }) {
  const [pending, setPending] = useState<boolean | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { setPending(null); }, [value]);
  useEffect(() => () => clearTimeout(settle.current), []);
  const shown = pending ?? value;
  return <Switch value={shown} disabled={disabled} accessibilityRole="switch" accessibilityState={{ checked: shown, disabled: !!disabled }}
    onValueChange={(v) => {
      tapHaptic(); setPending(v);
      const r = onChange(v);
      const later = () => { clearTimeout(settle.current); settle.current = setTimeout(() => setPending(null), 2500); };
      if (!r || typeof (r as Promise<unknown>).then !== "function") { later(); return; }
      (r as Promise<unknown>).then(
        // Saved: the parent usually reloads right after; drop the local value once it has had time to.
        later,
        (e: any) => { setPending(null); toast(String(e?.message ?? e ?? "Couldn't change that"), "error"); });
    }}
    trackColor={{ true: colors.coral, false: colors.ruleStrong }} thumbColor={colors.onCoral}
    {...({ activeThumbColor: colors.onCoral } as object) /* react-native-web reads this instead of thumbColor */} />;
}

/** DS Field: visible label, flat off-white fill, 1px border; focus turns the border blue, an error red. */
export function Field({ label, helper, error, ...props }: TextInputProps & { label: string; helper?: string; error?: string | null }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.label, { color: colors.text }]}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} autoCorrect={false} accessibilityLabel={label} accessibilityHint={error ?? helper} {...props}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }} onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        style={[{ backgroundColor: colors.surface, color: colors.text, fontFamily: font.regular, fontSize: 15, borderRadius: radii.inset, minHeight: 48,
          borderWidth: focused || error ? 2 : 1, borderColor: error ? colors.failed : focused ? colors.focus : colors.rule,
          paddingHorizontal: focused || error ? 13 : 14, paddingVertical: 11 }, props.multiline && { minHeight: 96, textAlignVertical: "top" }, props.editable === false && { backgroundColor: colors.surfaceAlt, color: colors.muted }, props.style]} />
      {error ? <Text accessibilityRole="alert" style={[type.label, { color: colors.danger }]}>{error}</Text>
        : helper ? <Text style={type.caption}>{helper}</Text> : null}
    </View>
  );
}

/** A full-width action. Primary: coral fill, large condensed label (large text, so white on coral
 *  meets 3:1). Secondary: parchment with an ink rule. If onPress returns a promise the button shows a
 *  spinner while it runs (and ignores repeat taps); on success it shows `doneLabel` with a check for
 *  a moment (plus a success haptic), and a failure shows a toast. Nothing waits on the animation. */
export function Button({ title, onPress, kind = "primary", disabled, doneLabel, icon, arrow }: {
  title: string; onPress: () => void | Promise<unknown>; kind?: "primary" | "secondary" | "danger"; disabled?: boolean; doneLabel?: string; icon?: ReactNode; arrow?: boolean;
}) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  useEffect(() => { if (state !== "done") return; const t = setTimeout(() => setState("idle"), 1600); return () => clearTimeout(t); }, [state]);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const primary = kind === "primary";
  const fg = primary ? colors.onCoral : kind === "danger" ? colors.danger : colors.text;
  const press = () => {
    if (state === "busy") return;
    if (primary) tapHaptic();
    const r = onPress();
    if (!r || typeof (r as Promise<unknown>).then !== "function") return;
    setState("busy");
    (r as Promise<unknown>).then(() => {
      if (!alive.current) return;
      if (doneLabel) { doneHaptic(); setState("done"); } else setState("idle");
    }, (e: any) => { if (alive.current) setState("idle"); toast(String(e?.message ?? e ?? "That didn't work"), "error"); });
  };
  const label = state === "done" && doneLabel ? doneLabel : title;
  return (
    <Pressable disabled={disabled} onPress={press} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, busy: state === "busy" }}
      style={({ pressed }) => ({
        backgroundColor: disabled ? (primary ? colors.surfaceAlt : "transparent") : primary ? (pressed ? colors.coralPressed : colors.coral) : pressed ? colors.surfaceAlt : kind === "danger" ? "transparent" : colors.canvas,
        borderWidth: primary && !disabled ? 0 : 1, borderColor: disabled ? colors.rule : kind === "danger" ? colors.failed : colors.text,
        borderRadius: radii.inset, minHeight: 52, paddingVertical: 12, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: arrow ? "space-between" : "center" })}>
      {state === "busy" ? <ActivityIndicator size="small" color={disabled ? colors.muted : fg} style={{ flex: 1 }} /> : (<>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
          {state === "done" ? <Check size={18} color={primary ? colors.onCoral : colors.success} strokeWidth={2.6} /> : icon}
          <Text numberOfLines={2} style={primary
            ? { fontFamily: font.display, fontWeight: "700", fontSize: 19, lineHeight: 22, letterSpacing: 0.3, textTransform: "uppercase", color: disabled ? colors.muted : fg }
            : { fontFamily: font.medium, ...medium, fontSize: 15, color: disabled ? colors.muted : fg }}>{label}</Text>
        </View>
        {arrow ? <ChevronRight size={22} color={disabled ? colors.muted : fg} strokeWidth={2} /> : null}
      </>)}
    </Pressable>
  );
}

/** Flat selectable label. Selected = coral fill, never a pill. */
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress && (() => { tapHaptic(); onPress(); })} hitSlop={6} accessibilityRole="button" accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => ({ minHeight: 36, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.chip, borderWidth: 1,
      borderColor: selected ? colors.coral : colors.rule, backgroundColor: selected ? colors.coral : pressed ? colors.surfaceAlt : colors.surface })}>
      <Text style={{ fontFamily: font.medium, ...medium, fontSize: 13, color: selected ? colors.onCoral : colors.text }}>{label}</Text>
    </Pressable>
  );
}

/** DS SegmentedTabs: flat labels, the active one in coral with a coral underline. */
export function SegmentedTabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", borderBottomWidth: layout.rule, borderBottomColor: colors.rule }}>
      {tabs.map((t, i) => {
        const on = t.key === value;
        return (
          <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label} onPress={() => { if (!on) { tapHaptic(); onChange(t.key); } }}
            style={({ pressed }) => ({ flex: 1, minHeight: hit, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
              borderLeftWidth: i ? layout.rule : 0, borderLeftColor: colors.rule, backgroundColor: pressed ? colors.surfaceAlt : "transparent" })}>
            <Text numberOfLines={1} style={[type.eyebrow, { color: on ? colors.coralText : colors.text, letterSpacing: 1 }]}>{t.label}</Text>
            {on ? <View style={{ position: "absolute", left: 12, right: 12, bottom: -1, height: 2, backgroundColor: colors.coral }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export type Status = "ready" | "running" | "waiting" | "failed" | "offline" | "draft";
const STATUS_WORD: Record<Status, string> = { ready: "Ready", running: "Running", waiting: "Waiting", failed: "Failed", offline: "Offline", draft: "Draft" };

/** A bot's state as a DS status plus words. `needsKey` bots can't chat from this phone yet. */
export function botStatus(mood: FaceMood, o: { needsKey?: boolean; doing?: string } = {}): { status: Status; label: string } {
  if (mood === "waiting") return { status: "waiting", label: "Needs your OK" };
  if (mood === "thinking" || mood === "working") return { status: "running", label: o.doing || "Running" };
  if (mood === "error") return { status: "failed", label: "Needs attention" };
  if (o.needsKey) return { status: "offline", label: "Set up chat" };
  return { status: "ready", label: "Ready" };
}

/** DS StatusChip: a dot plus a word, on a neutral surface. State never rests on colour alone. */
export function StatusChip({ status, label, style }: { status: Status; label?: string; style?: object }) {
  const dot = status === "draft" ? colors.offline : colors[status];
  const hollow = status === "draft" || status === "offline";
  const text = label ?? STATUS_WORD[status];
  return (
    <View accessibilityLabel={`Status: ${text}`} style={[{ flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 }, style]}>
      <View style={{ width: 9, height: 9, borderRadius: radii.round, backgroundColor: hollow ? "transparent" : dot, borderWidth: hollow ? 1.5 : 0, borderColor: dot }} />
      <Text numberOfLines={1} style={[type.bodySm, { color: colors.textSecondary, flexShrink: 1 }]}>{text}</Text>
    </View>
  );
}

/** DS Metric: a huge coral number over a mono label. Pass a label that says what the number counts. */
export function Metric({ value, label, icon, onPress, a11y }: { value: number | string; label: string; icon?: ReactNode; onPress?: () => void; a11y?: string }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={a11y ?? `${value} ${label}`}
      style={({ pressed }) => ({ flex: 1, minHeight: 112, paddingHorizontal: 12, paddingVertical: 12, gap: 6, backgroundColor: pressed ? colors.surfaceAlt : "transparent" })}>
      <Eyebrow style={{ color: colors.text }}>{label}</Eyebrow>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <Text style={type.metric}>{value}</Text>
        {icon}
      </View>
    </Pressable>
  );
}

/** DS BottomNavigation: Home / Activity / Settings, flat, top rule, active tab a coral block. Sits
 *  above the Android navigation inset. */
export function BottomNav({ active, items, bottomInset }: { active: string; bottomInset: number; items: { key: string; label: string; icon: (color: string) => ReactNode; onPress: () => void }[] }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Primary navigation"
      style={{ flexDirection: "row", paddingBottom: bottomInset, backgroundColor: colors.canvas, borderTopWidth: layout.rule, borderTopColor: colors.rule }}>
      {items.map((it, i) => {
        const on = it.key === active;
        const fg = on ? colors.onCoral : colors.text;
        return (
          <Pressable key={it.key} onPress={it.onPress} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={it.label}
            style={({ pressed }) => ({ flex: 1, minHeight: layout.bottomNav, alignItems: "center", justifyContent: "center", gap: 4,
              borderLeftWidth: i && !on ? layout.rule : 0, borderLeftColor: colors.rule,
              backgroundColor: on ? colors.coral : pressed ? colors.surfaceAlt : "transparent" })}>
            {it.icon(fg)}
            <Text numberOfLines={1} style={[type.eyebrow, { fontSize: 10, letterSpacing: 1.2, color: fg }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Shown in live mode for features that need the planned companion service. */
export function ComingSoon({ what }: { what: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.rule, borderLeftWidth: 3, borderLeftColor: colors.offline }}>
      <Sparkles size={18} color={colors.offlineText} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[type.body, { fontFamily: font.semibold, ...medium }]}>Needs hermes-bridge</Text>
        <Text style={type.bodySm}>{what} needs hermes-bridge on your Hermes server (Hermes's chat API doesn't offer it). Add the bridge key in Settings, or try it in demo mode.</Text>
      </View>
    </View>
  );
}

export function ErrorText({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <View accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: radii.inset,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.rule, borderLeftWidth: 3, borderLeftColor: colors.failed }}>
      <AlertCircle size={16} color={colors.danger} style={{ marginTop: 1 }} />
      <Text selectable style={[type.bodySm, { flex: 1, color: colors.danger }]}>{error}</Text>
    </View>
  );
}

export function Empty({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <View style={{ alignItems: "center", gap: 10, paddingVertical: 40, paddingHorizontal: 24 }}>
      <View style={{ width: 72, height: 72, borderRadius: radii.card, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.text, marginBottom: 6 }}>
        <Text style={{ fontSize: 30 }}>{emoji}</Text>
      </View>
      <Text style={[type.h, { textAlign: "center" }]}>{title}</Text>
      <Text style={[type.bodySm, { textAlign: "center", color: colors.muted, maxWidth: 280 }]}>{body}</Text>
    </View>
  );
}
