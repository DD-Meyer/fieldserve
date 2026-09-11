import { Alert, Platform, Share } from "react-native";
import { useCompany } from "@/lib/hooks/useCompany";
import { getBookingLink } from "@/lib/publicBookingUrl";

export function useShareBooking() {
  const { data: companyProfile } = useCompany();

  const bookingLink = getBookingLink(companyProfile?.slug);

  const handleShare = async () => {
    if (!companyProfile?.slug) {
      Alert.alert(
        "Company not set up",
        "Save your company profile before sharing a booking link.",
      );
      return;
    }

    try {
      if (Platform.OS !== "web") {
        await Share.share({
          title: "Book a service",
          message: `Book a service with ${companyProfile.name}: ${bookingLink}`,
          url: bookingLink,
        });
        return;
      }

      if (typeof navigator !== "undefined" && "share" in navigator) {
        await (navigator as Navigator).share({
          title: "Book a service",
          text: `Book a service with ${companyProfile.name}.`,
          url: bookingLink,
        });
        return;
      }

      const nav =
        typeof navigator !== "undefined"
          ? (navigator as Navigator & { clipboard?: { writeText?: (t: string) => Promise<void> } })
          : undefined;
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(bookingLink);
        Alert.alert(
          "Link copied",
          "The booking link is on your clipboard — paste it into an email or message.",
        );
        return;
      }

      Alert.alert("Share unavailable", bookingLink);
    } catch (error) {
      console.error("Error sharing booking link:", error);
    }
  };

  return { handleShare, bookingLink };
}
