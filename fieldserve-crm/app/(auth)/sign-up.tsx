import { useAuth, useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { icons } from "@/constants/icons";
import { colors } from "@/constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Redirecting…</Text>
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
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Top 50% Screen Banner */}
          <View style={styles.headerSection}>
            <Image source={icons.logo} style={styles.headerImage} />
            <View style={styles.headerTextWrapper}>
              <Text style={styles.heading}>Create an Account</Text>
              <Text style={styles.subHeading}>
                Sign up to start managing your field service operations today.
              </Text>
            </View>
          </View>

          {/* Form Card Overlapping Header & Centered */}
          <View style={styles.cardWrapper}>
            {/* Step Counter Badge */}
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>STEP 1 OF 2</Text>
            </View>
            <View style={styles.cardContainer}>
              {stage === "form" ? (
                <>
                  {/* Pill Switcher */}
                  <View style={styles.pillWrapper}>
                    <Pressable
                      onPress={() => router.push("/(auth)/sign-in")}
                      disabled={loading}
                      style={styles.pillOption}
                    >
                      <Text style={styles.pillText}>Sign In</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {}} // Already on Sign Up
                      style={[styles.pillOption, styles.pillActive]}
                    >
                      <Text style={[styles.pillText, styles.pillTextActive]}>
                        Sign Up
                      </Text>
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={() => router.push("/(auth)/sign-up-google")}
                    disabled={loading}
                    style={({ pressed }) => [
                      styles.oauthButton,
                      loading && styles.buttonDisabled,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Image source={icons.google} style={styles.oauthIcon} />
                    <Text style={styles.oauthButtonText}>
                      Continue with Google
                    </Text>
                  </Pressable>

                  <Text style={styles.dividerText}>or</Text>

                  <View style={styles.row}>
                    <View style={styles.rowItem}>
                      <TextInput
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder="First Name"
                        placeholderTextColor="#94a3b8"
                        style={styles.input}
                      />
                    </View>
                    <View style={styles.rowItem}>
                      <TextInput
                        value={lastName}
                        onChangeText={setLastName}
                        placeholder="Last Name"
                        placeholderTextColor="#94a3b8"
                        style={styles.input}
                      />
                    </View>
                  </View>

                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="email"
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                  />

                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="Password (at least 8 characters)"
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
                </>
              ) : (
                <>
                  <Text style={styles.title}>Verify your email</Text>
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

                  <Pressable
                    onPress={() => {
                      setStage("form");
                      setCode("");
                      setError(null);
                    }}
                    style={styles.linkButton}
                  >
                    <Text style={styles.footerLink}>Back to sign up</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFB" },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, backgroundColor: "#F9FAFB" },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  loadingText: { marginTop: 12, color: "#64748b", fontSize: 14 },

  /* Top 50% Screen Banner */
  /* Takes exactly 50% of the screen height */
  headerSection: {
    height: SCREEN_HEIGHT * 0.45,
    backgroundColor: colors.primary || "#2563eb",
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  headerImage: {
    width: 500,
    height: 500,
    resizeMode: "contain",
    position: "absolute",
    top: -SCREEN_HEIGHT * 0.15,
    opacity: 0.4,
    zIndex: 0,
    marginBottom: 8,
    alignSelf: "center",
  },
  headerTextWrapper: {
    alignItems: "center",
  },
  heading: {
    fontSize: 38,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  subHeading: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.85)",
    textAlign: "center",
    maxWidth: 280,
  },

  /* Form Card Positioned to Overlap Banner Center */
  cardWrapper: {
    marginTop: -SCREEN_HEIGHT * 0.24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: "center",
  },
  cardContainer: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },

  /* Pill Switcher Styles */
  pillWrapper: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 9999,
    padding: 4,
    marginBottom: 20,
  },
  pillOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
  },
  pillActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  pillText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  pillTextActive: {
    color: "#0f172a",
  },

  /* Step Badge */
  stepBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 16,
  },
  stepBadgeText: {
    color: colors.primary || "#2563eb",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  title: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 4, marginBottom: 24 },
  row: { flexDirection: "row", gap: 12 },
  rowItem: { flex: 1 },
  label: { fontSize: 12, fontWeight: "500", color: "#64748b", marginBottom: 6 },
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
  error: { fontSize: 12, color: "#dc2626", marginTop: 4, marginBottom: 8 },
  button: {
    backgroundColor: colors.primary || "#2563eb",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: "#ffffff", fontWeight: "600", fontSize: 16 },
  oauthButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingVertical: 12,
  },
  oauthIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
    resizeMode: "contain",
  },
  oauthButtonText: { color: "#0f172a", fontWeight: "600", fontSize: 16 },
  dividerText: {
    textAlign: "center",
    marginVertical: 16,
    color: "#64748b",
    fontSize: 14,
  },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { fontSize: 14, color: "#64748b" },
  footerLink: { fontSize: 14, color: "#2563eb", fontWeight: "600" },
  linkButton: { alignItems: "center", marginTop: 16, paddingVertical: 8 },
});