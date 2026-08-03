import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '@lab-topo/config';
import {
  EQUIPMENT_STATUS_LABELS,
  type Equipment,
} from '@lab-topo/domain';
import { Badge, type BadgeTone } from './Badge';

function statusTone(status: Equipment['status']): BadgeTone {
  switch (status) {
    case 'available':
      return 'ok';
    case 'reserved':
      return 'pending';
    case 'loaned':
      return 'delivered';
    case 'maintenance':
      return 'muted';
    default:
      return 'late';
  }
}

function conditionLabel(equipment: Equipment): string {
  if (equipment.notes?.trim()) return equipment.notes.trim();
  if (equipment.status === 'available') return 'En buen estado';
  if (equipment.status === 'maintenance') return 'Revisar';
  return EQUIPMENT_STATUS_LABELS[equipment.status];
}

type MaterialCardProps = {
  equipment: Equipment;
  onPress?: () => void;
  selected?: boolean;
  showStatusBadge?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function MaterialCard({
  equipment,
  onPress,
  selected = false,
  showStatusBadge = false,
  style,
}: MaterialCardProps) {
  const content = (
    <View style={[styles.card, selected && styles.cardSelected, style]}>
      <View style={styles.thumb}>
        <Text style={styles.thumbText}>[foto]</Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {equipment.name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {equipment.categoryName} · {conditionLabel(equipment)}
        </Text>
        {showStatusBadge ? (
          <View style={styles.badgeWrap}>
            <Badge label={EQUIPMENT_STATUS_LABELS[equipment.status]} tone={statusTone(equipment.status)} />
          </View>
        ) : null}
      </View>
      <View style={styles.countBox}>
        <Text style={styles.countValue}>{equipment.qtyAvailable}</Text>
        <Text style={styles.countLabel}>disp.</Text>
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    marginBottom: 8,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 7,
  },
  cardSelected: {
    borderColor: theme.color.navy,
    backgroundColor: '#F7FAFD',
  },
  pressed: {
    opacity: 0.85,
  },
  thumb: {
    width: 42,
    height: 37,
    borderRadius: 4,
    backgroundColor: theme.color.grey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbText: {
    color: '#84909C',
    fontSize: 9,
    fontFamily: theme.font.sans,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: theme.color.ink,
    fontSize: theme.font.size.md,
    fontWeight: '700',
  },
  sub: {
    marginTop: 4,
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
  },
  badgeWrap: {
    marginTop: 6,
  },
  countBox: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: theme.color.successSoft,
    alignItems: 'center',
    minWidth: 44,
  },
  countValue: {
    color: theme.color.success,
    fontSize: theme.font.size.md,
    fontWeight: '800',
  },
  countLabel: {
    color: theme.color.success,
    fontSize: theme.font.size.xs,
    fontWeight: '800',
  },
});
