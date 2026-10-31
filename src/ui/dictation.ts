// Voice is deliberately disabled in the first local-first POC.
import { useCallback } from "react";
import { Alert } from "react-native";

export function useDictation(_botId: string, _current: () => string) {
  const toggle = useCallback(async () => {
    Alert.alert("Voice is not included yet", "This POC keeps voice disabled until on-device speech processing has been verified. Please type your message.");
  }, []);
  return { listening: false, toggle };
}
