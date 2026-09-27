import { forwardRef } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

type Props = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string | null;
  required?: boolean;
  containerClassName?: string;
};

export function FieldMessage({ error, hint }: { error?: string | null; hint?: string | null }) {
  if (error) {
    return (
      <Text className="text-[11px] text-red-600 mt-1" accessibilityLiveRegion="polite">
        {error}
      </Text>
    );
  }
  return hint ? <Text className="text-[11px] text-slate-500 mt-1">{hint}</Text> : null;
}

const FormField = forwardRef<TextInput, Props>(function FormField(
  { label, error, hint, required, containerClassName = "mb-3", className, style, multiline, ...inputProps },
  ref,
) {
  return (
    <View className={containerClassName}>
      <Text className="text-xs font-semibold text-slate-600 mb-1">
        {label}
        {required ? <Text className="text-red-600"> *</Text> : null}
      </Text>
      <TextInput
        ref={ref}
        multiline={multiline}
        placeholderTextColor="#94a3b8"
        aria-invalid={!!error}
        className={`bg-white border rounded-xl px-3 py-2.5 text-sm text-slate-900 ${
          error ? "border-red-400" : "border-slate-200"
        } ${className ?? ""}`}
        style={[multiline ? { minHeight: 60, textAlignVertical: "top" } : null, style]}
        {...inputProps}
      />
      <FieldMessage error={error} hint={hint} />
    </View>
  );
});

export default FormField;
