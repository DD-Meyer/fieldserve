import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

const SCREEN_HEIGHT = Dimensions.get("window").height;
// How far (or how fast) the handle must be dragged down before it closes the sheet.
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 0.8;

export default function BottomSheetModal({ visible, onClose, children }: Props) {
  // Kept mounted through the close animation, then unmounted once it finishes.
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Animated in step with the keyboard so the sheet lifts clear of it.
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  // The value translateY was at when the current drag started.
  const dragStartValue = useRef(0);
  // The PanResponder is created once, so onClose is read through a ref to stay current.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => {
        translateY.stopAnimation((value) => {
          dragStartValue.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(Math.max(dragStartValue.current + gesture.dy, 0));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > CLOSE_DISTANCE || gesture.vy > CLOSE_VELOCITY) {
          // Drive the sheet off-screen here rather than waiting on the visible prop,
          // which would otherwise animate from a stale position.
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: SCREEN_HEIGHT,
              duration: 220,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 0,
              duration: 200,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }),
          ]).start(() => {
            // Deferred so the gesture's touch responder is released before the sheet
            // unmounts; otherwise Android keeps routing scroll gestures to a dead view.
            setTimeout(() => onCloseRef.current(), 0);
          });
          return;
        }
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 6,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 6,
        }).start();
      },
    }),
  ).current;

  useEffect(() => {
    // KeyboardAvoidingView doesn't measure reliably inside a transparent Modal,
    // so track the keyboard directly and shift the sheet up to match.
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: { endCoordinates: { height: number }; duration?: number }) => {
      Animated.timing(keyboardOffset, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 220,
        useNativeDriver: false,
      }).start();
    };
    const onHide = (e: { duration?: number }) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: e?.duration || 200,
        useNativeDriver: false,
      }).start();
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOffset]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Unmount even if the animation was interrupted, otherwise the transparent
        // Modal stays up and swallows every touch on the screen behind it.
        if (!visibleRef.current) setMounted(false);
      });
    }
  }, [visible, translateY, backdropOpacity]);

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end">
        <Animated.View
          style={{ opacity: backdropOpacity }}
          className="absolute inset-0 bg-black/40"
        >
          <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View style={{ transform: [{ translateY }] }}>
            {children}
            <View
              {...panResponder.panHandlers}
              className="absolute top-0 left-0 right-0 items-center py-3"
            >
              <View className="w-10 h-1.5 rounded-full bg-slate-300" />
            </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
