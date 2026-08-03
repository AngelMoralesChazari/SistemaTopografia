import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@lab-topo/config';

export type BarDatum = {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  color?: string;
};

type BarChartProps = {
  data: BarDatum[];
  unit?: string;
  emptyText?: string;
  maxBars?: number;
};

export function BarChart({
  data,
  unit = '',
  emptyText = 'Sin datos todavía.',
  maxBars = 8,
}: BarChartProps) {
  const rows = useMemo(() => data.slice(0, maxBars), [data, maxBars]);
  const max = Math.max(1, ...rows.map((r) => r.value));

  if (rows.length === 0) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }

  return (
    <View style={styles.wrap}>
      {rows.map((row) => {
        const pct = Math.max(4, Math.round((row.value / max) * 100));
        return (
          <View key={row.id} style={styles.row}>
            <View style={styles.labelCol}>
              <Text style={styles.label} numberOfLines={1}>
                {row.label}
              </Text>
              {row.sublabel ? (
                <Text style={styles.sublabel} numberOfLines={1}>
                  {row.sublabel}
                </Text>
              ) : null}
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${pct}%`,
                    backgroundColor: row.color ?? theme.color.navy,
                  },
                ]}
              />
            </View>
            <Text style={styles.value}>
              {Number.isInteger(row.value) ? row.value : row.value.toFixed(1)}
              {unit ? ` ${unit}` : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

type StackSegment = { id: string; label: string; value: number; color: string };

type StackedBarProps = {
  segments: StackSegment[];
};

export function StackedBar({ segments }: StackedBarProps) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <View>
      <View style={styles.stackTrack}>
        {segments.map((seg) => {
          if (seg.value <= 0) return null;
          const width = `${Math.max(2, (seg.value / total) * 100)}%`;
          return (
            <View
              key={seg.id}
              style={[styles.stackSeg, { width, backgroundColor: seg.color }]}
            />
          );
        })}
      </View>
      <View style={styles.legend}>
        {segments.map((seg) => (
          <View key={seg.id} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
            <Text style={styles.legendText}>
              {seg.label} · {seg.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  empty: { color: theme.color.muted, fontSize: theme.font.size.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  labelCol: { width: 140, minWidth: 110 },
  label: { color: theme.color.ink, fontWeight: '700', fontSize: 13 },
  sublabel: { color: theme.color.muted, fontSize: 11, marginTop: 2 },
  track: {
    flex: 1,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#E8EEF5',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  value: {
    width: 56,
    textAlign: 'right',
    color: theme.color.navy,
    fontWeight: '800',
    fontSize: 12,
  },
  stackTrack: {
    height: 16,
    borderRadius: 999,
    backgroundColor: '#E8EEF5',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  stackSeg: { height: '100%' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: theme.color.muted, fontSize: 12, fontWeight: '600' },
});
