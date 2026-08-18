import { useAuth, useSignIn } from "@clerk/clerk-expo";
import { useMe } from "../../lib/hooks/useMe";
import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Stage = "credentials" | "verify";

export default function SignInScreen() {
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn, signOut } = useAuth();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { data: me, isLoading: isMeLoading } = useMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<Stage>("credentials");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn || isMeLoading) return;
    const hasBusiness = me?.memberships.some(
      (membership) => membership.status === "active",
    );
    router.replace(hasBusiness ? "/(tabs)" : "/(auth)/onboarding");
  }, [isAuthLoaded, isMeLoading, isSignedIn, me, router]);

  if (!isAuthLoaded || isSignedIn) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F9FAFB" }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 12, color: "#64748b", fontSize: 14 }}>
          Redirecting…
        </Text>
      </View>
    );
  }

  const finishSession = async (createdSessionId: string | null) => {
    if (!createdSessionId) {
      setError("Sign-in succeeded but no session was created.");
      return;
    }
    if (!setActive) {
      setError("Sign-in is not ready to activate the session.");
      return;
    }
    await setActive({ session: createdSessionId });
    router.replace("/(auth)/onboarding");
  };

  const startMfa = async () => {
    if (!signIn) return;
    const factor = signIn.supportedSecondFactors?.find(
      (f) => f.strategy === "email_code",
    );
    if (!factor) {
      setError(
        "This account requires verification but no email_code factor is available.",
      );
      return;
    }
    await signIn.prepareSecondFactor({
      strategy: "email_code",
      emailAddressId: (factor as any).emailAddressId,
    });
    setStage("verify");
  };

  const submitCredentials = async () => {
    if (!isAuthLoaded || isSignedIn) {
      router.replace("/(auth)/onboarding");
      return;
    }
    if (!isLoaded || !signIn) return;
    setError(null);
    setLoading(true);
    try {
      let attempt = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (
        attempt.status !== "complete" &&
        attempt.supportedFirstFactors?.some((f) => f.strategy === "password")
      ) {
        attempt = await signIn.attemptFirstFactor({
          strategy: "password",
          password,
        });
      }

      if (attempt.status === "complete") {
        await finishSession(attempt.createdSessionId);
      } else if (attempt.status === "needs_second_factor") {
        await startMfa();
      } else {
        console.log("[FieldServe] sign-in incomplete", attempt.status, attempt);
        setError(`Sign-in not complete (status: ${attempt.status}).`);
      }
    } catch (e: any) {
      console.log("[FieldServe] sign-in error", e);
      const clerkErrors = e?.errors ?? [];
      const alreadySignedIn = clerkErrors.some(
        (clerkError: any) =>
          clerkError?.code === "already_signed_in" ||
          clerkError?.message?.toLowerCase().includes("already signed in") ||
          clerkError?.longMessage?.toLowerCase().includes("already signed in"),
      );
      if (alreadySignedIn) {
        await signOut();
        setError("The previous account was signed out. Sign in again to switch accounts.");
        return;
      }
      setError(e?.errors?.[0]?.longMessage || e?.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async () => {
    if (!isLoaded) return;
    setError(null);
    setLoading(true);
    try {
      const attempt = await signIn.attemptSecondFactor({
        strategy: "email_code",
        code: code.trim(),
      });
      if (attempt.status === "complete") {
        await finishSession(attempt.createdSessionId);
      } else {
        console.log("[FieldServe] verify incomplete", attempt.status, attempt);
        setError(`Verification not complete (status: ${attempt.status}).`);
      }
    } catch (e: any) {
      console.log("[FieldServe] verify error", e);
      setError(e?.errors?.[0]?.longMessage || e?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          {stage === "credentials" ? (
            <>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>
                Sign in to your FieldServe account
              </Text>

              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                onPress={submitCredentials}
                disabled={
                  loading || !email || !password || !isAuthLoaded || !!isSignedIn
                }
                style={({ pressed }) => [
                  styles.button,
                  (loading || !email || !password) && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Sign in</Text>
                )}
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>No account? </Text>
                <Link href="/(auth)/sign-up" style={styles.footerLink}>
                  Create one
                </Link>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>Verify it&apos;s you</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit code to {email}
              </Text>

              <Text style={styles.label}>Verification code</Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                placeholder="123456"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                onPress={submitCode}
                disabled={loading || code.length < 4}
                style={({ pressed }) => [
                  styles.button,
                  (loading || code.length < 4) && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  setStage("credentials");
                  setCode("");
                  setError(null);
                }}
                style={styles.linkButton}
              >
                <Text style={styles.footerLink}>Back to sign in</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFB" },
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "700", color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 4, marginBottom: 32 },
  label: { fontSize: 12, color: "#64748b", marginBottom: 4 },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#0f172a",
    marginBottom: 16,
    fontSize: 16,
  },
  error: { fontSize: 12, color: "#dc2626", marginTop: 4, marginBottom: 4 },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: "#ffffff", fontWeight: "600", fontSize: 16 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { fontSize: 14, color: "#64748b" },
  footerLink: { fontSize: 14, color: "#2563eb", fontWeight: "600" },
  linkButton: { alignItems: "center", marginTop: 16, paddingVertical: 8 },
});
