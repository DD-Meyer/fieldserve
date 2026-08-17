import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ScreenOrientation from "expo-screen-orientation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import {
  WALKAROUND_STEPS,
  type FrameCheck,
  type InspectionAngle,
} from "@/lib/hooks/useInspections";

export const WALKAROUND_OVERLAY = {
  viewBox: "0 0 320 180",
  outlinePath:
    "M100 24 Q160 5 220 24 L274 64 Q290 90 274 116 L220 156 Q160 175 100 156 L46 116 Q30 90 46 64 Z",
  frontWindowPath: "M108 47 Q160 30 212 47 L236 70 L84 70 Z",
  rearWindowPath: "M84 110 L236 110 L212 137 Q160 152 108 137 Z",
  aspectRatio: 16 / 9,
} as const;

type Props = {
  angle: InspectionAngle | null;
  stepNumber: number;
  totalSteps: number;
  uploading: boolean;
  onCaptured: (uri: string) => Promise<void>;
  onCheckFrame: (uri: string) => Promise<FrameCheck>;
  onClose: () => void;
};

export default function GuidedWalkaroundCamera({
  angle,
  stepNumber,
  totalSteps,
  uploading,
  onCaptured,
  onCheckFrame,
  onClose,
}: Props) {
  const cameraRef = useRef<CameraView>(null);
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true);
  const [frameCheck, setFrameCheck] = useState<FrameCheck | null>(null);

  const checkingRef = useRef(false);
  const captureInFlightRef = useRef(false);
  const stableFramesRef = useRef(0);
  const autoTriggeredRef = useRef(false);

  const step = WALKAROUND_STEPS.find((item) => item.key === angle);
  const cameraOpen = angle != null;

  // Compute maximum available overlay size without bleeding off-screen
  const guideWidth = Math.min(
    window.width * 0.55,
    (window.height - 80) * WALKAROUND_OVERLAY.aspectRatio
  );

  const shutterSize = window.height < 360 ? 48 : 56;

  useEffect(() => {
    const orientation = cameraOpen
      ? ScreenOrientation.OrientationLock.LANDSCAPE
      : ScreenOrientation.OrientationLock.PORTRAIT_UP;
    ScreenOrientation.lockAsync(orientation).catch(() => undefined);
    return () => {
      if (cameraOpen) {
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        ).catch(() => undefined);
      }
    };
  }, [cameraOpen]);

  const capture = useCallback(async () => {
    if (!ready || captureInFlightRef.current || uploading || !cameraRef.current) return;
    captureInFlightRef.current = true;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.75 });
      if (photo?.uri) await onCaptured(photo.uri);
    } finally {
      captureInFlightRef.current = false;
      setCapturing(false);
    }
  }, [onCaptured, ready, uploading]);

  useEffect(() => {
    stableFramesRef.current = 0;
    autoTriggeredRef.current = false;
    setFrameCheck(null);
  }, [angle]);

  useEffect(() => {
    if (!angle || !permission?.granted || !ready || !autoCapture || uploading) return;
    const timer = setInterval(async () => {
      if (checkingRef.current || captureInFlightRef.current || autoTriggeredRef.current || !cameraRef.current) return;
      checkingRef.current = true;
      try {
        const sample = await cameraRef.current.takePictureAsync({
          quality: 0.2,
          shutterSound: false,
        });
        if (!sample?.uri) return;
        const result = await onCheckFrame(sample.uri);
        setFrameCheck(result);
        stableFramesRef.current = result.ready ? stableFramesRef.current + 1 : 0;
        if (stableFramesRef.current >= 2) {
          autoTriggeredRef.current = true;
          await capture();
        }
      } catch {
        stableFramesRef.current = 0;
        setFrameCheck({ ready: false, reason: "check_failed", guidance: "Auto check unavailable — use manual capture" });
      } finally {
        checkingRef.current = false;
      }
    }, 1400);
    return () => clearInterval(timer);
  }, [angle, autoCapture, capture, capturing, onCheckFrame, permission?.granted, ready, uploading]);

  return (
    <Modal
      visible={angle != null}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent
      supportedOrientations={["landscape", "landscape-left", "landscape-right"]}
    >
      <View style={styles.root}>
        {permission?.granted ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="picture"
            ratio="16:9"
            responsiveOrientationWhenOrientationLocked
            animateShutter={false}
            onCameraReady={() => setReady(true)}
          />
        ) : null}

        {/* 1. CENTERED VEHICLE GUIDE LAYER */}
        {permission?.granted && (
          <View style={styles.centerOverlay} pointerEvents="none">
            <Text style={styles.guidance} numberOfLines={1}>{step?.guidance}</Text>

            <View style={[styles.readinessBadge, frameCheck?.ready && styles.readinessBadgeReady]}>
              <Ionicons
                name={frameCheck?.ready ? "checkmark-circle" : "scan-outline"}
                size={14}
                color={frameCheck?.ready ? "#14532d" : "white"}
              />
              <Text style={[styles.readinessText, frameCheck?.ready && styles.readinessTextReady]} numberOfLines={1}>
                {frameCheck?.ready ? "Position locked — hold steady" : frameCheck?.guidance ?? "Fit vehicle inside outline"}
              </Text>
            </View>

            <VehicleGuide
              marker={step?.marker ?? { x: 160, y: 25 }}
              width={guideWidth}
            />
          </View>
        )}

        {/* 2. FLOATING HEADER LAYER */}
        <View style={[styles.topHeader, { top: Math.max(insets.top, 12), left: Math.max(insets.left, 16), right: Math.max(insets.right, 16) }]} pointerEvents="box-none">
          <Pressable onPress={onClose} style={styles.iconButton} accessibilityLabel="Close camera">
            <Ionicons name="close" size={20} color="white" />
          </Pressable>

          <View style={styles.heading}>
            <Text style={styles.eyebrow}>WALKAROUND {stepNumber} OF {totalSteps}</Text>
            <Text style={styles.title} numberOfLines={1}>{step?.label}</Text>
          </View>

          <View style={styles.iconSpacer} />
        </View>

        {/* PROGRESS BAR */}
        <View style={[styles.progressTrack, { top: Math.max(insets.top, 12) + 40 }]}>
          <View style={[styles.progressFill, { width: `${(stepNumber / totalSteps) * 100}%` }]} />
        </View>

        {/* 3. FLOATING RIGHT CONTROLS LAYER */}
        {permission?.granted && (
          <View style={[styles.floatingSidebar, { right: Math.max(insets.right, 20) }]}>
            <Pressable onPress={() => setAutoCapture((v) => !v)} style={styles.autoToggleSide}>
              <Ionicons name={autoCapture ? "radio-button-on" : "radio-button-off"} size={16} color={autoCapture ? "#facc15" : "white"} />
              <Text style={styles.autoToggleTextSide}>Auto {autoCapture ? "ON" : "OFF"}</Text>
            </Pressable>

            <Pressable
              onPress={capture}
              disabled={!permission?.granted || !ready || capturing || uploading}
              style={[
                styles.shutter,
                { width: shutterSize, height: shutterSize, borderRadius: shutterSize / 2 },
                (!ready || capturing || uploading) && styles.disabled
              ]}
              accessibilityLabel={`Capture ${step?.label ?? "vehicle"}`}
            >
              {capturing || uploading ? (
                <ActivityIndicator color="#0f172a" size="small" />
              ) : (
                <View style={[styles.shutterInner, { width: shutterSize - 14, height: shutterSize - 14, borderRadius: (shutterSize - 14) / 2 }]} />
              )}
            </Pressable>
          </View>
        )}

        {/* PERMISSIONS CARD */}
        {(!permission || !permission.granted) && (
          <View style={styles.permissionCard}>
            <Ionicons name="camera-outline" size={34} color="white" />
            <Text style={styles.permissionTitle}>Camera access required</Text>
            <Pressable onPress={requestPermission} style={styles.permissionButton}>
              <Text style={styles.permissionButtonText}>Allow camera</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

function VehicleGuide({ marker, width }: { marker: { x: number; y: number }; width: number }) {
  return (
    <View style={[styles.vehicleGuide, { width }]}>
      <Svg width="100%" height="100%" viewBox={WALKAROUND_OVERLAY.viewBox}>
        <Path
          d={WALKAROUND_OVERLAY.outlinePath}
          fill="rgba(15,23,42,0.08)"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="3"
          strokeDasharray="10 7"
        />
        <Path d={WALKAROUND_OVERLAY.frontWindowPath} fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.65)" strokeWidth="2" />
        <Path d={WALKAROUND_OVERLAY.rearWindowPath} fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.65)" strokeWidth="2" />
        <Circle cx={marker.x} cy={marker.y} r="13" fill="rgba(250,204,21,0.35)" stroke="#facc15" strokeWidth="3" />
        <Circle cx={marker.x} cy={marker.y} r="4" fill="#facc15" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#020617" },

  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  guidance: { color: "white", fontSize: 13, fontWeight: "700", textAlign: "center", textShadowColor: "black", textShadowRadius: 4 },
  readinessBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(2,6,23,0.72)" },
  readinessBadgeReady: { backgroundColor: "#dcfce7" },
  readinessText: { color: "white", fontSize: 11, fontWeight: "600" },
  readinessTextReady: { color: "#14532d" },
  vehicleGuide: { aspectRatio: WALKAROUND_OVERLAY.aspectRatio, marginTop: 4 },

  topHeader: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  iconButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(2,6,23,0.65)", alignItems: "center", justifyContent: "center" },
  iconSpacer: { width: 32 },
  heading: { flex: 1, alignItems: "center" },
  eyebrow: { color: "#facc15", fontSize: 10, fontWeight: "800" },
  title: { color: "white", fontSize: 15, fontWeight: "800", marginTop: 1 },

  progressTrack: { position: "absolute", left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.25)", zIndex: 10 },
  progressFill: { height: 3, backgroundColor: "#facc15" },

  floatingSidebar: {
    position: "absolute",
    top: "25%",
    bottom: "25%",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    backgroundColor: "rgba(2,6,23,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 24,
    zIndex: 10,
  },
  autoToggleSide: { alignItems: "center", gap: 2 },
  autoToggleTextSide: { color: "white", fontSize: 9, fontWeight: "700" },

  shutter: {
    backgroundColor: "white",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { borderWidth: 2, borderColor: "#0f172a" },
  disabled: { opacity: 0.55 },

  permissionCard: { position: "absolute", alignSelf: "center", top: "35%", alignItems: "center", gap: 12, padding: 20, borderRadius: 8, backgroundColor: "#0f172a" },
  permissionTitle: { color: "white", fontSize: 15, fontWeight: "700" },
  permissionButton: { backgroundColor: "#facc15", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  permissionButtonText: { color: "#0f172a", fontWeight: "800", fontSize: 13 },
});