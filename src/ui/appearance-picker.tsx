// Shape / colour / face / emoji picker. Every pick calls onPick; screens make the preview hop (useCheer).
import { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AVATAR_EMOJI } from "../backend";
import { EYE_STYLES, type EyeStyle, GRADIENTS, type Look, PALETTE, SHAPE_LABELS, SHAPES, type Swatch } from "../appearance";
import { ShapeTile } from "./bot-face";
import { Chip } from "./kit";
import { colors, radii, type } from "./theme";

/** A short "happy" flash for the preview face each time something is picked. */
export function useCheer(ms = 900): [boolean, () => void] {
  const [on, setOn] = useState(false); const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fire = useCallback(() => { setOn(false); requestAnimationFrame(() => setOn(true)); clearTimeout(timer.current); timer.current = setTimeout(() => setOn(false), ms); }, [ms]);
  return [on, fire];
}

const EYE_LABEL: Record<EyeStyle, string> = { auto: "Auto", round: "Round", tall: "Tall", wide: "Wide", dot: "Dots" };
const Label = ({ children }: { children: string }) => <Text accessibilityRole="header" style={[type.eyebrow, { color: colors.text, alignSelf: "flex-start" }]}>{children}</Text>;

export function AppearancePicker({ look, onPick }: { look: Look; onPick: (patch: Partial<Look>) => void }) {
  const sel = (s: Swatch) => look.color === s.a && (look.color2 ?? undefined) === s.b;
  const swatch = (s: Swatch) => (
    <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`Colour ${s.name}`} accessibilityState={{ selected: sel(s) }} onPress={() => onPick({ color: s.a, color2: s.b })}
      style={{ width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: sel(s) ? colors.text : "transparent" }}>
      <View style={{ width: 30, height: 30 }}><ShapeTile shape="circle" color={s.a} color2={s.b} size={30} /></View>
    </Pressable>
  );
  return (
    <View style={{ gap: 12, alignSelf: "stretch" }}>
      <Label>Shape</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {SHAPES.map((sh) => {
          const on = (look.shape ?? "rounded") === sh;
          return (
            <Pressable key={sh} accessibilityRole="button" accessibilityLabel={`Shape ${SHAPE_LABELS[sh]}`} accessibilityState={{ selected: on }} onPress={() => onPick({ shape: sh })}
              style={{ width: 72, alignItems: "center", gap: 4, paddingVertical: 8, borderRadius: radii.inset, backgroundColor: colors.surface, borderWidth: on ? 2 : 1, borderColor: on ? colors.coral : colors.rule }}>
              <View style={{ width: 36, height: 36 }}><ShapeTile shape={sh} color={look.color} color2={look.color2} size={36} /></View>
              <Text style={[type.label, { fontSize: 11, color: on ? colors.text : colors.muted }]}>{SHAPE_LABELS[sh]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Label>Colour</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>{PALETTE.map(swatch)}</View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>{GRADIENTS.map(swatch)}</View>
      <Label>Face</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {EYE_STYLES.map((e) => <Chip key={e} label={EYE_LABEL[e]} selected={(look.eyes ?? "auto") === e} onPress={() => onPick({ eyes: e })} />)}
      </View>
      <Label>Badge</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
        {AVATAR_EMOJI.map((e) => <Pressable key={e} accessibilityRole="button" accessibilityLabel={`Emoji ${e}`} accessibilityState={{ selected: look.emoji === e }} onPress={() => onPick({ emoji: e })} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.inset, borderWidth: look.emoji === e ? 2 : 1, borderColor: look.emoji === e ? colors.coral : "transparent", backgroundColor: look.emoji === e ? colors.surface : "transparent" }}><Text style={{ fontSize: 22 }}>{e}</Text></Pressable>)}
      </View>
    </View>
  );
}
