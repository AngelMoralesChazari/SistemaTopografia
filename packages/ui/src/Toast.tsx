import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { theme } from '@lab-topo/config';

type ToastProps = {
  message: string | null;
  visible: boolean;
};

export function Toast({ message, visible }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : 12,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, translateY]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    zIndex: 100,
    maxWidth: 290,
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: theme.color.navy,
    borderRadius: 9,
    ...theme.shadow.md,
  },
  text: {
    color: '#fff',
    fontSize: 11,
  },
});
