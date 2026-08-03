import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@lab-topo/config';

const WEEKDAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function monthLabel(date: Date): string {
  const label = date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildMonthCells(monthCursor: Date): Array<Date | null> {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [];

  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type AppDatePickerProps = {
  value: Date;
  minimumDate?: Date;
  displayValue: string;
  placeholder?: string;
  onChange: (date: Date) => void;
};

export function AppDatePicker({
  value,
  minimumDate,
  displayValue,
  placeholder = 'DD/MM/AAAA',
  onChange,
}: AppDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => startOfDay(value));
  const minDay = minimumDate ? startOfDay(minimumDate) : null;

  useEffect(() => {
    if (open) setMonthCursor(startOfDay(value));
  }, [open, value]);

  const cells = useMemo(() => buildMonthCells(monthCursor), [monthCursor]);

  const selectDay = (day: Date) => {
    if (minDay && startOfDay(day).getTime() < minDay.getTime()) return;
    const next = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      value.getHours(),
      value.getMinutes(),
      value.getSeconds(),
      value.getMilliseconds()
    );
    onChange(next);
    setOpen(false);
  };

  const goMonth = (delta: number) => {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.field}
        accessibilityRole="button"
        accessibilityLabel="Elegir fecha de devolución"
      >
        <Text style={[styles.fieldValue, !displayValue && styles.fieldPlaceholder]}>
          {displayValue || placeholder}
        </Text>
        <View style={styles.iconWrap}>
          <MaterialIcons name="event" size={20} color={theme.color.navy} />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Elige la fecha</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8} style={styles.closeBtn}>
                <MaterialIcons name="close" size={20} color={theme.color.muted} />
              </Pressable>
            </View>

            <View style={styles.monthRow}>
              <Pressable onPress={() => goMonth(-1)} style={styles.navBtn} hitSlop={6}>
                <MaterialIcons name="chevron-left" size={24} color={theme.color.navy} />
              </Pressable>
              <Text style={styles.monthLabel}>{monthLabel(monthCursor)}</Text>
              <Pressable onPress={() => goMonth(1)} style={styles.navBtn} hitSlop={6}>
                <MaterialIcons name="chevron-right" size={24} color={theme.color.navy} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((day) => (
                <Text key={day} style={styles.weekDay}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }
                const disabled = !!minDay && startOfDay(day).getTime() < minDay.getTime();
                const selected = sameDay(day, value);
                const isToday = sameDay(day, new Date());
                return (
                  <Pressable
                    key={day.toISOString()}
                    disabled={disabled}
                    onPress={() => selectDay(day)}
                    style={[
                      styles.dayCell,
                      selected && styles.daySelected,
                      isToday && !selected && styles.dayToday,
                      disabled && styles.dayDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected && styles.dayTextSelected,
                        disabled && styles.dayTextDisabled,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable onPress={() => setOpen(false)} style={styles.doneBtn}>
              <Text style={styles.doneText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 10,
    paddingLeft: 14,
    paddingRight: 8,
    backgroundColor: '#fff',
  },
  fieldValue: {
    flex: 1,
    color: theme.color.ink,
    fontSize: theme.font.size.md,
    fontWeight: '700',
  },
  fieldPlaceholder: {
    color: theme.color.muted,
    fontWeight: '600',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.infoSoft,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    padding: 16,
    ...theme.shadow.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F5F7',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: theme.color.infoSoft,
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    color: theme.color.navy,
    fontSize: theme.font.size.md,
    fontWeight: '800',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekDay: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: theme.color.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  daySelected: {
    backgroundColor: theme.color.navy,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: theme.color.info,
  },
  dayDisabled: {
    opacity: 0.35,
  },
  dayText: {
    color: theme.color.ink,
    fontSize: theme.font.size.md,
    fontWeight: '700',
  },
  dayTextSelected: {
    color: '#fff',
  },
  dayTextDisabled: {
    color: theme.color.muted,
  },
  doneBtn: {
    marginTop: 12,
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.color.infoSoft,
  },
  doneText: {
    color: theme.color.navy,
    fontSize: theme.font.size.md,
    fontWeight: '800',
  },
});
