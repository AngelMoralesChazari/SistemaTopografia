import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
  /** Compacta el detalle hasta que el usuario toque la casilla. */
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  /** Línea corta visible en modo compacto (ej. nombre del equipo). */
  compactHint?: string;
};

export function RequestCard({
  folio,
  statusLabel,
  statusTone = 'pending',
  rows,
  style,
  collapsible = false,
  expanded = true,
  onToggle,
  compactHint,
}: RequestCardProps) {
  const showDetails = !collapsible || expanded;
  const detailsAnim = useRef(new Animated.Value(showDetails ? 1 : 0)).current;

  useEffect(() => {
    if (!collapsible) {
      detailsAnim.setValue(1);
      return;
    }
    Animated.timing(detailsAnim, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [collapsible, expanded, detailsAnim]);

  const header = (
    <View style={[styles.head, showDetails && styles.headExpanded]}>
      <View style={styles.headText}>
        <Text style={styles.folio} numberOfLines={1}>
          {folio}
        </Text>
        {collapsible && !expanded && compactHint ? (
          <Text style={styles.hint} numberOfLines={1}>
            {compactHint}
          </Text>
        ) : null}
      </View>
      <View style={styles.headRight}>
        <Badge label={statusLabel} tone={statusTone} />
        {collapsible ? (
          <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text>
        ) : null}
      </View>
    </View>
  );

  const details = (
    <Animated.View
      style={{
        opacity: detailsAnim,
        maxHeight: detailsAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 420],
        }),
        overflow: 'hidden',
      }}
      pointerEvents={showDetails ? 'auto' : 'none'}
    >
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
    </Animated.View>
  );

  if (collapsible && onToggle) {
    return (
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.card,
          expanded && styles.cardExpanded,
          style,
          pressed && styles.cardPressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        {header}
        {details}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, style]}>
      {header}
      {details}
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
  cardExpanded: {
    borderColor: '#C5D8F0',
    backgroundColor: '#FCFDFF',
    ...theme.shadow.soft,
  },
  cardPressed: {
    backgroundColor: '#F7FAFD',
    borderColor: '#C5D8F0',
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  headExpanded: {
    marginBottom: 10,
  },
  headText: {
    flex: 1,
    minWidth: 0,
  },
  headRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  folio: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  hint: {
    marginTop: 3,
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
  },
  chevron: {
    color: theme.color.muted,
    fontSize: theme.font.size.md,
    fontWeight: '700',
    paddingHorizontal: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
  },
  rowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  label: {
    color: theme.color.muted,
    fontSize: theme.font.size.md,
  },
  value: {
    color: theme.color.ink,
    fontSize: theme.font.size.md,
    fontWeight: '700',
    maxWidth: '62%',
    textAlign: 'right',
  },
});
