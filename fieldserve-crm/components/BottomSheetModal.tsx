import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Wraps the children in a ScrollView that keeps the focused input above the keyboard. */
  scrollable?: boolean;
};

const SCREEN_HEIGHT = Dimensions.get("window").height;
// How far (or how fast) the handle must be dragged down before it closes the sheet.
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 0.8;
// Room left below the focused field for dropdowns such as address suggestions.
const SUGGESTION_SPACE = 220;
const TOP_GAP = 24;

export default function BottomSheetModal({ visible, onClose, children, scrollable = false }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const scrollY = useRef(0);
  const viewportHeight = useRef(0);
  const lastFocused = useRef<unknown>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const scrollToFocused = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput();
    lastFocused.current = input;
    const content = contentRef.current;
    if (!input || !content || !scrollRef.current) return;
    input.measureLayout(
      content as unknown as Parameters<typeof input.measureLayout>[0],
      (_x, y, _w, h) => {
        const viewport = viewportHeight.current;
        const wantedBottom = y + h + SUGGESTION_SPACE;
        if (wantedBottom > scrollY.current + viewport) {
          scrollRef.current?.scrollTo({ y: wantedBottom - viewport, animated: true });
        } else if (y < scrollY.current) {
          scrollRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: true });
        }
      },
      () => {},
    );
  }, []);

  const scheduleScrollToFocused = useCallback(
    (delay: number) => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(scrollToFocused, delay);
    },
    [scrollToFocused],
  );

  useEffect(() => {
    // KeyboardAvoidingView doesn't measure reliably inside a transparent Modal,
    // so track the keyboard directly and shift the sheet up to match.
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: { endCoordinates: { height: number }; duration?: number }) => {
      const duration = e.duration || 220;
      setKeyboardHeight(e.endCoordinates.height);
      Animated.timing(keyboardOffset, {
        toValue: e.endCoordinates.height,
        duration,
        useNativeDriver: false,
      }).start();
      scheduleScrollToFocused(duration + 60);
    };
    const onHide = (e: { duration?: number }) => {
      setKeyboardHeight(0);
      lastFocused.current = null;
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
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, [keyboardOffset, scheduleScrollToFocused]);

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

  // The keyboard covers the system navigation area, so the inset only applies while it is hidden.
  const bottomInset = keyboardHeight > 0 ? 12 : insets.bottom + 16;
  const maxSheetHeight = windowHeight - insets.top - keyboardHeight - TOP_GAP;

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
          <Animated.View style={{ paddingBottom: keyboardOffset }}>
            <View
              className="bg-white rounded-t-3xl overflow-hidden"
              style={{ maxHeight: maxSheetHeight, paddingBottom: bottomInset }}
            >
              {scrollable ? (
                <ScrollView
                  ref={scrollRef}
                  keyboardShouldPersistTaps="handled"
                  scrollEventThrottle={16}
                  onScroll={(e) => {
                    scrollY.current = e.nativeEvent.contentOffset.y;
                  }}
                  onLayout={(e) => {
                    viewportHeight.current = e.nativeEvent.layout.height;
                  }}
                  onTouchEnd={() => {
                    // Moving between fields keeps the keyboard open, so no keyboard event fires.
                    setTimeout(() => {
                      const focused = TextInput.State.currentlyFocusedInput();
                      if (keyboardHeight > 0 && focused && focused !== lastFocused.current) {
                        scheduleScrollToFocused(0);
                      }
                    }, 80);
                  }}
                >
                  <View ref={contentRef} collapsable={false}>
                    {children}
                  </View>
                </ScrollView>
              ) : (
                children
              )}
            </View>
          </Animated.View>
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
