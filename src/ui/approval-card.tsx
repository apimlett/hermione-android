// Shown inside a reply when Hermes pauses a run to ask before running a command.
// The user allows it once or denies it; the answer goes back to Hermes, which resumes the run. The
// card only goes away once Hermes has accepted the answer (approve() clears it after the request
// succeeds); until then the pressed choice shows a spinner and the others are disabled, and a failed
// answer keeps the card with the error so you can try again. Nothing here claims the command ran.
import { ShieldQuestion } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import type { Approval } from "../chat-model";
import { tapHaptic } from "./haptics";
import { colors, font, radii, type } from "./theme";

type Choice = string;

/** Shows exactly what will run (the full command or target), then Deny / Edit / Allow, plus
 *  "Allow for this chat" and "Always allow" (Hermes adds it to the allowlist). Edit denies the call and
 *  puts the command in the composer so you can say what to do instead. */
export function ApprovalCard({ approval, respond, onEdit }: { approval: Approval; respond: (c: Choice) => Promise<void>; onEdit?: (detail: string) => void }) {
  const [sending, setSending] = useState<Choice | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [text, setText] = useState("");

  const answer = async (c: Choice) => {
    if (sending) return;
    tapHaptic();
    setSending(c);
    setFailed(null);
    try { await respond(c); } catch (e) { setFailed(e instanceof Error ? e.message : String(e)); }
    finally { setSending(null); }
  };
  const busy = sending !== null;

  if (approval.kind === "clarify") return (
    <View accessibilityRole="alert" style={{ padding: 16, gap: 12, borderRadius: radii.card, backgroundColor: colors.approvalSurface, borderWidth: 1, borderColor: colors.warning }}>
      <Text style={type.label}>ANSWER NEEDED</Text>
      <Text style={type.title}>{approval.title}</Text>
      <Text style={type.bodySm}>{approval.multiSelect ? "Choose an answer or type multiple choices below." : "Choose an answer or type your own."}</Text>
      {!approval.multiSelect ? approval.choices?.map((c) => <ChoiceButton key={c} label={c} busy={sending === c} disabled={busy} onPress={() => answer(c)} />) : null}
      {approval.multiSelect && approval.choices?.length ? <Text style={type.bodySm}>{approval.choices.join(" · ")}</Text> : null}
      <TextInput accessibilityLabel="Your answer" value={text} onChangeText={setText} editable={!busy} multiline placeholder="Your answer" placeholderTextColor={colors.muted} style={[type.bodySm, { minHeight: 44, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radii.inset }]} />
      <ChoiceButton label="Send answer" primary busy={busy} disabled={busy || !text.trim()} onPress={() => answer(text)} />
      {failed ? <Text accessibilityLiveRegion="polite" style={[type.bodySm, { color: colors.danger }]}>Hermes didn't accept the answer: {failed}. Try again.</Text> : null}
    </View>
  );

  return (
    <View accessibilityRole="alert" style={{ marginTop: 4, padding: 16, gap: 12, borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.rule, borderLeftWidth: 4, borderLeftColor: colors.waiting }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: colors.waiting }} />
        <ShieldQuestion size={16} color={colors.waitingText} />
        <Text style={[type.eyebrow, { color: colors.text }]}>Waiting · needs your OK</Text>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={type.title}>{approval.title}</Text>
        <Text style={type.bodySm}>The run is paused. Nothing happens until you choose.</Text>
      </View>
      {approval.detail ? (
        <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: radii.inset, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.rule }}>
          <Text selectable style={{ fontFamily: font.mono, fontSize: 13, lineHeight: 19, color: colors.text }}>{approval.detail}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <ChoiceButton label="Deny" busy={sending === "deny"} disabled={busy} onPress={() => answer("deny")} />
        {onEdit ? <ChoiceButton label="Edit" busy={false} disabled={busy} onPress={() => { void answer("deny"); onEdit(approval.detail ?? approval.title); }} /> : null}
        <ChoiceButton label="Allow" primary busy={sending === "once"} disabled={busy} onPress={() => answer("once")} />
      </View>
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
        <LinkChoice label="Allow for this chat" busy={sending === "session"} disabled={busy} onPress={() => answer("session")} />
        <LinkChoice label="Always allow" busy={sending === "always"} disabled={busy} onPress={() => answer("always")} />
      </View>
      {failed ? <Text accessibilityLiveRegion="polite" style={[type.bodySm, { color: colors.danger }]}>Hermes didn't get that answer: {failed}. The run is still waiting; try again.</Text> : null}
    </View>
  );
}

function ChoiceButton({ label, primary, busy, disabled, onPress }: { label: string; primary?: boolean; busy: boolean; disabled: boolean; onPress: () => void }) {
  const fg = primary ? colors.actionForeground : colors.text;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.inset,
        opacity: disabled && !busy ? 0.45 : 1, borderWidth: primary ? 0 : 1, borderColor: colors.text,
        backgroundColor: primary ? (pressed ? colors.coralPressed : colors.coral) : pressed ? colors.surfaceAlt : "transparent" })}>
      {busy ? <ActivityIndicator size="small" color={fg} /> : <Text style={primary ? { fontFamily: font.display, fontWeight: "700", fontSize: 19, textTransform: "uppercase", color: fg } : { fontFamily: font.semibold, fontSize: 15, color: fg }}>{label}</Text>}
    </Pressable>
  );
}

function LinkChoice({ label, busy, disabled, onPress }: { label: string; busy: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 12, justifyContent: "center", borderRadius: radii.inset, opacity: disabled && !busy ? 0.45 : 1, backgroundColor: pressed ? colors.control : "transparent" })}>
      {busy ? <ActivityIndicator size="small" color={colors.muted} /> : <Text style={[type.label, { color: colors.textSecondary }]}>{label}</Text>}
    </Pressable>
  );
}
