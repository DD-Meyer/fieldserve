import { useState } from "react";
import { Alert, Modal, Platform, Pressable, Share, Text, TextInput, View } from "react-native";

import { useCompany } from "../lib/hooks/useCompany";
import { getBookingLink } from "../lib/publicBookingUrl";

type Props = {
  visible: boolean;
  onClose: () => void;
};

async function copyText(text: string, successTitle: string) {
  const nav =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { clipboard?: { writeText?: (t: string) => Promise<void> } })
      : undefined;
  if (nav?.clipboard?.writeText) {
    await nav.clipboard.writeText(text);
    Alert.alert(successTitle, "Copied to your clipboard.");
    return;
  }
  // Native platforms without a clipboard API available: fall back to the share sheet.
  await Share.share({ message: text });
}

export default function ShareBookingModal({ visible, onClose }: Props) {
  const { data: companyProfile } = useCompany();
  const [tab, setTab] = useState<"link" | "embed">("link");

  const bookingLink = getBookingLink(companyProfile?.slug);
  const embedCode = bookingLink
    ? `<iframe src="${bookingLink}" width="100%" height="800" style="border:0"></iframe>`
    : "";

  const shareLink = async () => {
    if (!bookingLink) return;
    if (Platform.OS !== "web") {
      await Share.share({
        title: "Book a service",
        message: `Book a service with ${companyProfile?.name ?? "us"}: ${bookingLink}`,
        url: bookingLink,
      });
      return;
    }
    await copyText(bookingLink, "Link copied");
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-xl p-5">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-lg font-bold text-slate-900">Share booking page</Text>
            <Pressable onPress={onClose}>
              <Text className="text-slate-500 text-sm">Close</Text>
            </Pressable>
          </View>

          {!companyProfile?.slug ? (
            <Text className="text-xs text-red-600 mt-2">
              Save your company profile before sharing a booking link.
            </Text>
          ) : (
            <>
              <View className="flex-row gap-2 mt-4 mb-4">
                {(["link", "embed"] as const).map((candidate) => (
                  <Pressable
                    key={candidate}
                    onPress={() => setTab(candidate)}
                    className={`flex-1 rounded-lg py-2 items-center border ${tab === candidate ? "bg-blue-600 border-blue-600" : "border-slate-200"}`}
                  >
                    <Text className={`text-xs font-semibold ${tab === candidate ? "text-white" : "text-slate-700"}`}>
                      {candidate === "link" ? "Booking link" : "Embed code"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {tab === "link" ? (
                <View>
                  <Text className="text-xs text-slate-500 mb-2">
                    Customers who open this link can book services and pick a time themselves.
                  </Text>
                  <TextInput
                    value={bookingLink}
                    editable={false}
                    multiline
                    className="border border-slate-200 rounded-lg px-3 py-3 text-xs text-slate-700 mb-3"
                  />
                  <Pressable onPress={shareLink} className="bg-blue-600 rounded-lg py-3 items-center">
                    <Text className="text-sm font-semibold text-white">
                      {Platform.OS === "web" ? "Copy link" : "Share link"}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View>
                  <Text className="text-xs text-slate-500 mb-2">
                    Paste this snippet into your website to embed the booking form.
                  </Text>
                  <TextInput
                    value={embedCode}
                    editable={false}
                    multiline
                    className="border border-slate-200 rounded-lg px-3 py-3 text-xs text-slate-700 mb-3 font-mono"
                    style={{ minHeight: 90, textAlignVertical: "top" }}
                  />
                  <Pressable
                    onPress={() => copyText(embedCode, "Embed code copied")}
                    className="bg-blue-600 rounded-lg py-3 items-center"
                  >
                    <Text className="text-sm font-semibold text-white">Copy code</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
