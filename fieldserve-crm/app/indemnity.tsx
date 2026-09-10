import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import ScreenScaffold from "../components/ScreenScaffold";
import { useCurrentBusiness } from "../lib/hooks/useBusiness";
import {
  type Indemnity,
  useArchiveIndemnity,
  useCreatePdfIndemnity,
  useCreateTextIndemnity,
  useIndemnities,
  usePublishIndemnity,
} from "../lib/hooks/useIndemnities";

function errorMessage(error: any) {
  const body = error?.body;
  if (typeof body === "string") return body;
  if (body?.detail) return String(body.detail);
  return error?.message || "Something went wrong.";
}

function statusStyle(status: Indemnity["status"]) {
  if (status === "published") return { label: "Active", bg: "bg-green-100", text: "text-green-700" };
  if (status === "draft") return { label: "Draft", bg: "bg-amber-100", text: "text-amber-700" };
  return { label: "Archived", bg: "bg-slate-100", text: "text-slate-600" };
}

export default function IndemnityScreen() {
  const { data: business } = useCurrentBusiness();
  const isAdmin = business?.role === "admin";
  const documents = useIndemnities(isAdmin);
  const createText = useCreateTextIndemnity();
  const createPdf = useCreatePdfIndemnity();
  const publish = usePublishIndemnity();
  const archive = useArchiveIndemnity();
  const [editorOpen, setEditorOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createDraft = async () => {
    if (!business || !text.trim()) {
      setError("Enter the indemnity text before saving a draft.");
      return;
    }
    setError(null);
    try {
      await createText.mutateAsync({ business: business.id, text: text.trim() });
      setText("");
      setEditorOpen(false);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const selectPdf = async () => {
    if (!business) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      await createPdf.mutateAsync({
        business: business.id,
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || "application/pdf",
      });
    } catch (requestError) {
      Alert.alert("PDF not uploaded", errorMessage(requestError));
    }
  };

  const publishDocument = (document: Indemnity) => {
    Alert.alert(
      "Publish indemnity",
      `Make version ${document.version} the active document for all new bookings?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Publish",
          onPress: async () => {
            try {
              await publish.mutateAsync(document.id);
            } catch (requestError) {
              Alert.alert("Document not published", errorMessage(requestError));
            }
          },
        },
      ],
    );
  };

  const archiveDocument = (document: Indemnity) => {
    Alert.alert("Archive indemnity", `Archive version ${document.version}? Existing bookings keep their copy.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        style: "destructive",
        onPress: async () => {
          try {
            await archive.mutateAsync(document.id);
          } catch (requestError) {
            Alert.alert("Document not archived", errorMessage(requestError));
          }
        },
      },
    ]);
  };

  return (
    <ScreenScaffold
      title="Indemnity Settings"
      subtitle="Published versions are attached to new bookings and remain unchanged in history."
      rightAction={isAdmin ? { label: "New text", onPress: () => setEditorOpen(true) } : undefined}
    >
      {!isAdmin ? (
        <View className="bg-white rounded-xl border border-slate-200 p-5">
          <Text className="text-sm font-semibold text-slate-900">Admin access required</Text>
          <Text className="text-xs text-slate-500 mt-1">Only Admins can manage indemnity documents.</Text>
        </View>
      ) : (
        <>
          <View className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <Text className="text-xs text-amber-900">New bookings require the currently active indemnity. Clients sign it on the staff device after the vehicle walkaround.</Text>
          </View>

          <Pressable onPress={selectPdf} disabled={createPdf.isPending} className="border border-blue-200 bg-blue-50 rounded-lg py-3 items-center mb-4">
            {createPdf.isPending ? <ActivityIndicator color="#2563eb" /> : <Text className="text-sm font-semibold text-blue-700">Upload PDF version</Text>}
          </Pressable>

          {documents.isLoading ? (
            <View className="bg-white rounded-xl border border-slate-200 p-6 items-center"><ActivityIndicator /></View>
          ) : documents.error ? (
            <View className="bg-white rounded-xl border border-slate-200 p-5"><Text className="text-sm text-red-600">{errorMessage(documents.error)}</Text></View>
          ) : (documents.data?.length ?? 0) === 0 ? (
            <View className="bg-white rounded-xl border border-slate-200 p-5">
              <Text className="text-sm font-semibold text-slate-900">No indemnity published</Text>
              <Text className="text-xs text-slate-500 mt-1">Create text or upload a PDF, then publish it before creating bookings.</Text>
            </View>
          ) : (
            <View className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {documents.data?.map((document, index) => {
                const tone = statusStyle(document.status);
                return (
                  <View key={document.id} className={`p-4 ${index ? "border-t border-slate-100" : ""}`}>
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="text-sm font-semibold text-slate-900">Version {document.version}</Text>
                        <Text className="text-xs text-slate-500 mt-0.5">{document.source === "pdf" ? "PDF upload" : "Text document"}</Text>
                      </View>
                      <View className={`px-2 py-0.5 rounded-full ${tone.bg}`}><Text className={`text-[10px] font-semibold ${tone.text}`}>{tone.label}</Text></View>
                    </View>
                    {document.source === "text" ? <Text numberOfLines={2} className="text-xs text-slate-600 mt-3">{document.text}</Text> : null}
                    {document.status === "draft" ? (
                      <Pressable onPress={() => publishDocument(document)} disabled={publish.isPending} className="mt-3 self-start"><Text className="text-xs font-semibold text-blue-600">Publish version</Text></Pressable>
                    ) : document.status === "published" ? (
                      <Pressable onPress={() => archiveDocument(document)} disabled={archive.isPending} className="mt-3 self-start"><Text className="text-xs font-semibold text-red-600">Archive version</Text></Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

      <Modal visible={editorOpen} transparent animationType="fade" onRequestClose={() => setEditorOpen(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-xl p-5">
            <Text className="text-lg font-bold text-slate-900">New text indemnity</Text>
            <Text className="text-xs text-slate-500 mt-1 mb-4">Saving creates a draft version. Publish it when the wording is ready.</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
              placeholder="Enter the indemnity wording..."
              className="border border-slate-200 rounded-lg px-3 py-3 text-slate-900 min-h-40"
            />
            {error ? <Text className="text-xs text-red-600 mt-3">{error}</Text> : null}
            <View className="flex-row gap-3 mt-5">
              <Pressable onPress={() => setEditorOpen(false)} className="flex-1 border border-slate-200 rounded-lg py-3 items-center"><Text className="text-sm font-semibold text-slate-700">Cancel</Text></Pressable>
              <Pressable onPress={createDraft} disabled={createText.isPending} className="flex-1 bg-blue-600 rounded-lg py-3 items-center">
                {createText.isPending ? <ActivityIndicator color="white" /> : <Text className="text-sm font-semibold text-white">Save draft</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenScaffold>
  );
}
