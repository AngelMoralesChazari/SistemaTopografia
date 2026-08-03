import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '@lab-topo/config';

type NoticeProps = {
  title: string;
  description?: string;
  tone?: 'info' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function Notice({ title, description, tone = 'info', style }: NoticeProps) {
  const isDanger = tone === 'danger';
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: isDanger ? theme.color.redSoft : theme.color.infoSoft,
          borderColor: isDanger ? '#f3c9d0' : '#cbdcf1',
        },
        style,
      ]}
    >
      <Text style={[styles.title, { color: isDanger ? theme.color.red : theme.color.navy }]}>
        {title}
      </Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    padding: 14,
    marginVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  title: {
    fontSize: theme.font.size.md,
    fontWeight: '700',
  },
  description: {
    marginTop: 4,
    color: '#647488',
    fontSize: theme.font.size.sm,
    lineHeight: 20,
  },
});
