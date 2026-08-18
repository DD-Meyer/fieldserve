import { useAuth, useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
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

export default function SignUpScreen() {
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { signUp, setActive, isLoaded } = useSignUp();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"form" | "verify">("form");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const startSignUp = async () => {
    if (!isLoaded || !signUp) return;
    setError(null);
    setLoading(true);
    try {
      const createdSignUp = await signUp.create({
        emailAddress: email.trim().toLowerCase(),
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });

      if (createdSignUp.status === "complete") {
        await setActive({ session: createdSignUp.createdSessionId });
        router.replace("/(auth)/onboarding");
        return;
      }

      await createdSignUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });
      setStage("verify");
    } catch (e: any) {
      setError(e?.errors?.[0]?.longMessage || e?.message || "Sign-up failed");
    } finally {
      setLoading(false);
    }
  };

  const confirmCode = async () => {
    if (!isLoaded || !signUp) return;
    setError(null);
    setLoading(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/(auth)/onboarding");
      } else {
        setError("Verification incomplete.");
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.longMessage || e?.message || "Code rejected");
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
          <Text style={styles.title}>
            {stage === "form" ? "Create account" : "Verify your email"}
          </Text>
          <Text style={styles.subtitle}>
            {stage === "form"
              ? "Sign up to start managing field jobs"
              : `We sent a 6-digit code to ${email}`}
          </Text>

          {stage === "form" ? (
            <>
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>First name</Text>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Alex"
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                  />
                </View>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>Last name</Text>
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Morgan"
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                  />
                </View>
              </View>

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
                placeholder="At least 8 characters"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                onPress={startSignUp}
                disabled={loading || !email || !password}
                style={({ pressed }) => [
                  styles.button,
                  (loading || !email || !password) && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Create account</Text>
                )}
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already registered? </Text>
                <Link href="/(auth)/sign-in" style={styles.footerLink}>
                  Sign in
                </Link>
              </View>
            </>
          ) : (
            <>
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
                onPress={confirmCode}
                disabled={loading || !code}
                style={({ pressed }) => [
                  styles.button,
                  (loading || !code) && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify</Text>
                )}
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
  row: { flexDirection: "row", gap: 12 },
  rowItem: { flex: 1 },
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
});
