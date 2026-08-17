import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import ScreenScaffold from "../components/ScreenScaffold";
import {
  useCreateService,
  useDeleteService,
  useServices,
  useUpdateService,
  type Service,
  type ServiceInput,
} from "../lib/hooks/useServices";

type EditorState =
  | { mode: "closed" }
  | { mode: "new" }
  | { mode: "edit"; service: Service };

export default function ServicesScreen() {
  const { data, isLoading, error } = useServices();
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const services = data?.results ?? [];

  return (
    <ScreenScaffold
      title="Services"
      subtitle="Bookable services shown on your public booking page"
      rightAction={{ label: "+ Add", onPress: () => setEditor({ mode: "new" }) }}
    >
      {isLoading ? (
        <View className="bg-white rounded-2xl p-6 items-center border border-slate-200">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="bg-white rounded-2xl p-6 border border-slate-200">
          <Text className="text-xs text-red-600">Could not load services.</Text>
        </View>
      ) : services.length === 0 ? (
        <View className="bg-white rounded-2xl p-6 border border-slate-200">
          <Text className="text-slate-500 text-sm">
            {'No services yet. Tap "+ Add" to create your first one.'}
          </Text>
        </View>
      ) : (
        <View className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {services.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => setEditor({ mode: "edit", service: s })}
              className={
                "px-4 py-3.5 flex-row items-center active:bg-slate-50 " +
                (i < services.length - 1 ? "border-b border-slate-100" : "")
              }
            >
              <View className="flex-1 pr-3">
                <View className="flex-row items-center">
                  <Text className="text-[15px] font-semibold text-slate-900">
                    {s.name}
                  </Text>
                  {!s.is_active ? (
                    <View className="ml-2 px-2 py-0.5 rounded-full bg-slate-100">
                      <Text className="text-[10px] text-slate-500">Disabled</Text>
                    </View>
                  ) : null}
                </View>
                {s.description ? (
                  <Text
                    className="text-xs text-slate-500 mt-0.5"
                    numberOfLines={1}
                  >
                    {s.description}
                  </Text>
                ) : null}
                <Text className="text-[11px] text-slate-400 mt-0.5">
                  {s.duration_minutes} min
                </Text>
              </View>
              <Text className="text-sm font-semibold text-slate-900">
                ${Number(s.price).toFixed(2)}
              </Text>
              <Text className="text-slate-400 text-lg ml-2">›</Text>
            </Pressable>
          ))}
        </View>
      )}

      <ServiceEditor
        state={editor}
        onClose={() => setEditor({ mode: "closed" })}
      />
    </ScreenScaffold>
  );
}

function ServiceEditor({
  state,
  onClose,
}: {
  state: EditorState;
  onClose: () => void;
}) {
  const create = useCreateService();
  const update = useUpdateService();
  const del = useDeleteService();

  const service = state.mode === "edit" ? state.service : null;
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [duration, setDuration] = useState(
    String(service?.duration_minutes ?? 60),
  );
  const [price, setPrice] = useState(
    service ? String(Number(service.price).toFixed(2)) : "0.00",
  );
  const [isActive, setIsActive] = useState(service?.is_active ?? true);
  const [err, setErr] = useState<string | null>(null);

  const key = state.mode === "edit" ? state.service.id : state.mode;
  const prevKey = useRef(key);
  useEffect(() => {
    if (prevKey.current === key) return;
    prevKey.current = key;
    setName(service?.name ?? "");
    setDescription(service?.description ?? "");
    setDuration(String(service?.duration_minutes ?? 60));
    setPrice(service ? String(Number(service.price).toFixed(2)) : "0.00");
    setIsActive(service?.is_active ?? true);
    setErr(null);
  }, [key, service]);

  if (state.mode === "closed") return null;

  const submit = async () => {
    setErr(null);
    const payload: ServiceInput = {
      name: name.trim(),
      description: description.trim(),
      duration_minutes: Math.max(1, parseInt(duration, 10) || 60),
      price: parseFloat(price) || 0,
      is_active: isActive,
    };
    if (!payload.name) {
      setErr("Name is required.");
      return;
    }
    try {
      if (state.mode === "edit") {
        await update.mutateAsync({ id: state.service.id, payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Could not save.");
    }
  };

  const remove = () => {
    if (state.mode !== "edit") return;
    Alert.alert(
      "Delete service?",
      `"${state.service.name}" will no longer appear on your booking page.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await del.mutateAsync(state.service.id);
              onClose();
            } catch (e: any) {
              setErr(e?.message || "Could not delete.");
            }
          },
        },
      ],
    );
  };

  const busy = create.isPending || update.isPending || del.isPending;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl p-5">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-slate-900">
              {state.mode === "edit" ? "Edit service" : "New service"}
            </Text>
            <Pressable onPress={onClose}>
              <Text className="text-slate-500 text-base">Close</Text>
            </Pressable>
          </View>

          <Field label="Name" value={name} onChange={setName} placeholder="Interior deep clean" />
          <Field
            label="Description"
            value={description}
            onChange={setDescription}
            placeholder="What's included"
            multiline
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field
                label="Duration (min)"
                value={duration}
                onChange={setDuration}
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <Field
                label="Price ($)"
                value={price}
                onChange={setPrice}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View className="flex-row items-center justify-between py-2">
            <Text className="text-sm text-slate-700 font-medium">
              Active (visible on booking page)
            </Text>
            <Switch value={isActive} onValueChange={setIsActive} />
          </View>

          {err ? (
            <Text className="text-xs text-red-600 mt-2">{err}</Text>
          ) : null}

          <View className="flex-row gap-3 mt-4">
            {state.mode === "edit" ? (
              <Pressable
                onPress={remove}
                disabled={busy}
                className="flex-1 border border-red-300 rounded-full py-3 items-center"
              >
                <Text className="text-red-600 text-sm font-semibold">Delete</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={submit}
              disabled={busy}
              className="flex-1 bg-blue-600 rounded-full py-3 items-center"
              style={busy ? { opacity: 0.5 } : undefined}
            >
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-sm font-semibold">
                  {state.mode === "edit" ? "Save" : "Create"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad" | "decimal-pad";
  multiline?: boolean;
}) {
  return (
    <View className="mb-3">
      <Text className="text-xs font-semibold text-slate-600 mb-1">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900"
        style={multiline ? { minHeight: 60, textAlignVertical: "top" } : undefined}
      />
    </View>
  );
}
