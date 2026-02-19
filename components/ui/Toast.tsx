import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/Text";
import { colors, spacing, radius } from "@/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastType = "error" | "success" | "info";

interface ToastOptions {
  message: string;
  type: ToastType;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

// ---------------------------------------------------------------------------
// Toast Component
// ---------------------------------------------------------------------------

const BACKGROUND_MAP: Record<ToastType, string> = {
  error: colors.error,
  success: colors.success,
  info: colors.surface,
};

const TEXT_COLOR_MAP: Record<ToastType, string> = {
  error: "#FFFFFF",
  success: colors.textInverse,
  info: colors.textPrimary,
};

interface ToastInternalState extends ToastOptions {
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastInternalState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setToast(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (opts: ToastOptions) => {
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      setToast({ ...opts, visible: true });

      // Auto-dismiss after 5s only if there is no action button
      if (!opts.actionLabel) {
        timerRef.current = setTimeout(() => {
          setToast(null);
        }, 5000);
      }
    },
    [],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast?.visible && (
        <Animated.View
          entering={SlideInDown.duration(300)}
          exiting={SlideOutDown.duration(200)}
          style={[
            styles.toastContainer,
            { bottom: insets.bottom + spacing[4] },
            { backgroundColor: BACKGROUND_MAP[toast.type] },
          ]}
        >
          <Text
            variant="bodyMedium"
            style={[styles.message, { color: TEXT_COLOR_MAP[toast.type] }]}
          >
            {toast.message}
          </Text>
          <View style={styles.actions}>
            {toast.actionLabel && toast.onAction && (
              <Pressable
                onPress={() => {
                  toast.onAction?.();
                  dismiss();
                }}
                style={styles.actionButton}
              >
                <Text
                  variant="bodyMedium"
                  style={[
                    styles.actionLabel,
                    { color: TEXT_COLOR_MAP[toast.type] },
                  ]}
                >
                  {toast.actionLabel}
                </Text>
              </Pressable>
            )}
            <Pressable onPress={dismiss} style={styles.dismissButton}>
              <Text
                variant="body"
                style={{ color: TEXT_COLOR_MAP[toast.type], opacity: 0.7 }}
              >
                {"\u2715"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    left: spacing[4],
    right: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 9999,
  },
  message: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginLeft: spacing[3],
  },
  actionButton: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
  },
  actionLabel: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  dismissButton: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[1],
  },
});
