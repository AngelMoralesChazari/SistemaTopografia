import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@lab-topo/config';
import {
  isAdminRole,
  loanStatusLabel,
  type Loan,
  type LoanStatus,
  type RequestBatch,
  buildRequestBatches,
} from '@lab-topo/domain';
import {
  adminOverrideLoanStatus,
  deliverLoan,
  rejectLoan,
  returnLoan,
  watchLabQueue,
  writeAuditLog,
} from '@lab-topo/services';
import { Badge, Button, Notice, type BadgeTone } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';
import { ListPagination } from '../components/ListPagination';
import { paginate } from '../lib/pagination';

function toneForStatus(status: LoanStatus): BadgeTone {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'delivered':
      return 'delivered';
    case 'returned_late':
    case 'damaged':
    case 'lost':
      return 'late';
    default:
      return 'ok';
  }
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RequestsPage() {
  const { width, height } = useWindowDimensions();
  const isMobile = width < 768;
  const scrollViewRef = useRef<ScrollView>(null);
  const detailCardY = useRef<number>(0);
  const { user } = useAuth();
  const canManage =
    !!user && (isAdminRole(user.role) || user.role === 'lab_manager');
  const canOverride = !!user && isAdminRole(user.role);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deliverModalOpen, setDeliverModalOpen] = useState(false);
  const [isPerfectCondition, setIsPerfectCondition] = useState(true);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliverError, setDeliverError] = useState<string | null>(null);
  const [materialsExpanded, setMaterialsExpanded] = useState(false);
  const [deliverListExpanded, setDeliverListExpanded] = useState(false);

  useEffect(() => {
    setMaterialsExpanded(false);
  }, [selectedId]);

  useEffect(() => {
    if (!user) return;
    const unsub = watchLabQueue(
      user.labId,
      (next) => {
        setLoans(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [user]);

  const batches = useMemo(() => buildRequestBatches(loans), [loans]);

  const paging = useMemo(() => paginate(batches, page), [batches, page]);

  useEffect(() => {
    if (page !== paging.page) setPage(paging.page);
  }, [page, paging.page]);

  useEffect(() => {
    if (!selectedId) {
      if (paging.pageItems[0]) {
        setSelectedId(paging.pageItems[0].id);
      }
      return;
    }
    const exists = batches.some((b) => b.id === selectedId);
    if (!exists && paging.pageItems[0]) {
      setSelectedId(paging.pageItems[0].id);
    }
  }, [batches, paging.pageItems, selectedId]);

  const selectedBatch = useMemo(
    () => batches.find((b) => b.id === selectedId) ?? batches[0] ?? null,
    [batches, selectedId]
  );

  const selected = useMemo(() => selectedBatch?.loans[0] ?? null, [selectedBatch]);

  const kpis = useMemo(() => {
    const pending = batches.filter((b) => b.status === 'pending').length;
    const delivered = batches.filter((b) => b.status === 'delivered').length;
    const overdue = batches.filter(
      (b) => b.status === 'delivered' && b.dueAt && new Date(b.dueAt).getTime() < Date.now()
    ).length;
    return { pending, delivered, overdue, total: batches.length };
  }, [batches]);

  const runAction = async (action: () => Promise<void>, okMessage: string) => {
    if (!user || !canManage) return;
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(okMessage);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  };

  const runManagedAction = async (
    action: () => Promise<void>,
    okMessage: string,
    audit?: { action: string; summary: string; before?: string; after?: string }
  ) => {
    await runAction(async () => {
      await action();
      if (user && isAdminRole(user.role) && audit) {
        try {
          await writeAuditLog({
            labId: user.labId,
            actorId: user.uid,
            actorEmail: user.email,
            actorName: user.displayName,
            actorRole: user.role,
            action: audit.action,
            targetType: 'loan',
            targetId: selected?.id ?? '',
            summary: audit.summary,
            before: audit.before ?? null,
            after: audit.after ?? null,
          });
        } catch {
          // no bloquea la acción principal
        }
      }
    }, okMessage);
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.root}
      contentContainerStyle={[styles.content, isMobile && styles.contentMobile]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, isMobile && styles.titleMobile]}>Solicitudes activas</Text>
          <Text style={styles.subtitle}>
            Cola en tiempo real del laboratorio · sincronizada con la app móvil
          </Text>
        </View>
      </View>

      <View style={[styles.kpis, isMobile && styles.kpisMobile]}>
        {[
          { label: 'Pendientes', value: String(kpis.pending) },
          { label: 'En préstamo', value: String(kpis.delivered) },
          { label: 'Activas', value: String(kpis.total) },
          { label: 'Con retraso', value: String(kpis.overdue), alert: kpis.overdue > 0 },
        ].map((kpi) => (
          <View
            key={kpi.label}
            style={[
              styles.kpi,
              isMobile && styles.kpiMobile,
              kpi.alert && styles.kpiAlert,
            ]}
          >
            <Text style={[styles.kpiLabel, kpi.alert && styles.kpiLabelAlert]}>{kpi.label}</Text>
            <Text
              style={[
                styles.kpiValue,
                isMobile && styles.kpiValueMobile,
                kpi.alert && styles.kpiValueAlert,
              ]}
            >
              {kpi.value}
            </Text>
          </View>
        ))}
      </View>

      {message ? <Notice title={message} /> : null}
      {error ? <Notice tone="danger" title="Error al cargar" description={error} /> : null}
      {loading ? <ActivityIndicator color={theme.color.navy} /> : null}

      {!loading && batches.length === 0 ? (
        <Notice
          title="Sin solicitudes activas"
          description="Cuando un alumno solicite material desde el teléfono, aparecerá aquí."
        />
      ) : null}

      <View style={[styles.workspace, isMobile && styles.workspaceMobile]}>
        <View style={[styles.listCard, isMobile && styles.cardMobile]}>
          <Text style={styles.cardTitle}>Cola operativa</Text>
          {paging.pageItems.map((batch) => {
            const active = batch.id === selectedId;
            const isMulti = batch.loans.length > 1;
            return (
              <Pressable
                key={batch.id}
                onPress={() => {
                  setSelectedId(batch.id);
                  if (isMobile && detailCardY.current > 0) {
                    scrollViewRef.current?.scrollTo({
                      y: detailCardY.current - 12,
                      animated: true,
                    });
                  }
                }}
                style={[styles.row, active && styles.rowActive]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowTopBar}>
                    <View style={styles.rowFolioWrap}>
                      <Text style={styles.rowFolio}>
                        {isMulti && !batch.loans.every((l) => l.folio === batch.loans[0].folio)
                          ? `#${batch.loans[0].folio} (+${batch.loans.length - 1})`
                          : `#${batch.loans[0].folio}`}
                      </Text>
                      {isMobile && active && (
                        <View style={styles.activePill}>
                          <Text style={styles.activePillText}>Activa</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexShrink: 0, marginLeft: 'auto' }}>
                      <Badge
                        label={loanStatusLabel(batch.status)}
                        tone={toneForStatus(batch.status)}
                      />
                    </View>
                  </View>

                  {/* Nombre del alumno mostrado una única vez */}
                  <Text style={styles.rowName} numberOfLines={1}>
                    {batch.studentName}
                  </Text>

                  {/* Resumen compacto de materiales en cola */}
                  <View style={styles.rowCompactLine}>
                    {isMulti ? (
                      <View style={styles.rowCompactBadgeWrap}>
                        <View style={styles.batchCountPill}>
                          <MaterialIcons name="layers" size={12} color={theme.color.navy} />
                          <Text style={styles.batchCountPillText}>
                            {batch.loans.length} materiales
                          </Text>
                        </View>
                        <Text style={styles.rowCompactSnippet} numberOfLines={1}>
                          {batch.loans[0].equipmentName} +{batch.loans.length - 1} más
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.rowCompactSnippet} numberOfLines={1}>
                        <Text style={{ fontWeight: '600', color: theme.color.ink }}>
                          {batch.loans[0].equipmentName}
                        </Text>
                        {' · '}
                        <Text style={{ color: theme.color.muted, fontSize: 12 }}>
                          {batch.loans[0].equipmentCode}
                        </Text>
                      </Text>
                    )}
                  </View>

                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {formatDate(batch.requestedAt)} · Prof. {batch.teacherName}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <ListPagination
            page={paging.page}
            totalPages={paging.totalPages}
            from={paging.from}
            to={paging.to}
            total={paging.total}
            pageNumbers={paging.pageNumbers}
            onChange={setPage}
          />

          {isMobile && selectedBatch && (
            <Pressable
              style={styles.jumpToDetailBtn}
              onPress={() => {
                if (detailCardY.current > 0) {
                  scrollViewRef.current?.scrollTo({
                    y: detailCardY.current - 12,
                    animated: true,
                  });
                }
              }}
            >
              <MaterialIcons name="arrow-downward" size={16} color={theme.color.navy} />
              <Text style={styles.jumpToDetailText}>
                {selectedBatch.loans.length > 1
                  ? `Ver detalle (${selectedBatch.loans.length} materiales) abajo`
                  : `Ver detalle de #${selectedBatch.loans[0].folio} abajo`}
              </Text>
            </Pressable>
          )}
        </View>

        <View
          style={[styles.detailCard, isMobile && styles.cardMobile]}
          onLayout={(e) => {
            detailCardY.current = e.nativeEvent.layout.y;
          }}
        >
          {isMobile && (
            <Pressable
              style={styles.backToQueueBtn}
              onPress={() => {
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
              }}
            >
              <MaterialIcons name="arrow-upward" size={16} color={theme.color.muted} />
              <Text style={styles.backToQueueText}>Subir a la cola operativa</Text>
            </Pressable>
          )}
          <Text style={styles.cardTitle}>Detalle</Text>
          {!selectedBatch ? (
            <Text style={styles.emptyDetail}>Selecciona una solicitud de la cola.</Text>
          ) : (
            <>
              <View style={styles.detailHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.detailFolio}>
                    #{selectedBatch.loans[0].folio}
                  </Text>
                  {selectedBatch.loans.length > 1 && (
                    <Text style={styles.detailFolioSub}>
                      Solicitud global con {selectedBatch.loans.length} materiales solicitados
                    </Text>
                  )}
                </View>
                <View style={{ flexShrink: 0 }}>
                  <Badge
                    label={loanStatusLabel(selectedBatch.status)}
                    tone={toneForStatus(selectedBatch.status)}
                  />
                </View>
              </View>

              {[
                ['Alumno', selectedBatch.studentName],
                ['Matrícula', selectedBatch.studentNumber ?? '—'],
                ['Profesor', selectedBatch.teacherName],
                ['Solicitada', formatDate(selectedBatch.requestedAt)],
                ['Fecha límite', formatDate(selectedBatch.dueAt)],
              ].map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ))}

              <Pressable
                onPress={() => setMaterialsExpanded((prev) => !prev)}
                style={styles.batchAccordionHeader}
                accessibilityRole="button"
                accessibilityLabel="Alternar visualización de materiales"
              >
                <View style={styles.batchAccordionTitleWrap}>
                  <MaterialIcons
                    name="inventory-2"
                    size={18}
                    color={theme.color.navy}
                  />
                  <Text style={styles.batchSectionTitle}>
                    Materiales solicitados ({selectedBatch.loans.length})
                  </Text>
                </View>
                <View style={styles.accordionToggleBadge}>
                  <Text style={styles.accordionToggleBadgeText}>
                    {materialsExpanded ? 'Ocultar' : 'Ver detalle'}
                  </Text>
                  <MaterialIcons
                    name={materialsExpanded ? 'expand-less' : 'expand-more'}
                    size={18}
                    color={theme.color.navy}
                  />
                </View>
              </Pressable>

              {!materialsExpanded ? (
                <Pressable
                  onPress={() => setMaterialsExpanded(true)}
                  style={styles.materialsCompactCard}
                >
                  <View style={styles.materialsCompactTop}>
                    <MaterialIcons name="touch-app" size={15} color={theme.color.navy} />
                    <Text style={styles.materialsCompactPrompt}>
                      Toca aquí para ver los {selectedBatch.loans.length} equipos con sus kits y accesorios
                    </Text>
                  </View>
                  {/* <View style={styles.materialsCompactList}>
                    {selectedBatch.loans.slice(0, 3).map((l, i) => (
                      <View key={l.id} style={styles.materialsCompactRow}>
                        <Text style={styles.materialsCompactIndex}>{i + 1}.</Text>
                        <Text style={styles.materialsCompactName} numberOfLines={1}>
                          {l.equipmentName}{' '}
                          <Text style={{ color: theme.color.muted, fontSize: 11 }}>
                            ({l.equipmentCode})
                          </Text>
                        </Text>
                      </View>
                    ))}
                    {selectedBatch.loans.length > 3 && (
                      <Text style={styles.materialsCompactMore}>
                        + {selectedBatch.loans.length - 3} materiales más en este pedido...
                      </Text>
                    )}
                  </View> */}
                </Pressable>
              ) : (
                selectedBatch.loans.map((item, idx) => (
                  <View key={item.id} style={styles.batchItemCard}>
                    <View style={styles.batchItemHeader}>
                      <View style={styles.batchItemNumberWrap}>
                        <Text style={styles.batchItemNumber}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.batchItemName}>{item.equipmentName}</Text>
                        <Text style={styles.batchItemMeta}>
                          Código: {item.equipmentCode} · Folio #{item.folio}
                        </Text>
                      </View>
                    </View>

                    {item.kitItems && item.kitItems.length > 0 ? (
                      <View style={styles.kitBox}>
                        <Text style={styles.kitBoxTitle}>
                          Kit incluido ({item.kitItems.length} artículos):
                        </Text>
                        <View style={styles.kitBoxGrid}>
                          {item.kitItems.map((k, i) => (
                            <View key={i} style={styles.kitItemRow}>
                              <MaterialIcons name="check" size={13} color={theme.color.success} />
                              <Text style={styles.kitItemText}>{k}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {item.extraItems && item.extraItems.length > 0 ? (
                      <View style={styles.extraBox}>
                        <Text style={styles.extraBoxTitle}>Materiales extras solicitados:</Text>
                        {item.extraItems.map((ex, i) => (
                          <View key={i} style={styles.extraRow}>
                            <Text style={styles.extraName}>
                              • {ex.name} ({ex.internalCode})
                            </Text>
                            <Text style={styles.extraQty}>Cant: {ex.quantity}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {item.deliveryNotes ? (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesBoxLabel}>Estado al entregar:</Text>
                        <Text style={styles.notesBoxText}>{item.deliveryNotes}</Text>
                      </View>
                    ) : item.status === 'delivered' ? (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesBoxLabel}>Estado al entregar:</Text>
                        <Text style={styles.notesBoxText}>Sin observaciones (perfecto estado)</Text>
                      </View>
                    ) : null}
                  </View>
                ))
              )}

              {canManage && (selectedBatch.status === 'pending' || selectedBatch.status === 'approved') ? (
                <View style={styles.actions}>
                  <Text style={styles.fieldLabel}>Fecha límite de devolución</Text>
                  <TextInput
                    value={dueDate}
                    onChangeText={setDueDate}
                    placeholder="AAAA-MM-DD"
                    style={styles.input}
                  />
                  <View style={styles.actionRow}>
                    <Button
                      title={
                        selectedBatch.loans.length > 1
                          ? `Entregar ${selectedBatch.loans.length} materiales`
                          : 'Entregar equipo'
                      }
                      loading={busy}
                      fullWidth={false}
                      style={{ flex: 1 }}
                      onPress={() => {
                        setDeliverModalOpen(true);
                        setIsPerfectCondition(true);
                        setDeliveryNotes('');
                        setDeliverError(null);
                        setDeliverListExpanded(false);
                      }}
                    />
                    {selectedBatch.status === 'pending' ? (
                      <Button
                        title={
                          selectedBatch.loans.length > 1
                            ? 'Rechazar pedido'
                            : 'Rechazar'
                        }
                        variant="danger"
                        loading={busy}
                        fullWidth={false}
                        style={{ flex: 1 }}
                        onPress={() =>
                          runManagedAction(
                            async () => {
                              for (const loan of selectedBatch.loans) {
                                await rejectLoan(loan.id, user!.uid, 'Rechazada desde web');
                              }
                            },
                            selectedBatch.loans.length > 1
                              ? `Pedido de ${selectedBatch.loans.length} materiales rechazado.`
                              : 'Solicitud rechazada.',
                            {
                              action: 'loan.reject_batch',
                              summary: `Rechazó pedido de ${selectedBatch.studentName} (${selectedBatch.loans.map((l) => '#' + l.folio).join(', ')})`,
                              before: 'pending',
                              after: 'rejected',
                            }
                          )
                        }
                      />
                    ) : null}
                  </View>
                </View>
              ) : null}

              {canManage && selectedBatch.status === 'delivered' ? (
                <View style={styles.actions}>
                  <Button
                    title={
                      selectedBatch.loans.length > 1
                        ? `Registrar devolución (${selectedBatch.loans.length} materiales)`
                        : 'Registrar devolución'
                    }
                    loading={busy}
                    onPress={() => {
                      const late = selectedBatch.dueAt
                        ? new Date(selectedBatch.dueAt).getTime() < Date.now()
                        : false;
                      return runManagedAction(
                        async () => {
                          for (const loan of selectedBatch.loans) {
                            await returnLoan(loan.id, user!.uid, { late });
                          }
                        },
                        late
                          ? 'Materiales devueltos con retraso.'
                          : 'Devolución de materiales registrada.',
                        {
                          action: 'loan.return_batch',
                          summary: `Devolvió pedido de ${selectedBatch.studentName} (${selectedBatch.loans.map((l) => '#' + l.folio).join(', ')})`,
                          before: 'delivered',
                          after: late ? 'returned_late' : 'returned',
                        }
                      );
                    }}
                  />
                </View>
              ) : null}

              {canOverride &&
              (selectedBatch.status === 'pending' ||
                selectedBatch.status === 'approved' ||
                selectedBatch.status === 'rejected') ? (
                <View style={styles.actions}>
                  <Text style={styles.fieldLabel}>Corrección administrativa</Text>
                  <Text style={styles.overrideHint}>
                    Puedes modificar una decisión del encargado (aceptar, rechazar o reabrir).
                  </Text>
                  <View style={styles.actionRow}>
                    {selectedBatch.status !== 'approved' ? (
                      <Button
                        title="Marcar aprobadas"
                        loading={busy}
                        fullWidth={false}
                        style={{ flex: 1 }}
                        onPress={() =>
                          runAction(
                            async () => {
                              for (const loan of selectedBatch.loans) {
                                await adminOverrideLoanStatus(loan.id, 'approved', {
                                  uid: user!.uid,
                                  email: user!.email,
                                  displayName: user!.displayName,
                                  role: user!.role,
                                  labId: user!.labId,
                                });
                              }
                            },
                            'Solicitudes marcadas como aprobadas.'
                          )
                        }
                      />
                    ) : null}
                    {selectedBatch.status !== 'rejected' ? (
                      <Button
                        title="Marcar rechazadas"
                        variant="danger"
                        loading={busy}
                        fullWidth={false}
                        style={{ flex: 1 }}
                        onPress={() =>
                          runAction(
                            async () => {
                              for (const loan of selectedBatch.loans) {
                                await adminOverrideLoanStatus(
                                  loan.id,
                                  'rejected',
                                  {
                                    uid: user!.uid,
                                    email: user!.email,
                                    displayName: user!.displayName,
                                    role: user!.role,
                                    labId: user!.labId,
                                  },
                                  'Rechazo administrativo'
                                );
                              }
                            },
                            'Solicitudes marcadas como rechazadas.'
                          )
                        }
                      />
                    ) : null}
                    {selectedBatch.status !== 'pending' ? (
                      <Button
                        title="Reabrir (pendientes)"
                        variant="secondary"
                        loading={busy}
                        fullWidth={false}
                        style={{ flex: 1 }}
                        onPress={() =>
                          runAction(
                            async () => {
                              for (const loan of selectedBatch.loans) {
                                await adminOverrideLoanStatus(loan.id, 'pending', {
                                  uid: user!.uid,
                                  email: user!.email,
                                  displayName: user!.displayName,
                                  role: user!.role,
                                  labId: user!.labId,
                                });
                              }
                            },
                            'Solicitudes reabiertas en pendiente.'
                          )
                        }
                      />
                    ) : null}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>

      <Modal
        visible={deliverModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeliverModalOpen(false)}
      >
        <View style={[styles.modalBackdrop, isMobile && { padding: 12 }]}>
          <View
            style={[
              styles.modalCard,
              isMobile && styles.modalCardMobile,
              { maxHeight: Math.min(680, height - (isMobile ? 24 : 48)) },
            ]}
          >
            {/* Header fijo */}
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalIconWrap}>
                <MaterialIcons name="assignment-turned-in" size={24} color={theme.color.navy} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  Verificación y entrega
                </Text>
                <Text style={styles.modalSubtitle} numberOfLines={2}>
                  Registra el estado del material para proteger al alumno de desperfectos previos.
                </Text>
              </View>
              <Pressable
                onPress={() => setDeliverModalOpen(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Cerrar modal"
              >
                <MaterialIcons name="close" size={20} color={theme.color.muted} />
              </Pressable>
            </View>

            {/* Cuerpo con scroll independiente */}
            <ScrollView
              style={styles.modalScrollBody}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {selectedBatch ? (
                <View style={styles.summaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Alumno receptor</Text>
                    <Text style={styles.summaryValue}>
                      {selectedBatch.studentName}
                      {selectedBatch.studentNumber ? ` (${selectedBatch.studentNumber})` : ''}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Profesor</Text>
                    <Text style={styles.summaryValue}>{selectedBatch.teacherName}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total materiales</Text>
                    <Text style={[styles.summaryValue, { color: theme.color.navy, fontWeight: '800' }]}>
                      {selectedBatch.loans.length}{' '}
                      {selectedBatch.loans.length === 1 ? 'material' : 'materiales'}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Fecha límite</Text>
                    <Text style={styles.summaryValue}>{dueDate}</Text>
                  </View>
                  <Pressable
                    onPress={() => setDeliverListExpanded((v) => !v)}
                    style={[
                      styles.summaryRow,
                      !deliverListExpanded && styles.summaryRowLast,
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 10,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.summaryLabel}>Lista a entregar:</Text>
                      <Text
                        style={{ fontSize: 12, color: theme.color.ink, fontWeight: '600', marginTop: 2 }}
                        numberOfLines={1}
                      >
                        {selectedBatch.loans.length} equipos · {selectedBatch.loans[0].equipmentName}
                        {selectedBatch.loans.length > 1 ? ` (+${selectedBatch.loans.length - 1} más)` : ''}
                      </Text>
                    </View>
                    <View style={styles.modalListToggleBadge}>
                      <Text style={styles.modalListToggleBadgeText}>
                        {deliverListExpanded ? 'Ocultar' : 'Ver lista'}
                      </Text>
                      <MaterialIcons
                        name={deliverListExpanded ? 'expand-less' : 'expand-more'}
                        size={16}
                        color={theme.color.navy}
                      />
                    </View>
                  </Pressable>

                  {deliverListExpanded && (
                    <View style={styles.modalExpandedListContainer}>
                      {selectedBatch.loans.map((loan, idx) => (
                        <View key={loan.id} style={styles.modalExpandedListRow}>
                          <Text style={styles.modalExpandedListNum}>{idx + 1}.</Text>
                          <Text style={styles.modalExpandedListText}>
                            <Text style={{ fontWeight: '700', color: theme.color.ink }}>
                              {loan.equipmentName}
                            </Text>{' '}
                            <Text style={{ color: theme.color.muted, fontSize: 11 }}>
                              ({loan.equipmentCode}) · #{loan.folio}
                            </Text>
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : null}

              {deliverError ? (
                <View style={{ marginBottom: 12 }}>
                  <Notice tone="danger" title="Atención" description={deliverError} />
                </View>
              ) : null}

              {/* Checkbox Perfecto Estado */}
              <Pressable
                onPress={() => {
                  const next = !isPerfectCondition;
                  setIsPerfectCondition(next);
                  if (next) {
                    setDeliverError(null);
                  }
                }}
                style={[styles.checkRow, isPerfectCondition && styles.checkRowActive]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isPerfectCondition }}
              >
                <MaterialIcons
                  name={isPerfectCondition ? 'check-box' : 'check-box-outline-blank'}
                  size={24}
                  color={isPerfectCondition ? theme.color.success : theme.color.muted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.checkLabel, isPerfectCondition && styles.checkLabelActive]}>
                    Equipo en perfecto estado
                  </Text>
                  <Text style={styles.checkHint}>
                    Sin rayones, roturas, manchas ni fallas previas. Entrega directa sin detalles.
                  </Text>
                </View>
              </Pressable>

              {/* Quick chips para observaciones comunes */}
              <View style={styles.quickChipsSection}>
                <Text style={styles.quickChipsTitle}>
                  Observaciones rápidas (desmarca "perfecto estado"):
                </Text>
                <View style={styles.chipsRow}>
                  {[
                    'Rayones leves',
                    'Desgaste estético',
                    'Manchas en estuche/equipo',
                    'Rotura o fisura menor',
                    'Tornillos/piezas flojas',
                  ].map((chip) => (
                    <Pressable
                      key={chip}
                      style={styles.chip}
                      onPress={() => {
                        setIsPerfectCondition(false);
                        setDeliveryNotes((prev) => {
                          const trimmed = prev.trim();
                          if (!trimmed) return chip;
                          if (trimmed.includes(chip)) return trimmed;
                          return `${trimmed}, ${chip}`;
                        });
                      }}
                    >
                      <MaterialIcons name="add" size={14} color={theme.color.navy} />
                      <Text style={styles.chipText}>{chip}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Textarea de Observaciones */}
              <View style={styles.notesBlock}>
                <Text style={styles.fieldLabel}>
                  Observaciones o desperfectos observados {!isPerfectCondition ? '(requerido)' : '(opcional)'}
                </Text>
                <TextInput
                  value={deliveryNotes}
                  onChangeText={(text) => {
                    setDeliveryNotes(text);
                    if (text.trim().length > 0) {
                      setIsPerfectCondition(false);
                    }
                  }}
                  placeholder="Ej. Rayones en la base, estuche manchado, pequeña fisura en perilla..."
                  placeholderTextColor={theme.color.muted}
                  multiline
                  numberOfLines={3}
                  style={styles.textArea}
                />
              </View>
            </ScrollView>

            {/* Footer con botones de acción fijo abajo */}
            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                variant="secondary"
                fullWidth={false}
                style={styles.modalBtn}
                disabled={busy}
                onPress={() => setDeliverModalOpen(false)}
              />
              <Button
                title="Confirmar entrega"
                loading={busy}
                fullWidth={false}
                style={styles.modalBtn}
                onPress={async () => {
                  if (!selectedBatch || !user) return;
                  if (!isPerfectCondition && !deliveryNotes.trim()) {
                    setDeliverError(
                      'Por favor escribe las observaciones del equipo o marca la casilla de "Equipo en perfecto estado".'
                    );
                    return;
                  }
                  setDeliverError(null);
                  const noteToSave = isPerfectCondition ? null : deliveryNotes.trim();
                  await runManagedAction(
                    async () => {
                      for (const loan of selectedBatch.loans) {
                        await deliverLoan(loan.id, user.uid, dueDate, {
                          deliveryNotes: noteToSave,
                        });
                      }
                    },
                    selectedBatch.loans.length > 1
                      ? `${selectedBatch.loans.length} materiales entregados correctamente.`
                      : 'Equipo entregado correctamente.',
                    {
                      action: 'loan.deliver_batch',
                      summary: `Entregó pedido a ${selectedBatch.studentName} (${selectedBatch.loans.map((l) => '#' + l.folio).join(', ')})${noteToSave ? ` (${noteToSave})` : ' (perfecto estado)'}`,
                      before: selectedBatch.status,
                      after: 'delivered',
                    }
                  );
                  setDeliverModalOpen(false);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.canvas, width: '100%' },
  content: { padding: 32, paddingBottom: 48, width: '100%', maxWidth: '100%' },
  contentMobile: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 40 },
  header: { marginBottom: 20 },
  title: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  titleMobile: {
    fontSize: 22,
    letterSpacing: -0.4,
  },
  subtitle: { marginTop: 8, color: theme.color.muted, fontSize: theme.font.size.md },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18, width: '100%' },
  kpisMobile: { gap: 8, marginBottom: 14 },
  kpi: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 100,
    padding: 16,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
  },
  kpiMobile: {
    flexBasis: '47%',
    minWidth: 0,
    minHeight: 74,
    padding: 12,
  },
  kpiAlert: { backgroundColor: theme.color.red, borderColor: theme.color.red },
  kpiLabel: { color: theme.color.muted, fontSize: theme.font.size.sm },
  kpiLabelAlert: { color: '#FFE2E7' },
  kpiValue: {
    marginTop: 12,
    color: theme.color.navy,
    fontSize: theme.font.size.xxl,
    fontWeight: '800',
  },
  kpiValueMobile: {
    marginTop: 6,
    fontSize: 22,
  },
  kpiValueAlert: { color: '#fff' },
  workspace: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'flex-start',
    width: '100%',
  },
  workspaceMobile: {
    flexDirection: 'column',
    gap: 14,
  },
  listCard: {
    flexGrow: 1,
    flexBasis: 360,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 18,
    width: '100%',
    minWidth: 0,
  },
  detailCard: {
    flexGrow: 1,
    flexBasis: 320,
    maxWidth: 460,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 18,
    width: '100%',
    minWidth: 0,
  },
  cardMobile: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    padding: 14,
  },
  activePill: {
    backgroundColor: theme.color.infoSoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activePillText: {
    color: theme.color.info,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  jumpToDetailBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  jumpToDetailText: {
    color: theme.color.navy,
    fontSize: 13,
    fontWeight: '700',
  },
  backToQueueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
  },
  backToQueueText: {
    color: theme.color.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '700',
    marginBottom: 12,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
    marginBottom: 4,
  },
  rowActive: { backgroundColor: '#F5F9FF' },
  rowTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
    flexWrap: 'wrap',
  },
  rowFolioWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  rowFolio: { color: theme.color.muted, fontSize: theme.font.size.sm, fontWeight: '700' },
  batchPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  batchCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  batchCountPillText: {
    color: theme.color.navy,
    fontSize: 11,
    fontWeight: '700',
  },
  rowCompactLine: {
    marginTop: 4,
    marginBottom: 4,
  },
  rowCompactBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  rowCompactSnippet: {
    fontSize: theme.font.size.sm,
    color: theme.color.muted,
    flexShrink: 1,
  },
  rowName: { color: theme.color.ink, fontSize: theme.font.size.lg, fontWeight: '700', marginTop: 2 },
  rowMaterialsList: {
    marginTop: 4,
    marginBottom: 6,
    gap: 3,
  },
  rowMaterialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowMaterialText: {
    fontSize: theme.font.size.sm,
    color: theme.color.ink,
    flexShrink: 1,
  },
  rowMeta: { color: theme.color.muted, fontSize: theme.font.size.sm, marginTop: 2 },
  emptyDetail: { color: theme.color.muted, fontSize: theme.font.size.md },
  detailHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
    flexWrap: 'wrap',
  },
  detailFolio: { color: theme.color.navy, fontSize: theme.font.size.xl, fontWeight: '800' },
  detailFolioSub: {
    color: theme.color.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
    gap: 8,
  },
  detailLabel: { color: theme.color.muted, fontSize: theme.font.size.md, flexShrink: 0 },
  detailValue: {
    color: theme.color.ink,
    fontSize: theme.font.size.md,
    fontWeight: '700',
    maxWidth: '65%',
    textAlign: 'right',
  },
  batchSectionHead: {
    marginTop: 14,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
    paddingBottom: 6,
  },
  batchAccordionHeader: {
    marginTop: 14,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  batchAccordionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  accordionToggleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  accordionToggleBadgeText: {
    color: theme.color.navy,
    fontSize: 12,
    fontWeight: '700',
  },
  materialsCompactCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  materialsCompactTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  materialsCompactPrompt: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.navy,
    flex: 1,
  },
  materialsCompactList: {
    gap: 3,
    paddingLeft: 4,
  },
  materialsCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  materialsCompactIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.navy,
    width: 16,
  },
  materialsCompactName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.ink,
    flex: 1,
  },
  materialsCompactMore: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.color.muted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  batchSectionTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.sm,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  batchItemCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  batchItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  batchItemNumberWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.color.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  batchItemNumber: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  batchItemName: {
    fontSize: theme.font.size.sm,
    fontWeight: '700',
    color: theme.color.navy,
  },
  batchItemMeta: {
    fontSize: 11,
    color: theme.color.muted,
    marginTop: 1,
  },
  kitBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kitBoxTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.color.navy,
    marginBottom: 4,
  },
  kitBoxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  kitItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '48%',
    minWidth: 120,
  },
  kitItemText: {
    fontSize: 11,
    color: theme.color.ink,
  },
  extraBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  extraBoxTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.color.navy,
    marginBottom: 4,
  },
  extraRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  extraName: {
    fontSize: 11,
    color: theme.color.ink,
    fontWeight: '600',
  },
  extraQty: {
    fontSize: 11,
    color: theme.color.navy,
    fontWeight: '800',
  },
  notesBox: {
    marginTop: 6,
    padding: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  notesBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.color.muted,
    textTransform: 'uppercase',
  },
  notesBoxText: {
    fontSize: 11,
    color: theme.color.ink,
    marginTop: 1,
  },
  modalCardMobile: {
    padding: 0,
    borderRadius: 12,
  },
  actions: { marginTop: 16, gap: 10 },
  fieldLabel: {
    color: theme.color.navy,
    fontSize: theme.font.size.sm,
    fontWeight: '800',
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    color: theme.color.ink,
    backgroundColor: '#fff',
    fontSize: theme.font.size.md,
  },
  actionRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  overrideHint: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
    marginBottom: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: theme.color.surface,
    borderRadius: 14,
    padding: 0,
    borderWidth: 1,
    borderColor: theme.color.line,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
    backgroundColor: '#fff',
  },
  modalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
  },
  modalSubtitle: {
    marginTop: 2,
    color: theme.color.muted,
    fontSize: theme.font.size.xs,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    marginLeft: 6,
  },
  modalScrollBody: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
  },
  summaryBox: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F3',
  },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryLabel: { color: theme.color.muted, fontSize: theme.font.size.sm },
  summaryValue: {
    flex: 1,
    color: theme.color.ink,
    fontSize: theme.font.size.sm,
    fontWeight: '700',
    textAlign: 'right',
  },
  modalListToggleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modalListToggleBadgeText: {
    color: theme.color.navy,
    fontSize: 11,
    fontWeight: '700',
  },
  modalExpandedListContainer: {
    paddingTop: 6,
    paddingBottom: 8,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
  },
  modalExpandedListRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    paddingVertical: 2,
  },
  modalExpandedListNum: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.navy,
    width: 18,
  },
  modalExpandedListText: {
    flex: 1,
    fontSize: 12,
    color: theme.color.ink,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  checkRowActive: {
    borderColor: theme.color.success,
    backgroundColor: theme.color.successSoft,
  },
  checkLabel: {
    color: theme.color.ink,
    fontSize: theme.font.size.md,
    fontWeight: '700',
  },
  checkLabelActive: {
    color: theme.color.success,
  },
  checkHint: {
    color: theme.color.muted,
    fontSize: theme.font.size.xs,
    marginTop: 2,
  },
  quickChipsSection: {
    marginBottom: 12,
  },
  quickChipsTitle: {
    color: theme.color.muted,
    fontSize: theme.font.size.xs,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  chipText: {
    color: theme.color.navy,
    fontSize: theme.font.size.xs,
    fontWeight: '600',
  },
  notesBlock: {
    marginBottom: 16,
  },
  textArea: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 8,
    padding: 10,
    minHeight: 70,
    textAlignVertical: 'top',
    color: theme.color.ink,
    backgroundColor: '#fff',
    fontSize: theme.font.size.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
    backgroundColor: '#FAFCFF',
  },
  modalBtn: {
    flex: 1,
  },
});
