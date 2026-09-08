import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

let NativePicker: any = null;
if (Platform.OS !== "web") {
  NativePicker = require("@react-native-community/datetimepicker").default;
}

type Props = {
  value: string; // ISO-local: "YYYY-MM-DDTHH:mm"
  onChange: (v: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  disabled?: boolean;
  timeSlots?: string[];
  onDateChange?: (date: string) => void;
};

const DEFAULT_TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00"
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function format12Hour(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${pad(m)} ${period}`;
}

export default function DateTimePickerField({
  value,
  onChange,
  placeholder,
  minimumDate,
  disabled,
  timeSlots = DEFAULT_TIME_SLOTS,
  onDateChange,
}: Props) {
  // Extract initial date (YYYY-MM-DD) and time (HH:mm) from value prop
  const [currentDateVal, currentTimeVal] = value ? value.split("T") : ["", ""];
  
  const [selectedDate, setSelectedDate] = useState<string>(currentDateVal);
  const [showNativePicker, setShowNativePicker] = useState<boolean>(false);

  useEffect(() => {
    if (currentDateVal) setSelectedDate(currentDateVal);
  }, [currentDateVal]);

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    onDateChange?.(dateStr);
    // If a time was already selected, update the parent value with new date
    if (currentTimeVal) {
      onChange(`${dateStr}T${currentTimeVal}`);
    }
  };

  const handleTimeSelect = (timeStr: string) => {
    if (!selectedDate) return;
    onChange(`${selectedDate}T${timeStr}`);
  };

  const onNativeChange = (event: any, picked?: Date) => {
    setShowNativePicker(false);
    if (event?.type === "dismissed" || !picked) return;

    const dateStr = toIsoDate(picked);
    handleDateSelect(dateStr);
  };

  return (
    <View className="space-y-4">
      {/* Date Picker Input / Button */}
      {Platform.OS === "web" ? (
        <View className="bg-white border border-slate-200 rounded-xl px-3 py-2">
          <input
            type="date"
            value={selectedDate}
            disabled={disabled}
            min={minimumDate ? toIsoDate(minimumDate) : undefined}
            onChange={(e) => handleDateSelect(e.target.value)}
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
      ) : (
        <Pressable
          onPress={() => !disabled && setShowNativePicker(true)}
          disabled={disabled}
          className="bg-white border border-slate-200 rounded-xl px-3 py-3 flex-row items-center justify-between"
          style={disabled ? { opacity: 0.5 } : undefined}
        >
          <Text className={selectedDate ? "text-sm text-slate-900" : "text-sm text-slate-400"}>
            {selectedDate ? formatDisplayDate(selectedDate) : placeholder || "Select a date"}
          </Text>
          <Text className="text-slate-400 text-xs">📅</Text>
        </Pressable>
      )}

      {/* Native iOS/Android Date Picker Modal */}
      {showNativePicker && NativePicker && (
        <NativePicker
          value={selectedDate ? new Date(selectedDate + "T00:00:00") : new Date()}
          mode="date"
          minimumDate={minimumDate}
          onChange={onNativeChange}
          display={Platform.OS === "ios" ? "inline" : "default"}
        />
      )}

      {/* Time Cards Section */}
      {selectedDate ? (
        <View className="mt-2">
          <Text className="text-xs font-medium text-slate-500 mb-2">Available Times</Text>
          {timeSlots.length === 0 ? (
            <Text className="text-xs text-slate-500">
              No available times for this date.
            </Text>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {timeSlots.map((slot) => {
                const isSelected = currentTimeVal === slot;
                return (
                  <Pressable
                    key={slot}
                    disabled={disabled}
                    onPress={() => handleTimeSelect(slot)}
                    className={`px-3 py-2 rounded-lg border ${
                      isSelected
                        ? "bg-slate-900 border-slate-900"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        isSelected ? "text-white" : "text-slate-700"
                      }`}
                    >
                      {format12Hour(slot)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}