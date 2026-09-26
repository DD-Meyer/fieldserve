import SignatureCanvas, { type SignatureViewRef } from "react-native-signature-canvas";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import BottomSheetModal from "./BottomSheetModal";
import { useIndemnitySign } from "../lib/hooks/useIndemnitySign";

type Props = {
  visible: boolean;
  jobId: number;
  indemnityText?: string;
  indemnitySource?: "text" | "pdf" | null;
  indemnityDocumentUrl?: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function IndemnitySigningModal({ visible, jobId, indemnityText, indemnitySource, indemnityDocumentUrl, onClose, onSuccess }: Props) {
  const signatureRef = useRef<SignatureViewRef>(null);
  const [signedName, setSignedName] = useState("");
  const [hasSignature, setHasSignature] = useState(false);
  const [drawingSignature, setDrawingSignature] = useState(false);
  const sign = useIndemnitySign();

  const submit = () => {
    if (!signedName.trim()) {
      Alert.alert("Name required", "Enter the client's full name before signing.");
      return;
    }
    if (!hasSignature) {
      Alert.alert("Signature required", "Ask the client to sign in the box before continuing.");
      return;
    }
    signatureRef.current?.readSignature();
  };

  const handleSignature = async (dataUrl: string) => {
    try {
      const base64 = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, "");
      const uri = `data:image/png;base64,${base64}`;
      await sign.mutateAsync({
        jobId,
        signedName: signedName.trim(),
        signature: { uri, name: `job-${jobId}-signature.png`, type: "image/png" },
      });
      setSignedName("");
      setHasSignature(false);
      onSuccess();
    } catch (error: any) {
      Alert.alert("Signature could not be saved", error?.message ?? "Please try again.");
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View className="bg-white rounded-t-2xl px-5 pt-8 max-h-[88%]">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          scrollEnabled={!drawingSignature}
          contentContainerStyle={{ paddingBottom: 96 }}
        >
          <Text className="text-lg font-bold text-slate-900">Client indemnity</Text>
          <Text className="text-xs leading-5 text-slate-500 mt-1">
            The client must read the active indemnity and sign below before work begins.
          </Text>
          <Pressable
            onPress={() => indemnityDocumentUrl ? void Linking.openURL(indemnityDocumentUrl) : undefined}
            className="border border-slate-200 bg-slate-50 rounded-xl mt-4 p-3"
            accessibilityLabel="View current indemnity"
          >
            <Text className="text-xs font-bold text-slate-700 mb-1">
              Current indemnity {indemnitySource === "pdf" ? "PDF" : "text"}
            </Text>
            <Text className="text-xs leading-5 text-slate-600">
              {indemnityText || (indemnitySource === "pdf" && indemnityDocumentUrl ? "Tap to open the current indemnity PDF." : "The current indemnity text is unavailable. Ask an admin to publish an indemnity document.")}
            </Text>
            {indemnitySource === "pdf" && indemnityDocumentUrl ? <Text className="text-xs font-semibold text-blue-600 mt-2">Tap to open PDF</Text> : null}
          </Pressable>
          <TextInput
          value={signedName}
          onChangeText={setSignedName}
          placeholder="Client full name"
          autoCapitalize="words"
          className="border border-slate-200 rounded-xl px-3 py-3 text-slate-900 mt-4"
          />
          <View className="h-36 border border-slate-300 rounded-xl overflow-hidden mt-3">
          <SignatureCanvas
            ref={signatureRef}
            onOK={(value) => void handleSignature(value)}
            onBegin={() => {
              setHasSignature(true);
              setDrawingSignature(true);
            }}
            onEnd={() => setDrawingSignature(false)}
            descriptionText="Sign here"
            clearText="Clear"
            confirmText="Use signature"
            autoClear={false}
            webStyle={`.m-signature-pad--footer { display: none; } .m-signature-pad { box-shadow: none; border: 0; } body,html { width: 100%; height: 100%; }`}
          />
          </View>
          <View className="flex-row gap-3 mt-4">
            <Pressable onPress={onClose} className="flex-1 border border-slate-200 rounded-xl py-3 items-center">
              <Text className="text-sm font-semibold text-slate-700">Cancel</Text>
            </Pressable>
            <Pressable onPress={() => signatureRef.current?.clearSignature()} className="flex-1 border border-slate-200 rounded-xl py-3 items-center">
              <Text className="text-sm font-semibold text-slate-700">Clear</Text>
            </Pressable>
            <Pressable onPress={submit} disabled={sign.isPending} className="flex-1 bg-blue-600 rounded-xl py-3 items-center">
              {sign.isPending ? <ActivityIndicator color="white" /> : <Text className="text-sm font-semibold text-white">Save signature</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </BottomSheetModal>
  );
}
