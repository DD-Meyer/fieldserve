import { useSafeAreaInsets } from "react-native-safe-area-context";

import { components } from "@/constants/theme";

const FLOATING_BOTTOM_MIN = 50;
const CONTENT_GAP = 16;

export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, FLOATING_BOTTOM_MIN);
  return bottomOffset + components.tabBar.height + CONTENT_GAP;
}
