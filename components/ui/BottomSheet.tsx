import React, { forwardRef, useCallback, useRef } from "react";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { colors } from "@/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AppBottomSheetProps {
  snapPoints?: string[];
  children: React.ReactNode;
  onDismiss?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AppBottomSheet = forwardRef<BottomSheetModal, AppBottomSheetProps>(
  function AppBottomSheet({ snapPoints = ["50%"], children, onDismiss }, ref) {
    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.6}
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backgroundStyle={{ backgroundColor: colors.backgroundCard }}
        handleIndicatorStyle={{ backgroundColor: colors.textTertiary }}
        backdropComponent={renderBackdrop}
        onDismiss={onDismiss}
        enableDynamicSizing={false}
      >
        <BottomSheetView style={{ flex: 1 }}>{children}</BottomSheetView>
      </BottomSheetModal>
    );
  },
);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function useBottomSheet() {
  const ref = useRef<BottomSheetModal>(null);

  const open = useCallback(() => {
    ref.current?.present();
  }, []);

  const close = useCallback(() => {
    ref.current?.dismiss();
  }, []);

  return { ref, open, close };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { AppBottomSheet, BottomSheetTextInput, useBottomSheet };
export type { AppBottomSheetProps };
