import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { theme } from '@lab-topo/config';

type TextFieldProps = TextInputProps & {
  label?: string;
  helperText?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export function TextField({
  label,
  helperText,
  error,
  containerStyle,
  style,
  ...rest
}: TextFieldProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={theme.color.muted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.space.md,
  },
  label: {
    marginBottom: 6,
    color: theme.color.navy,
    fontSize: theme.font.size.xs,
    fontWeight: '800',
  },
  input: {
    height: 44,
    paddingHorizontal: 11,
    color: theme.color.ink,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.md,
    fontSize: theme.font.size.sm,
  },
  inputError: {
    borderColor: theme.color.red,
  },
  helper: {
    marginTop: 6,
    color: theme.color.muted,
    fontSize: 10,
  },
  error: {
    marginTop: 6,
    color: theme.color.red,
    fontSize: 10,
  },
});
