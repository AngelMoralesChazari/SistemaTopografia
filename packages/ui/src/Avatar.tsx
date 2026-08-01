import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '@lab-topo/config';

type AvatarProps = {
  initials: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function Avatar({ initials, size = 30, style }: AvatarProps) {
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: Math.max(9, size * 0.32) }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6EDF6',
  },
  text: {
    color: theme.color.navy,
    fontWeight: '800',
  },
});
