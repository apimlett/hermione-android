// The Hermione cover (DS v0.2 concept, panel 1): a huge cropped HER / MIONE wordmark, the index
// number, the mono tagline, the editorial angle and PLAN / ANALYSE / CREATE / OPERATE. Shown while
// the app loads and, on first run, with the two ways in. Purely editorial: no state of its own.
import type { ReactNode } from "react";
import { Platform, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { colors, font, layout, type } from "./theme";

/** Assets/geometry/editorial-angle.svg from the design system. */
function EditorialAngle({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path fill={colors.coral} d="M0 0h200v36H62l138 138v26h-27L36 62v138H0z" />
    </Svg>
  );
}

export function Cover({ children }: { children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const inner = width - layout.gutter * 2;
  // Size "MIONE" to fill the width. Roboto Condensed Bold caps measure about 0.49 em on Android; the
  // web preview falls back to a wide sans (about 0.72 em). Both lines can still shrink to fit.
  const em = Platform.OS === "android" ? 0.5 : 0.74;
  const word = Math.min(inner / (5 * em), height * 0.2);
  const angle = Math.min(inner * 0.62, height * 0.24);
  return (
    <View accessible={!children} accessibilityLabel="Hermione. Autonomous agents under your control." style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20, paddingHorizontal: layout.gutter }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text style={[type.eyebrow, { color: colors.text, lineHeight: 17 }]}>{"Autonomous\nagents\nunder\nyour\ncontrol"}</Text>
        <Text style={{ fontFamily: font.display, fontWeight: "700", fontSize: 44, lineHeight: 46, color: colors.coral }}>01</Text>
      </View>
      <View accessibilityRole="header" style={{ marginTop: 14 }}>
        <Text numberOfLines={1} adjustsFontSizeToFit ellipsizeMode="clip" style={{ fontFamily: font.display, fontWeight: "700", fontSize: word, lineHeight: word * 0.9, color: colors.coral, includeFontPadding: false }}>HER</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit ellipsizeMode="clip" style={{ fontFamily: font.display, fontWeight: "700", fontSize: word, lineHeight: word * 0.9, color: colors.coral, includeFontPadding: false }}>MIONE</Text>
      </View>
      <View style={{ height: 1, backgroundColor: colors.coral, marginTop: 16 }} />
      <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 16 }}>
        <EditorialAngle size={angle} />
        <View style={{ borderTopWidth: 1, borderTopColor: colors.coral, paddingTop: 8, marginBottom: 2 }}>
          <Text style={[type.eyebrow, { color: colors.text, lineHeight: 17 }]}>{"Plan\nAnalyse\nCreate\nOperate"}</Text>
        </View>
      </View>
      {children ? <View style={{ gap: 12, marginTop: 24 }}>{children}</View> : null}
    </View>
  );
}
