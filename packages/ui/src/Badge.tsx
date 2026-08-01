import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '@lab-topo/config';

export type BadgeTone =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'delivered'
  | 'late'
  | 'ok'
  | 'muted';

const TONE_STYLES: Record<BadgeTone, { color: string; background: string }> = {
  pending: { color: theme.color.info, background: theme.color.infoSoft },
  approved: { color: theme.color.success, background: theme.color.successSoft },
  rejected: { color: theme.color.red, background: theme.color.redSoft },
  delivered: { color: theme.color.delivered, background: theme.color.deliveredSoft },
  late: { color: theme.color.red, background: theme.color.redSoft },
  ok: { color: theme.color.success, background: theme.color.successSoft },
  muted: { color: theme.color.muted, background: theme.color.grey },
};

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
};

export function Badge({ label, tone = 'pending', style }: BadgeProps) {
  const colors = TONE_STYLES[tone];
  return (
    <View style={[styles.base, { backgroundColor: colors.background }, style]}>
      <View style={[styles.dot, { backgroundColor: colors.color }]} />
      <Text style={[styles.label, { color: colors.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
  },
});
