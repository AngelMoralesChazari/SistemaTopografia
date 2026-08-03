import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  findNodeHandle,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputFocusEventData,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@lab-topo/config';

type KeyboardFormContextValue = {
  onFieldFocus: (event: NativeSyntheticEvent<TextInputFocusEventData>) => void;
};

const KeyboardFormContext = createContext<KeyboardFormContextValue | null>(null);

export function useKeyboardForm() {
  return useContext(KeyboardFormContext);
}

type Props = {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** Fondo del shell; usa transparente si hay un degradado detrás. */
  backgroundColor?: string;
};

/**
 * Formularios de auth: al enfocar un campo (RFC, dirección, etc.) hace scroll
 * para dejarlo visible por encima del teclado.
 */
export function KeyboardFormShell({
  children,
  contentStyle,
  backgroundColor = theme.color.canvasMobile,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const keyboardHeightRef = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      keyboardHeightRef.current = e.endCoordinates.height;
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollFieldAboveKeyboard = useCallback(() => {
    const kb = keyboardHeightRef.current;
    if (kb <= 0 || !scrollRef.current) return;

    const windowH = Dimensions.get('window').height;
    const visibleBottom = windowH - kb - 20;

    // Intento nativo primero (mejor en muchas versiones de RN).
    const scroll = scrollRef.current as ScrollView & {
      getScrollResponder?: () => {
        scrollResponderScrollNativeHandleToKeyboard?: (
          nodeHandle: number,
          offset: number,
          animated: boolean
        ) => void;
      };
    };
    const responder = scroll.getScrollResponder?.();

    // measureInWindow fallback vía último TextInput enfocado
    const input = TextInput.State.currentlyFocusedInput?.();
    if (input) {
      const handle = findNodeHandle(input);
      if (handle && responder?.scrollResponderScrollNativeHandleToKeyboard) {
        responder.scrollResponderScrollNativeHandleToKeyboard(handle, 140, true);
        return;
      }

      input.measureInWindow((_x, y, _w, h) => {
        const fieldBottom = y + h;
        if (fieldBottom <= visibleBottom) return;
        const delta = fieldBottom - visibleBottom + 12;
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollYRef.current + delta),
          animated: true,
        });
      });
      return;
    }

    scrollRef.current.scrollToEnd({ animated: true });
  }, []);

  const onFieldFocus = useCallback(
    (_event: NativeSyntheticEvent<TextInputFocusEventData>) => {
      // Espera a que el teclado termine de abrir / layout estable.
      const delay = Platform.OS === 'android' ? 320 : 140;
      setTimeout(scrollFieldAboveKeyboard, delay);
      // Segundo intento por si el teclado aún no reportó altura en el primero.
      setTimeout(scrollFieldAboveKeyboard, delay + 220);
    },
    [scrollFieldAboveKeyboard]
  );

  const keyboardOpen = keyboardHeight > 0;
  const bottomPad =
    Math.max(insets.bottom, 16) +
    24 +
    (keyboardOpen ? Math.max(Math.round(keyboardHeight * 0.55), 160) : 0);

  return (
    <KeyboardFormContext.Provider value={{ onFieldFocus }}>
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.scrollContent,
            {
              justifyContent: keyboardOpen ? 'flex-start' : 'center',
              paddingTop: Math.max(insets.top, 16) + 8,
              paddingBottom: bottomPad,
            },
            contentStyle,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </KeyboardFormContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.space.xxl,
  },
});
