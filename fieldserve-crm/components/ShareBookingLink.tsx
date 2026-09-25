// Page where users can share the booking link with others. This component uses the Web Share API if available, otherwise it falls back to copying the link to the clipboard.
import { Alert, Pressable, Text, View } from "react-native";

import { useCurrentBusiness } from "@/lib/hooks/useBusiness";
import { getBookingLink } from "@/lib/publicBookingUrl";

// Show options to embed or share a link for booking a service with FieldServe. Uses the Web Share API if available, otherwise falls back to copying the link to the clipboard.
export default function ShareBookingLink() {
    const { data: companyProfile } = useCurrentBusiness();
    const bookingLink = getBookingLink(companyProfile?.slug);


    return (
        <>
        <View className="p-4">
            <Text className="text-lg font-semibold mb-2">Share Booking Link</Text>
            <Text className="text-sm text-slate-500 mb-4">
                Share this link to allow others to book services with your company:
            </Text>
            <Pressable
                onPress={async () => {
                    if (!bookingLink) {
                        Alert.alert("Booking link unavailable", "Configure the production public URL before sharing bookings.");
                        return;
                    }
                    if (navigator.share) {
                        try {
                            await navigator.share({
                                title: "Book a Service with FieldServe",
                                text: "Book a service with our company using FieldServe.",
                                url: bookingLink,
                            });
                        } catch (error) {
                            console.error("Error sharing:", error);
                        }
                    } else {
                        try {
                            await navigator.clipboard.writeText(bookingLink);
                            Alert.alert("Copied to clipboard", "The booking link has been copied to your clipboard.");
                        } catch (error) {
                            console.error("Error copying to clipboard:", error);
                        }
                    }
                }}
                className="px-4 py-2 bg-blue-600 rounded-full"
            >
                <Text className="text-white font-semibold">Share Booking Link</Text>
            </Pressable>
        </View>
        </>
    );
}