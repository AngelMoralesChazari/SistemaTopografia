import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
  rightAction?: React.ReactNode;
  showRentalPrice?: boolean;
};

export function MaterialCard({
  equipment,
  onPress,
  selected = false,
  showStatusBadge = false,
  style,
  rightAction,
  showRentalPrice = false,
}: MaterialCardProps) {
  const content = (
    <View style={[styles.card, selected && styles.cardSelected, style]}>
      <View style={styles.thumb}>
        {equipment.photoUrl ? (
          <Image
            source={{ uri: equipment.photoUrl }}
            style={styles.thumbImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.thumbText}>[foto]</Text>
        )}
      </View>
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={2}>
          {equipment.name}
        </Text>
        <Text style={styles.sub} numberOfLines={2}>
          {equipment.categoryName} · {conditionLabel(equipment)}
        </Text>
        {showRentalPrice ? (
          <View style={styles.rentalPriceTag}>
            <Text style={styles.rentalPriceLabel}>Renta particular:</Text>
            <Text style={styles.rentalPriceValue}>
              {equipment.rentalPrice != null && equipment.rentalPrice > 0
                ? `$${equipment.rentalPrice.toLocaleString('es-MX')} / día`
                : 'A cotizar'}
            </Text>
          </View>
        ) : null}
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
      {rightAction ? <View style={styles.rightActionWrap}>{rightAction}</View> : null}
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
    borderWidth: 1.5,
    backgroundColor: theme.color.infoSoft,
  },
  pressed: {
    opacity: 0.85,
  },
  thumb: {
    width: 48,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#EEF2F6',
    borderWidth: 1,
    borderColor: theme.color.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbText: {
    color: '#84909C',
    fontSize: 9,
    fontFamily: theme.font.sans,
    fontWeight: '600',
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
  rightActionWrap: {
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentalPriceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: 5,
  },
  rentalPriceLabel: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '600',
  },
  rentalPriceValue: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '800',
  },
});
