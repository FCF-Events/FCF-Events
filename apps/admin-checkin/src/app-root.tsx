import { useEffect } from "react";
import { AppState } from "react-native";
import { NavigationBar } from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { CheckInScreen } from "@/components/check-in-screen";

async function applyImmersiveNavigation() {
  if (process.env.EXPO_OS !== "android") return;

  try {
    NavigationBar.setStyle("dark");
    NavigationBar.setHidden(true);
  } catch {
    // Some Android builds ignore immersive nav calls while the activity is settling.
  }
}

export default function AppRoot() {
  useEffect(() => {
    void applyImmersiveNavigation();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void applyImmersiveNavigation();
    });

    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <CheckInScreen />
    </SafeAreaProvider>
  );
}
