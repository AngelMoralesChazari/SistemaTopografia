import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '@lab-topo/config';
import { Avatar } from './Avatar';
import { Badge, type BadgeTone } from './Badge';

type StudentLoanRowProps = {
  name: string;
  initials: string;
  equipmentName: string;
  dueLabel: string;
  statusLabel: string;
  statusTone?: BadgeTone;
  alertText?: string;
  style?: StyleProp<ViewStyle>;
};

export function StudentLoanRow({
  name,
  initials,
  equipmentName,
  dueLabel,
  statusLabel,
  statusTone = 'ok',
  alertText,
  style,
}: StudentLoanRowProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.top}>
        <View style={styles.nameWrap}>
          <Avatar initials={initials} size={22} />
          <Text style={styles.name}>{name}</Text>
        </View>
        <Badge label={statusLabel} tone={statusTone} />
      </View>
      <View style={styles.meta}>
        <Text style={styles.equipment}>{equipmentName}</Text>
        <Text style={styles.due}>{dueLabel}</Text>
      </View>
      {alertText ? (
        <View style={styles.alert}>
          <Text style={styles.alertText}>! {alertText}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.line,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 7,
  },
  nameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  name: {
    color: theme.color.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
    marginLeft: 29,
  },
  equipment: {
    color: theme.color.muted,
    fontSize: 11,
  },
  due: {
    color: theme.color.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  alert: {
    marginTop: 7,
    marginLeft: 29,
    padding: 6,
    borderRadius: 5,
    backgroundColor: theme.color.redSoft,
  },
  alertText: {
    color: theme.color.red,
    fontSize: 10,
    lineHeight: 14,
  },
});
