import { useAuth, useClerk, useUser } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
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

export default function OnboardingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { getToken: authGetToken } = useAuth();
  const { createOrganization, getOrganization, setActive } = useClerk();
  const { user } = useUser();
  const [companyName, setCompanyName] = useState("");
  const [industryMode, setIndustryMode] = useState<"fixed" | "mobile">("fixed");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const completeOnboarding = async () => {
    if (!companyName.trim()) {
      setError("Please enter a valid company name");
      return;
    }
    if (!authGetToken) {
      setError("Authentication not ready. Please try again.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const organization = organizationId
        ? await getOrganization(organizationId)
        : await createOrganization({ name: companyName.trim() });
      setOrganizationId(organization.id);
      await setActive({ organization: organization.id });

      const token = await authGetToken();
      if (!token) {
        throw new Error("Failed to obtain authentication token.");
      }
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/v1/users/onboard/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            company_name: companyName.trim(),
            industry_mode: industryMode,
            organization_id: organization.id,
          }),
        }
      );

      if (!response.ok) {
        const responseText = await response.text();
        let detail = responseText;
        try {
          const errData = JSON.parse(responseText);
          detail = errData.detail || responseText;
        } catch {
          // Keep the raw response when the server returns HTML or plain text.
        }
        throw new Error(detail || `Request failed (${response.status}).`);
      }

      if (user) {
        await user.update({
          unsafeMetadata: { onboarded: true },
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
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
          <Text style={styles.title}>Company Setup</Text>
          <Text style={styles.subtitle}>
            Enter your business details to complete registration
          </Text>

          <Text style={styles.label}>Company / Business Name</Text>
          <TextInput
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="e.g. Apex Auto Detailing"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <Text style={styles.label}>Operation Mode</Text>
          <View style={styles.modeContainer}>
            <Pressable
              onPress={() => setIndustryMode("fixed")}
              style={[
                styles.modeButton,
                industryMode === "fixed" && styles.modeButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.modeText,
                  industryMode === "fixed" && styles.modeTextSelected,
                ]}
              >
                Fixed Location
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setIndustryMode("mobile")}
              style={[
                styles.modeButton,
                industryMode === "mobile" && styles.modeButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.modeText,
                  industryMode === "mobile" && styles.modeTextSelected,
                ]}
              >
                Mobile Service
              </Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={completeOnboarding}
            disabled={loading || !companyName.trim()}
            style={({ pressed }) => [
              styles.button,
              (loading || !companyName.trim()) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Complete Setup</Text>
            )}
          </Pressable>
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
  modeContainer: { flexDirection: "row", gap: 12, marginBottom: 16 },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  modeButtonSelected: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  modeText: { color: "#64748b", fontWeight: "600" },
  modeTextSelected: { color: "#2563eb" },
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
});