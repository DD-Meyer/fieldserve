import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

type TokenCache = {
  getToken: (key: string) => Promise<string | null>;
  saveToken: (key: string, value: string) => Promise<void>;
  clearToken?: (key: string) => Promise<void>;
};

const memoryCache: Record<string, string> = {};

/**
 * Token cache for Clerk. Uses expo-secure-store on native and an in-memory
 * fallback on web (where SecureStore is unavailable). On web, Clerk also has
 * its own cookie-based session, so the in-memory cache is acceptable.
 */
export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      if (Platform.OS === "web") return memoryCache[key] ?? null;
      const item = await SecureStore.getItemAsync(key);
      return item;
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      if (Platform.OS === "web") {
        memoryCache[key] = value;
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch {
      // swallow
    }
  },
};
