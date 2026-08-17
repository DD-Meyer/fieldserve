import { Button, Modal, Pressable, Text, TextInput, View } from "react-native";
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
  const [showAdd, setShowAdd] = useState(false);
  const business = useCurrentBusiness();
  const updateBusiness = useUpdateBusiness();
  const [schedEdit, setSchedEdit] = useState<
    null | "opening" | "closing" | "buffer"
  >(null);
  const [draft, setDraft] = useState("");

  const b = business.data;

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

  function CompanyScreenAddBusinessNameModal(
    { visible, onClose }: { visible: boolean;
      onClose: () => void }) {
        const [prevName, setPrevName] = useState();
        const [name, setName] = useState("");
        if (!visible) return null;
        return (
          <View className="p-4">
            <Text className="text-sm text-slate-700 mb-2">Business Name</Text>
            <TextInput
              className="border border-slate-300 rounded-lg p-2"
              placeholder="Enter business name"
              value={name}
              onChangeText={setName}
            />
            <Button title="Close" onPress={onClose} />
          </View>
        );
  }

  return (
    <ScreenScaffold title="Company Info" subtitle="Business profile and branding">
      <Text className="text-[11px] uppercase tracking-wider text-slate-500 px-1 mb-2">
        Industry type
      </Text>
      <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-2">
        <SegmentedToggle
          options={INDUSTRY_OPTIONS}
          active={mode}
          onChange={(k) => setMode(k as "mobile" | "fixed")}
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
        <SettingsRow label="Name" value="FieldServe Detailing" onPress={() => setShowAdd(true)} />
        <CompanyScreenAddBusinessNameModal visible={showAdd} onClose={() => setShowAdd(false)} />
        <SettingsRow label="Trading name" value="FieldServe" onPress={() => {}} />
        <SettingsRow label="Tax ID" value="—" onPress={() => {}} />
      </SettingsGroup>

      <SettingsGroup title="Contact">
        <SettingsRow label="Email" value="hello@fieldserve.local" onPress={() => {}} />
        <SettingsRow label="Phone" value="+44 20 1234 5678" onPress={() => {}} />
        <SettingsRow label="Website" value="fieldserve.local" onPress={() => {}} />
      </SettingsGroup>

      <SettingsGroup title="Address">
        <SettingsRow
          label={mode === "mobile" ? "Service area" : "Premises address"}
          value={mode === "mobile" ? "Greater London" : "12 High Street, EC1A 1BB"}
          onPress={() => {}}
        />
        <SettingsRow label="Registered address" onPress={() => {}} />
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
