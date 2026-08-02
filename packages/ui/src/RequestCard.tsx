import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '@lab-topo/config';
import { Badge, type BadgeTone } from './Badge';

export type RequestDataRow = {
  label: string;
  value: string;
  valueColor?: string;
};

type RequestCardProps = {
  folio: string;
  statusLabel: string;
  statusTone?: BadgeTone;
  rows: RequestDataRow[];
  style?: StyleProp<ViewStyle>;
};

export function RequestCard({
  folio,
  statusLabel,
  statusTone = 'pending',
  rows,
  style,
}: RequestCardProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.head}>
        <Text style={styles.folio}>{folio}</Text>
        <Badge label={statusLabel} tone={statusTone} />
      </View>
      {rows.map((row, index) => (
        <View
          key={`${row.label}-${index}`}
          style={[styles.row, index === rows.length - 1 && styles.rowLast]}
        >
          <Text style={styles.label}>{row.label}</Text>
          <Text style={[styles.value, row.valueColor ? { color: row.valueColor } : null]}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 10,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  folio: {
    flex: 1,
    color: theme.color.navy,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
  },
  rowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  label: {
    color: theme.color.muted,
    fontSize: 12,
  },
  value: {
    color: theme.color.ink,
    fontSize: 12,
    fontWeight: '700',
    maxWidth: '62%',
    textAlign: 'right',
  },
});
