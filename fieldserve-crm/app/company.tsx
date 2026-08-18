import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { useState } from "react";
import ScreenScaffold from "../components/ScreenScaffold";
import SegmentedToggle from "../components/SegmentedToggle";
import SettingsGroup from "../components/SettingsGroup";
import SettingsRow from "../components/SettingsRow";
import { useIndustry } from "../contexts/IndustryContext";
import {
  useCurrentBusiness,
  useUpdateBusiness,
} from "../lib/hooks/useBusiness";

const INDUSTRY_OPTIONS = [
  { key: "mobile", label: "Mobile Service" },
  { key: "fixed", label: "Fixed Location" },
];

export default function CompanyScreen() {
  const { mode, setMode } = useIndustry();
  const business = useCurrentBusiness();
  const updateBusiness = useUpdateBusiness();
  const [businessEdit, setBusinessEdit] = useState<
    null | "name" | "trading_name" | "tax_id" | "email" | "phone" | "website" | "address"
  >(null);
  const [businessDraft, setBusinessDraft] = useState("");
  const [schedEdit, setSchedEdit] = useState<
    null | "opening" | "closing" | "buffer"
  >(null);
  const [draft, setDraft] = useState("");

  const b = business.data;

  const openBusinessEdit = (
    field: NonNullable<typeof businessEdit>,
  ) => {
    if (!b) return;
    setBusinessEdit(field);
    if (field === "address") {
      setBusinessDraft(
        [b.address_line1, b.address_city, b.address_postcode]
          .filter(Boolean)
          .join(", "),
      );
      return;
    }
    setBusinessDraft(String(b[field] ?? ""));
  };

  const saveBusinessEdit = async () => {
    if (!b || !businessEdit || !businessDraft.trim()) return;
    const patch =
      businessEdit === "address"
        ? { address_line1: businessDraft.trim() }
        : { [businessEdit]: businessDraft.trim() };
    await updateBusiness.mutateAsync({ id: b.id, patch });
    setBusinessEdit(null);
  };

  const openEdit = (kind: "opening" | "closing" | "buffer") => {
    if (!b) return;
    setSchedEdit(kind);
    if (kind === "opening") setDraft(b.working_hours_start.slice(0, 5));
    else if (kind === "closing") setDraft(b.working_hours_end.slice(0, 5));
    else setDraft(String(b.default_travel_buffer_minutes));
  };

  const saveEdit = async () => {
    if (!b || !schedEdit) return;
    const patch: Record<string, unknown> = {};
    if (schedEdit === "opening") {
      if (!/^\d{2}:\d{2}$/.test(draft)) return;
      patch.working_hours_start = `${draft}:00`;
    } else if (schedEdit === "closing") {
      if (!/^\d{2}:\d{2}$/.test(draft)) return;
      patch.working_hours_end = `${draft}:00`;
    } else {
      const n = Number(draft);
      if (!Number.isFinite(n) || n < 0) return;
      patch.default_travel_buffer_minutes = Math.round(n);
    }
    await updateBusiness.mutateAsync({ id: b.id, patch });
    setSchedEdit(null);
  };

  return (
    <ScreenScaffold title="Company Info" subtitle="Business profile and branding">
      <Text className="text-[11px] uppercase tracking-wider text-slate-500 px-1 mb-2">
        Industry type
      </Text>
      <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-2">
        <SegmentedToggle
          options={INDUSTRY_OPTIONS}
          active={mode}
          onChange={async (k) => {
            const nextMode = k as "mobile" | "fixed";
            setMode(nextMode);
            if (b) {
              await updateBusiness.mutateAsync({
                id: b.id,
                patch: { industry_mode: nextMode },
              });
            }
          }}
        />
        <Text className="text-xs text-slate-500 mt-3 leading-4">
          {mode === "mobile"
            ? "You travel to customers (detailing, plumbing, mobile repair). Schedule shows route optimisation; Map shows demand heat map."
            : "Customers come to you (salon, clinic, studio). Schedule shows appointment slots; Map shows customer catchment."}
        </Text>
      </View>
      <Text className="text-[11px] text-slate-500 px-1 mt-1 mb-5 leading-4">
        Changes which scheduling and demand views the app uses across all tabs.
      </Text>

      <SettingsGroup title="Business">
        <SettingsRow label="Name" value={b?.name ?? "—"} onPress={() => openBusinessEdit("name")} />
        <SettingsRow label="Trading name" value={b?.trading_name || "—"} onPress={() => openBusinessEdit("trading_name")} />
        <SettingsRow label="Tax ID" value={b?.tax_id || "—"} onPress={() => openBusinessEdit("tax_id")} />
      </SettingsGroup>

      <SettingsGroup title="Contact">
        <SettingsRow label="Email" value={b?.email || "—"} onPress={() => openBusinessEdit("email")} />
        <SettingsRow label="Phone" value={b?.phone || "—"} onPress={() => openBusinessEdit("phone")} />
        <SettingsRow label="Website" value={b?.website || "—"} onPress={() => openBusinessEdit("website")} />
      </SettingsGroup>

      <SettingsGroup title="Address">
        <SettingsRow
          label={mode === "mobile" ? "Service area" : "Premises address"}
          value={
            [b?.address_line1, b?.address_city, b?.address_postcode]
              .filter(Boolean)
              .join(", ") || "—"
          }
          onPress={() => openBusinessEdit("address")}
        />
        <SettingsRow label="Registered address" value={b?.address_country || "—"} onPress={() => openBusinessEdit("address")} />
      </SettingsGroup>

      <SettingsGroup title="Branding">
        <SettingsRow label="Logo" value="Default" onPress={() => {}} />
        <SettingsRow label="Brand colour" value="#2563EB" onPress={() => {}} />
      </SettingsGroup>

      <SettingsGroup title="Scheduling">
        <SettingsRow
          label="Opening time"
          value={b?.working_hours_start?.slice(0, 5) ?? "—"}
          onPress={() => openEdit("opening")}
        />
        <SettingsRow
          label="Closing time"
          value={b?.working_hours_end?.slice(0, 5) ?? "—"}
          onPress={() => openEdit("closing")}
        />
        <SettingsRow
          label="Travel buffer"
          value={b ? `${b.default_travel_buffer_minutes} min` : "—"}
          description="Minimum gap enforced between same-day jobs."
          onPress={() => openEdit("buffer")}
        />
      </SettingsGroup>

      <Modal
        visible={businessEdit !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setBusinessEdit(null)}
      >
        <View className="flex-1 justify-center bg-black/40 px-6">
          <View className="bg-white rounded-2xl p-5">
            <Text className="text-base font-semibold text-slate-900 mb-2">
              Edit {businessEdit === "address" ? "address" : businessEdit?.replace("_", " ")}
            </Text>
            <TextInput
              value={businessDraft}
              onChangeText={setBusinessDraft}
              placeholder="Enter a value"
              autoCapitalize="none"
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 mb-3"
            />
            <View className="flex-row justify-end">
              <Pressable onPress={() => setBusinessEdit(null)} className="px-4 py-2">
                <Text className="text-slate-600">Cancel</Text>
              </Pressable>
              <Pressable onPress={saveBusinessEdit} className="px-4 py-2 bg-blue-600 rounded-lg ml-2">
                <Text className="text-white font-semibold">
                  {updateBusiness.isPending ? "Saving…" : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={schedEdit !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSchedEdit(null)}
      >
        <View className="flex-1 justify-center bg-black/40 px-6">
          <View className="bg-white rounded-2xl p-5">
            <Text className="text-base font-semibold text-slate-900 mb-2">
              {schedEdit === "opening"
                ? "Opening time"
                : schedEdit === "closing"
                  ? "Closing time"
                  : "Travel buffer (minutes)"}
            </Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={schedEdit === "buffer" ? "15" : "08:00"}
              keyboardType={schedEdit === "buffer" ? "number-pad" : "default"}
              autoCapitalize="none"
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 mb-3"
            />
            <View className="flex-row justify-end">
              <Pressable onPress={() => setSchedEdit(null)} className="px-4 py-2">
                <Text className="text-slate-600">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveEdit}
                className="px-4 py-2 bg-blue-600 rounded-lg ml-2"
              >
                <Text className="text-white font-semibold">
                  {updateBusiness.isPending ? "Saving…" : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenScaffold>
  );
}
