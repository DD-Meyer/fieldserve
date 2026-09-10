import { useAuth, useSignIn, useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { icons } from "@/constants/icons";
import { colors } from "@/constants/theme";
import { useMe } from "../../lib/hooks/useMe";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Stage = "form" | "sign-in-verify" | "sign-up-verify";

function isAlreadySignedInError(error: any) {
  const clerkErrors = error?.errors ?? [];
  const message = `${clerkErrors[0]?.longMessage ?? ""} ${clerkErrors[0]?.message ?? ""} ${error?.message ?? ""}`;

  return clerkErrors.some((clerkError: any) => clerkError?.code === "already_signed_in") ||
    message.toLowerCase().includes("already signed in");
}

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");

  // Clerk Hooks
  const { isLoaded: isAuthLoaded, isSignedIn, signOut } = useAuth();
  const { signIn, setActive: setSignInActive, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: isSignUpLoaded } = useSignUp();
  const { data: me, isLoading: isMeLoading } = useMe();

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn) return;
    if (isMeLoading) return;

    const hasBusiness = me?.memberships.some(
      (membership) => membership.status === "active",
    );
    router.replace(hasBusiness ? "/(tabs)" : "/(auth)/onboarding");
  }, [isAuthLoaded, isMeLoading, isSignedIn, me, router]);

  // Show loading spinner ONLY while Clerk SDK itself is initializing
  if (!isAuthLoaded || isSignedIn) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const finishSignInSession = async (createdSessionId: string | null) => {
    if (!createdSessionId) {
      setError("Sign-in succeeded but no session was created.");
      return;
    }
    if (!setSignInActive) {
      setError("Sign-in is not ready to activate the session.");
      return;
    }
    await setSignInActive({ session: createdSessionId });
    router.replace("/(tabs)");
  };

  const startSignInMfa = async () => {
    if (!signIn) return;
    const factor = signIn.supportedSecondFactors?.find(
      (secondFactor) => secondFactor.strategy === "email_code",
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
    setStage("sign-in-verify");
  };

  const handleSignIn = async () => {
    if (!isAuthLoaded || isSignedIn) {
      router.replace("/(tabs)");
      return;
    }
    if (!isSignInLoaded || !signIn) return;
    setError(null);
    setLoading(true);
    try {
      let attempt = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (
        attempt.status !== "complete" &&
        attempt.supportedFirstFactors?.some((factor) => factor.strategy === "password")
      ) {
        attempt = await signIn.attemptFirstFactor({
          strategy: "password",
          password,
        });
      }

      if (attempt.status === "complete") {
        await finishSignInSession(attempt.createdSessionId);
      } else if (attempt.status === "needs_second_factor") {
        await startSignInMfa();
      } else {
        console.log("[FieldServe] sign-in incomplete", attempt.status, attempt);
        setError(`Sign-in not complete (status: ${attempt.status}).`);
      }
    } catch (e: any) {
      console.log("[FieldServe] sign-in error", e);
      if (isAlreadySignedInError(e)) {
        await signOut();
        setError("The previous account was signed out. Sign in again to switch accounts.");
        return;
      }

      setError(e?.errors?.[0]?.longMessage || e?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const startSignUp = async () => {
    if (!isSignUpLoaded || !signUp) return;
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
        await setSignUpActive({ session: createdSignUp.createdSessionId });
        router.replace("/(auth)/onboarding");
        return;
      }

      await createdSignUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });
      setStage("sign-up-verify");
    } catch (e: any) {
      if (isAlreadySignedInError(e)) {
        await signOut();
        setError("The previous account was signed out. Sign in again to switch accounts.");
        return;
      }

      setError(e?.errors?.[0]?.longMessage || e?.message || "Sign-up failed");
    } finally {
      setLoading(false);
    }
  };

  const confirmSignInCode = async () => {
    if (!isSignInLoaded || !signIn) return;
    setError(null);
    setLoading(true);
    try {
      const attempt = await signIn.attemptSecondFactor({
        strategy: "email_code",
        code: code.trim(),
      });
      if (attempt.status === "complete") {
        await finishSignInSession(attempt.createdSessionId);
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

  const confirmCode = async () => {
    if (!isSignUpLoaded || !signUp) return;
    setError(null);
    setLoading(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });
      if (attempt.status === "complete") {
        await setSignUpActive({ session: attempt.createdSessionId });
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

  const switchMode = (newMode: "sign-in" | "sign-up") => {
    if (mode === newMode) return;
    setError(null);
    setMode(newMode);
    setStage("form");
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
          {/* Header Banner */}
          <View style={styles.headerSection}>
            <Image source={icons.logo} style={styles.headerImage} />
            <View style={styles.headerTextWrapper}>
              <Text style={styles.heading}>
                {mode === "sign-in" ? "Sign in to your Account" : "Sign Up"}
              </Text>
              <Text style={styles.subHeading}>
                {mode === "sign-in"
                  ? "Sign in to access your field operations workspace."
                  : "Create an account to manage your field services."}
              </Text>
            </View>
          </View>

          {/* Animated Card Container */}
          <View style={styles.cardWrapper}>
            <Animated.View layout={Layout.springify()} style={styles.cardContainer}>
              {/* Segmented Pill Control */}
              <View style={styles.pillWrapper}>
                <Pressable
                  onPress={() => switchMode("sign-in")}
                  style={[
                    styles.pillOption,
                    mode === "sign-in" && styles.pillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      mode === "sign-in" && styles.pillTextActive,
                    ]}
                  >
                    Sign In
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => switchMode("sign-up")}
                  style={[
                    styles.pillOption,
                    mode === "sign-up" && styles.pillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      mode === "sign-up" && styles.pillTextActive,
                    ]}
                  >
                    Sign Up
                  </Text>
                </Pressable>
              </View>

              {/* OAuth Button */}
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

              <Text style={styles.dividerText}>or continue with email</Text>

              {/* Form Views */}
              {stage !== "form" ? (
                <Animated.View key="verify-stage" entering={FadeIn} exiting={FadeOut}>
                  <Text style={styles.title}>Verify your email</Text>
                  <Text style={styles.subtitle}>
                    We sent a code to {email}
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
                    onPress={stage === "sign-in-verify" ? confirmSignInCode : confirmCode}
                    disabled={loading || !code}
                    style={styles.button}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Verify</Text>
                    )}
                  </Pressable>
                </Animated.View>
              ) : (
                <Animated.View key={mode} entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                  {/* Name fields only show on sign up */}
                  {mode === "sign-up" && (
                    <Animated.View
                      entering={FadeIn.duration(200)}
                      exiting={FadeOut.duration(150)}
                      style={styles.row}
                    >
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
                    </Animated.View>
                  )}

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
                    placeholder={
                      mode === "sign-up" ? "At least 8 characters" : "••••••••"
                    }
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                  />

                  {mode === "sign-in" ? (
                    <Pressable
                      onPress={() => router.push("/(auth)/forgot-password")}
                      style={styles.forgotPassword}
                    >
                      <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                    </Pressable>
                  ) : null}

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <Pressable
                    onPress={mode === "sign-in" ? handleSignIn : startSignUp}
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
                      <Text style={styles.buttonText}>
                        {mode === "sign-in" ? "Sign In" : "Create Account"}
                      </Text>
                    )}
                  </Pressable>
                </Animated.View>
              )}
            </Animated.View>
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
  forgotPassword: { alignSelf: "flex-end", marginTop: -8, marginBottom: 16 },
  forgotPasswordText: { color: colors.primary || "#2563eb", fontSize: 13, fontWeight: "600" },
  headerSection: {
    height: SCREEN_HEIGHT * 0.42,
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
  headerTextWrapper: { alignItems: "center" },
  heading: {
    fontSize: 30,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  subHeading: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.85)",
    textAlign: "center",
    maxWidth: 280,
  },
  cardWrapper: {
    marginTop: -SCREEN_HEIGHT * 0.22,
    paddingHorizontal: 20,
    paddingBottom: 20,
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
    overflow: "hidden",
  },
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
  pillText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  pillTextActive: { color: "#0f172a" },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 4, marginBottom: 20 },
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
    marginBottom: 14,
    fontSize: 16,
  },
  error: { fontSize: 12, color: "#dc2626", marginTop: 2, marginBottom: 8 },
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
  oauthIcon: { width: 20, height: 20, marginRight: 10, resizeMode: "contain" },
  oauthButtonText: { color: "#0f172a", fontWeight: "600", fontSize: 16 },
  dividerText: {
    textAlign: "center",
    marginVertical: 16,
    color: "#94a3b8",
    fontSize: 13,
  },
});