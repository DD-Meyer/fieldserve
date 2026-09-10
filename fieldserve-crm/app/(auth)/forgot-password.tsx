import { useAuth, useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Step = "email" | "code" | "password";

function messageFrom(error: any) {
  return error?.errors?.[0]?.longMessage || error?.message || "Unable to reset your password.";
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { signIn, setActive, isLoaded: isSignInLoaded } = useSignIn();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthLoaded && isSignedIn) {
      router.replace("/(tabs)");
    }
  }, [isAuthLoaded, isSignedIn, router]);

  const sendCode = async () => {
    if (!signIn || !email.trim()) {
      setError("Enter the email address for your account.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email.trim().toLowerCase(),
      });
      setStep("code");
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!signIn || !code.trim()) {
      setError("Enter the verification code from your email.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const attempt = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: code.trim(),
      });
      if (attempt.status !== "needs_new_password") {
        throw new Error("The verification code could not be confirmed. Request a new code and try again.");
      }
      setStep("password");
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!signIn) return;
    if (!password || password !== confirmPassword) {
      setError("Enter matching new passwords.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const attempt = await signIn.resetPassword({ password });
      if (attempt.status !== "complete" || !attempt.createdSessionId) {
        throw new Error("Password changed, but sign-in could not be completed. Please sign in with your new password.");
      }
      await setActive({ session: attempt.createdSessionId });
      router.replace("/(tabs)");
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthLoaded || !isSignInLoaded || isSignedIn) {
    return (
      <View style={styles.loadingView}>
        <ActivityIndicator />
      </View>
    );
  }

  const action = step === "email" ? sendCode : step === "code" ? verifyCode : resetPassword;
  const actionLabel = step === "email" ? "Send code" : step === "code" ? "Verify code" : "Update password";
  const subtitle = step === "email"
    ? "Enter your account email and we will send a verification code."
    : step === "code"
      ? `Enter the code sent to ${email}.`
      : "Choose a new password for your account.";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back to sign in</Text>
        </Pressable>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {step === "email" ? (
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            style={styles.input}
          />
        ) : null}
        {step === "code" ? (
          <TextInput
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            placeholder="Verification code"
            style={styles.input}
          />
        ) : null}
        {step === "password" ? (
          <View style={styles.passwordFields}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder="New password"
              style={styles.input}
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder="Confirm new password"
              style={styles.input}
            />
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={action} disabled={loading} style={[styles.action, loading && styles.disabled]}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.actionText}>{actionLabel}</Text>}
        </Pressable>
        {step === "code" ? (
          <Pressable onPress={sendCode} disabled={loading} style={styles.resend}>
            <Text style={styles.backText}>Resend code</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  loadingView: { alignItems: "center", backgroundColor: "#f8fafc", flex: 1, justifyContent: "center" },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  backButton: { alignSelf: "flex-start", marginBottom: 32 },
  backText: { color: "#2563eb", fontSize: 14, fontWeight: "600" },
  title: { color: "#0f172a", fontSize: 28, fontWeight: "700" },
  subtitle: { color: "#64748b", fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 24 },
  input: { backgroundColor: "#fff", borderColor: "#cbd5e1", borderRadius: 12, borderWidth: 1, color: "#0f172a", fontSize: 16, paddingHorizontal: 16, paddingVertical: 14 },
  passwordFields: { gap: 12 },
  error: { color: "#dc2626", fontSize: 14, marginTop: 12 },
  action: { alignItems: "center", backgroundColor: "#2563eb", borderRadius: 12, marginTop: 20, paddingVertical: 14 },
  actionText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.55 },
  resend: { alignItems: "center", marginTop: 16 },
});