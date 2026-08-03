import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { theme } from '@lab-topo/config';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps = PressableProps & {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  variant = 'primary',
  loading = false,
  fullWidth = true,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        variantStyles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? theme.color.navy : '#fff'} />
      ) : (
        <Text style={[styles.label, labelStyles[variant]]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    borderWidth: 1,
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontSize: theme.font.size.lg,
    fontWeight: '800',
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: theme.color.navy,
    borderColor: theme.color.navy,
  },
  secondary: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.navy,
  },
  danger: {
    backgroundColor: theme.color.red,
    borderColor: theme.color.red,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
});

const labelStyles = StyleSheet.create({
  primary: { color: '#fff' },
  secondary: { color: theme.color.navy },
  danger: { color: '#fff' },
  ghost: { color: theme.color.navy },
});
