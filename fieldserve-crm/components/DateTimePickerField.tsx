import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

let NativePicker: any = null;
if (Platform.OS !== "web") {
  // Lazy require so the web bundle doesn't try to resolve the native module.
  NativePicker = require("@react-native-community/datetimepicker").default;
}

type Props = {
  value: string; // ISO-local: "YYYY-MM-DDTHH:mm"
  onChange: (v: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  disabled?: boolean;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDisplay(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DateTimePickerField({
  value,
  onChange,
  placeholder,
  minimumDate,
  disabled,
}: Props) {
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const [draft, setDraft] = useState<Date | null>(null);

  if (Platform.OS === "web") {
    return (
      <View className="bg-white border border-slate-200 rounded-xl px-3 py-2">
        {/* HTML datetime-local input — RN Web forwards style but not type. */}
        {/* @ts-ignore native input on web */}
        <input
          type="datetime-local"
          value={value}
          disabled={disabled}
          min={minimumDate ? toIsoLocal(minimumDate) : undefined}
          onChange={(e: any) => onChange(e.target.value)}
          style={{
            border: "none",
            outline: "none",
            width: "100%",
            fontSize: 14,
            fontFamily: "inherit",
            color: "#0f172a",
            background: "transparent",
          }}
        />
      </View>
    );
  }

  const openDate = () => {
    if (disabled) return;
    setDraft(value ? new Date(value) : new Date());
    setMode("date");
  };

  const onNativeChange = (event: any, picked?: Date) => {
    // Android dismisses on cancel — `type === 'dismissed'` means user backed out.
    if (event?.type === "dismissed") {
      setMode(null);
      setDraft(null);
      return;
    }
    if (!picked) return;
    if (mode === "date") {
      const carry = draft ?? new Date();
      const merged = new Date(
        picked.getFullYear(),
        picked.getMonth(),
        picked.getDate(),
        carry.getHours() || 10,
        carry.getMinutes() || 0,
      );
      setDraft(merged);
      // Android fires a fresh picker for time; iOS spinner lets us finish.
      if (Platform.OS === "android") {
        setMode("time");
      } else {
        setMode("time");
      }
    } else if (mode === "time") {
      const base = draft ?? new Date();
      const merged = new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        picked.getHours(),
        picked.getMinutes(),
      );
      onChange(toIsoLocal(merged));
      setMode(null);
      setDraft(null);
    }
  };

  return (
    <View>
      <Pressable
        onPress={openDate}
        disabled={disabled}
        className="bg-white border border-slate-200 rounded-xl px-3 py-3 flex-row items-center justify-between"
        style={disabled ? { opacity: 0.5 } : undefined}
      >
        <Text
          className={value ? "text-sm text-slate-900" : "text-sm text-slate-400"}
        >
          {value ? formatDisplay(value) : placeholder || "Pick a date and time"}
        </Text>
        <Text className="text-slate-400 text-xs">📅</Text>
      </Pressable>

      {mode && NativePicker ? (
        <NativePicker
          value={draft ?? new Date()}
          mode={mode}
          minimumDate={mode === "date" ? minimumDate : undefined}
          onChange={onNativeChange}
          display={Platform.OS === "ios" ? "spinner" : "default"}
        />
      ) : null}
    </View>
  );
}
