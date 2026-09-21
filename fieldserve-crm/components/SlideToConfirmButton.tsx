import { useRef, useState } from "react";
import { Animated, PanResponder, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  label: string;
  onComplete: () => void;
  bottomOffset: number;
  disabled?: boolean;
};

const THUMB_SIZE = 52;
const TRACK_PADDING = 4;
// Fraction of the track the thumb must cross before the action fires.
const COMPLETE_THRESHOLD = 0.75;

export default function SlideToConfirmButton({
  label,
  onComplete,
  bottomOffset,
  disabled,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  // Floored at 1 so the interpolation range stays valid before layout.
  const maxTranslate = Math.max(trackWidth - THUMB_SIZE - TRACK_PADDING * 2, 1);
  // PanResponder handlers are created once, so they must read this ref instead
  // of `maxTranslate` directly or they'd stay stuck at its initial value.
  const maxTranslateRef = useRef(maxTranslate);
  maxTranslateRef.current = maxTranslate;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: (_, gesture) =>
        !disabled && Math.abs(gesture.dx) > 2,
      onPanResponderMove: (_, gesture) => {
        translateX.setValue(
          Math.min(Math.max(gesture.dx, 0), maxTranslateRef.current),
        );
      },
      onPanResponderRelease: (_, gesture) => {
        const max = maxTranslateRef.current;
        const finalX = Math.min(Math.max(gesture.dx, 0), max);
        if (finalX >= max * COMPLETE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: max,
            duration: 120,
            useNativeDriver: false,
          }).start(() => {
            onComplete();
            Animated.timing(translateX, {
              toValue: 0,
              duration: 200,
              delay: 300,
              useNativeDriver: false,
            }).start();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 6,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: false,
          bounciness: 6,
        }).start();
      },
    }),
  ).current;

  const labelOpacity = translateX.interpolate({
    inputRange: [0, maxTranslate],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const fillWidth = translateX.interpolate({
    inputRange: [0, maxTranslate],
    outputRange: [THUMB_SIZE + TRACK_PADDING * 2, trackWidth || THUMB_SIZE + TRACK_PADDING * 2],
    extrapolate: "clamp",
  });

  return (
    <View
      pointerEvents={disabled ? "none" : "box-none"}
      style={{ position: "absolute", left: 16, right: 16, bottom: bottomOffset }}
    >
      <View
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        className="bg-slate-100 border border-slate-200 rounded-full overflow-hidden"
        style={{
          height: THUMB_SIZE + TRACK_PADDING * 2,
          padding: TRACK_PADDING,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Animated.View
          pointerEvents="none"
          className="absolute inset-y-0 left-0 bg-blue-100 rounded-full"
          style={{ width: fillWidth }}
        />

        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <Animated.Text
            style={{ opacity: labelOpacity }}
            className="text-slate-500 text-sm font-semibold text-center"
          >
            {label}
          </Animated.Text>
        </View>

        <Animated.View
          {...panResponder.panHandlers}
          style={{
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: THUMB_SIZE / 2,
            transform: [{ translateX }],
          }}
          className="bg-blue-600 items-center justify-center shadow-lg"
        >
          <Ionicons name="chevron-forward" size={22} color="white" />
        </Animated.View>
      </View>
    </View>
  );
}
