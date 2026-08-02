import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@lab-topo/config';

type PlaceholderProps = {
  title: string;
  subtitle?: string;
};

export function PlaceholderScreen({ title, subtitle }: PlaceholderProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.canvasMobile,
    padding: theme.space.xl,
  },
  title: {
    color: theme.color.navy,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});
