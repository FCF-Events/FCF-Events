import { StatusBar } from "expo-status-bar";

import { CheckInScreen } from "@/components/check-in-screen";

export default function AppRoot() {
  return (
    <>
      <StatusBar style="light" />
      <CheckInScreen />
    </>
  );
}
