import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
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
  secureTextEntry,
  ...rest
}: TextFieldProps) {
  const [isSecure, setIsSecure] = useState(secureTextEntry);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputContainer, error ? styles.inputError : null]}>
        <TextInput
          placeholderTextColor={theme.color.muted}
          style={[styles.input, style]}
          secureTextEntry={isSecure}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setIsSecure(!isSecure)}
            style={styles.eyeBtn}
            accessibilityRole="button"
            accessibilityLabel={isSecure ? "Mostrar contraseña" : "Ocultar contraseña"}
          >
            <MaterialIcons
              name={isSecure ? 'visibility' : 'visibility-off'}
              size={20}
              color={theme.color.muted}
            />
          </Pressable>
        ) : null}
      </View>
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
    fontSize: theme.font.size.sm,
    fontWeight: '800',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    color: theme.color.ink,
    fontSize: theme.font.size.md,
  },
  inputError: {
    borderColor: theme.color.red,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    height: '100%',
    justifyContent: 'center',
  },
  helper: {
    marginTop: 6,
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
  },
  error: {
    marginTop: 6,
    color: theme.color.red,
    fontSize: theme.font.size.sm,
  },
});
