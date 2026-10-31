// Voice calls are not included in this MVP; no microphone or recognizer is started.
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { colors, type } from "../../src/ui/theme";

export default function CallScreen() {
  return <View style={{flex:1,backgroundColor:colors.canvas,padding:28,justifyContent:"center",gap:20}}>
    <Text style={type.title}>Voice is not included yet</Text>
    <Text style={type.body}>Voice calls are disabled in this POC until on-device speech processing has been verified. Your microphone is not accessed.</Text>
    <Pressable accessibilityRole="button" onPress={()=>router.back()} style={{padding:16,backgroundColor:colors.control,borderRadius:16}}>
      <Text style={type.body}>Back to my bots</Text>
    </Pressable>
  </View>;
}
