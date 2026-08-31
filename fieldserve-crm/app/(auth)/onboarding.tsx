import { useAuth, useClerk, useUser } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import {
  ActivityIndicator,
  Dimensions,
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
import { colors } from "@/constants/theme";
import { icons } from "@/constants/icons";
import { Image } from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

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

  console.log("GOOGLE API KEY:", process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);

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
              <Text style={styles.heading}>Setup Your Business</Text>
              <Text style={styles.subHeading}>
                Configure your workspace details to start accepting jobs.
              </Text>
            </View>
          </View>

          {/* Form Card Overlapping Header */}
          <View style={styles.cardWrapper}>
            <View style={styles.cardContainer}>
              {/* Step Counter Badge */}
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>STEP 2 OF 2</Text>
              </View>

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

              <View style={{ position: "relative", zIndex: 1000, elevation: 1000 }}>
                <Text style={styles.label}>Company Address</Text>
                <GooglePlacesAutocomplete
                  placeholder="e.g. 123 Main St, Johannesburg"
                  fetchDetails={true}
                  disableScroll={true} //  Fixes the VirtualizedList inside ScrollView error
                  minLength={2}
                  debounce={300}
                  onPress={(data, details = null) => {
                    const fullAddress = data.description;
                    const lat = details?.geometry?.location?.lat;
                    const lng = details?.geometry?.location?.lng;

                    console.log("Selected Address:", fullAddress);
                    console.log("Coordinates:", lat, lng);
                  }}
                  query={{
                    key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
                    language: "en",
                    components: "country:za",
                  }}
                  styles={{
                    container: {
                      flex: 0,
                      width: "100%",
                      zIndex: 1000,
                    },
                    textInput: styles.input,
                    listView: {
                      position: "absolute",
                      top: 50,
                      left: 0,
                      right: 0,
                      backgroundColor: "#ffffff",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#e2e8f0",
                      elevation: 5,
                      zIndex: 9999,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                    },
                    row: {
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                    },
                    description: {
                      color: "#0f172a",
                      fontSize: 14,
                    },
                  }}
                  textInputProps={{
                    placeholderTextColor: "#94a3b8",
                  }}
                />
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

  /* Banner Layout */
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

  /* Card Layout & Shadow */
  cardWrapper: {
    marginTop: -SCREEN_HEIGHT * 0.22,
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
  modeButtonSelected: { borderColor: colors.primary || "#2563eb", backgroundColor: "#eff6ff" },
  modeText: { color: "#64748b", fontWeight: "600" },
  modeTextSelected: { color: colors.primary || "#2563eb" },
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
});