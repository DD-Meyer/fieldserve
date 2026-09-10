import { useAuth, useSSO } from "@clerk/clerk-expo";
import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

export default function GoogleAuthScreen() {
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { startSSOFlow } = useSSO();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleContinue = async () => {
    setError(null);
    setLoading(true);
    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: "fieldservecrm",
        path: "oauth-native-callback",
      });

      const { createdSessionId, setActive, signIn, signUp } =
        await startSSOFlow({
          strategy: "oauth_google",
          redirectUrl,
        });

      if (createdSessionId) {
        await setActive?.({ session: createdSessionId });
        router.replace("/(tabs)");
        return;
      }

      if (
        signUp?.status === "missing_requirements" ||
        signIn?.status === "needs_identifier"
      ) {
        setError(
          "Google sign-in needs a little more info. Please continue with email sign-up.",
        );
        return;
      }

      setError("Google authentication did not complete. Please try again.");
    } catch (e: any) {
      setError(
        e?.errors?.[0]?.longMessage ||
          e?.message ||
          "Google authentication failed",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthLoaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.helper}>Preparing authentication…</Text>
      </View>
    );
  }

  if (isSignedIn) {
    router.replace("/(tabs)");
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.helper}>Redirecting…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Continue with Google</Text>
        <Text style={styles.subtitle}>
          Use your Google account to sign in or create your FieldServe account.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={handleGoogleContinue}
          disabled={loading}
          style={({ pressed }) => [
            styles.button,
            loading && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue with Google</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.linkButton}>
          <Text style={styles.linkText}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFB" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  helper: { marginTop: 12, color: "#64748b", fontSize: 14 },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "700", color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 4, marginBottom: 24 },
  error: { fontSize: 12, color: "#dc2626", marginBottom: 12 },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  linkButton: { marginTop: 14, alignItems: "center" },
  linkText: { color: "#2563eb", fontWeight: "600" },
});

