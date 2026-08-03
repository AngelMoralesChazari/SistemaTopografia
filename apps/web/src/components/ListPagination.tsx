import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@lab-topo/config';

type ListPaginationProps = {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  pageNumbers: number[];
  onChange: (page: number) => void;
};

export function ListPagination({
  page,
  totalPages,
  from,
  to,
  total,
  pageNumbers,
  onChange,
}: ListPaginationProps) {
  if (total <= 0) return null;

  return (
    <View style={styles.pagination}>
      <Text style={styles.pageInfo}>
        {from}–{to} de {total}
      </Text>

      <View style={styles.pageControls}>
        <Pressable
          onPress={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          style={[styles.pageNav, page <= 1 && styles.pageNavDisabled]}
        >
          <MaterialIcons
            name="chevron-left"
            size={20}
            color={page <= 1 ? theme.color.muted : theme.color.info}
          />
          <Text style={[styles.pageNavText, page <= 1 && styles.pageNavTextDisabled]}>
            Anterior
          </Text>
        </Pressable>

        <View style={styles.pageNumbers}>
          {pageNumbers.map((num) => {
            const active = num === page;
            return (
              <Pressable
                key={num}
                onPress={() => onChange(num)}
                style={[styles.pageNum, active && styles.pageNumActive]}
              >
                <Text style={[styles.pageNumText, active && styles.pageNumTextActive]}>
                  {num}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          style={[styles.pageNav, page >= totalPages && styles.pageNavDisabled]}
        >
          <Text
            style={[styles.pageNavText, page >= totalPages && styles.pageNavTextDisabled]}
          >
            Siguiente
          </Text>
          <MaterialIcons
            name="chevron-right"
            size={20}
            color={page >= totalPages ? theme.color.muted : theme.color.info}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pagination: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pageInfo: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
    fontWeight: '700',
  },
  pageControls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  pageNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pageNavDisabled: { opacity: 0.45 },
  pageNavText: {
    color: theme.color.info,
    fontWeight: '700',
    fontSize: 13,
  },
  pageNavTextDisabled: { color: theme.color.muted },
  pageNumbers: { flexDirection: 'row', gap: 4 },
  pageNum: {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pageNumActive: { backgroundColor: theme.color.infoSoft },
  pageNumText: { color: theme.color.muted, fontWeight: '700', fontSize: 13 },
  pageNumTextActive: { color: theme.color.info },
});
