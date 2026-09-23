import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

const API_BASE = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "") ?? "";

type Prediction = { place_id: string; description: string };

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  onSelect: (result: { description: string; latitude: number | null; longitude: number | null }) => void;
  placeholder?: string;
};

// Web-only replacement for react-native-google-places-autocomplete (which
// crashes the Metro web bundle) — proxies through our backend so the Places
// API key never reaches the browser.
export default function AddressAutocompleteWeb({ value, onChangeText, onSelect, placeholder }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!API_BASE || value.trim().length < 2) {
      setPredictions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/public/places/autocomplete/?input=${encodeURIComponent(value.trim())}`,
          { cache: "no-store" },
        );
        const data = res.ok ? await res.json() : { predictions: [] };
        setPredictions(data.predictions ?? []);
        setOpen(true);
      } catch {
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const pick = async (prediction: Prediction) => {
    setOpen(false);
    onChangeText(prediction.description);
    if (!API_BASE) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/public/places/details/?place_id=${encodeURIComponent(prediction.place_id)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = await res.json();
      onSelect({
        description: data.description || prediction.description,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      });
    } catch {
      // Address text is already set; lat/lng simply stays unset on failure.
    }
  };

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          setOpen(true);
        }}
        onFocus={() => setOpen(predictions.length > 0)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900"
      />
      {loading ? (
        <ActivityIndicator size="small" style={{ position: "absolute", right: 12, top: 12 }} />
      ) : null}
      {open && predictions.length > 0 ? (
        <View
          className="bg-white border border-slate-200 rounded-xl mt-1"
          style={{ position: "absolute", top: 44, left: 0, right: 0, zIndex: 9999, elevation: 1001, maxHeight: 180 }}
        >
          {predictions.map((p) => (
            <Pressable
              key={p.place_id}
              onPress={() => pick(p)}
              className="px-3 py-2 border-b border-slate-100"
            >
              <Text className="text-xs text-slate-700">{p.description}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
