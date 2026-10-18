import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@lab-topo/config';
import { loanStatusLabel, type LoanStatus, type RequestBatch } from '@lab-topo/domain';
import { Badge, type BadgeTone } from '@lab-topo/ui';

type StudentRequestCardProps = {
  batch: RequestBatch;
  active: boolean;
  onToggle: () => void;
  accentText: string;
  renderDetail: (batch: RequestBatch) => React.ReactNode;
  formatDateTime: (value: string | null) => string;
  toneForStatus: (status: LoanStatus) => BadgeTone;
};

export function StudentRequestCard({
  batch,
  active,
  onToggle,
  accentText,
  renderDetail,
  formatDateTime,
  toneForStatus,
}: StudentRequestCardProps) {
  const isMulti = batch.loans.length > 1;
  const mainFolio = batch.folio || batch.loans[0]?.folio;

  return (
    <View style={[styles.card, active && [styles.cardActive, { borderColor: accentText }]]}>
      <Pressable onPress={onToggle} style={styles.cardInner}>
        {/* Cabecera de la tarjeta móvil: Folio y Estado */}
        <View style={styles.cardTop}>
          <View style={styles.folioRow}>
            <Text style={styles.folioText}>#{mainFolio}</Text>
            {isMulti && (
              <View style={styles.multiBadge}>
                <MaterialIcons name="layers" size={12} color={theme.color.navy} />
                <Text style={styles.multiBadgeText}>{batch.loans.length} equipos</Text>
              </View>
            )}
          </View>
          <Badge
            label={loanStatusLabel(batch.status)}
            tone={toneForStatus(batch.status)}
          />
        </View>

        {/* Nombre del equipo o resumen de materiales */}
        <Text style={styles.equipName}>
          {isMulti
            ? `${batch.loans.length} materiales solicitados`
            : (batch.loans[0]?.equipmentName ?? '—')}
        </Text>

        {isMulti ? (
          <Text style={styles.equipSubtitle} numberOfLines={2}>
            {batch.loans.map((l) => l.equipmentName).join(' · ')}
          </Text>
        ) : batch.loans[0]?.equipmentCode ? (
          <Text style={styles.equipCode}>
            Código: {batch.loans[0].equipmentCode}
          </Text>
        ) : null}

        {/* Cuadro de fechas clave con amplio espacio de lectura */}
        <View style={styles.datesBox}>
          <View style={styles.dateRow}>
            <View style={styles.dateLabelWrap}>
              <MaterialIcons name="event" size={13} color={theme.color.muted} />
              <Text style={styles.dateLabel}>Solicitada:</Text>
            </View>
            <Text style={styles.dateVal}>{formatDateTime(batch.requestedAt)}</Text>
          </View>
          <View style={styles.dateRow}>
            <View style={styles.dateLabelWrap}>
              <MaterialIcons name="alarm" size={13} color={theme.color.warning} />
              <Text style={[styles.dateLabel, { color: theme.color.warning }]}>
                Devolver antes de:
              </Text>
            </View>
            <Text style={[styles.dateVal, { color: theme.color.navy, fontWeight: '700' }]}>
              {formatDateTime(batch.dueAt)}
            </Text>
          </View>
        </View>

        {/* Pie de tarjeta con indicador de despliegue */}
        <View style={styles.cardFooter}>
          <Text style={styles.cardFooterText}>
            {active ? 'Ocultar materiales y detalle' : 'Tocar para ver detalle y materiales'}
          </Text>
          <MaterialIcons
            name={active ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
            size={20}
            color={theme.color.info}
          />
        </View>
      </Pressable>

      {/* Detalle expandido directamente dentro de la tarjeta */}
      {active ? renderDetail(batch) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...theme.shadow.soft,
  },
  cardActive: {
    borderColor: theme.color.info,
    borderWidth: 1.5,
  },
  cardInner: {
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  folioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  folioText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.color.navy,
    letterSpacing: 0.3,
  },
  multiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(34, 102, 216, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  multiBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.color.navy,
  },
  equipName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.color.navy,
    marginBottom: 2,
    lineHeight: 20,
  },
  equipSubtitle: {
    fontSize: 12,
    color: theme.color.ink,
    marginBottom: 10,
    lineHeight: 16,
  },
  equipCode: {
    fontSize: 12,
    color: theme.color.muted,
    marginBottom: 10,
  },
  datesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    padding: 10,
    marginTop: 4,
    marginBottom: 8,
    gap: 6,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.color.muted,
    textTransform: 'uppercase',
  },
  dateVal: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.ink,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 4,
  },
  cardFooterText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.info,
  },
});
