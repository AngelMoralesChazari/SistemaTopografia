import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@lab-topo/config';
import type { AppUser, Equipment, Loan } from '@lab-topo/domain';
import {
  watchEquipment,
  watchLabLoans,
  watchLabUsers,
} from '@lab-topo/services';
import { Button, Notice } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';
import {
  computeDynamicTitle,
  downloadReportHtml,
  downloadReportPdf,
  generateReportFolio,
  generateReportHtml,
  loadHtml2Pdf,
  REPORT_MODULE_DEFS,
  type ReportConfig,
  type ReportModule,
} from '../lib/reportGenerator';

function getTodayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDaysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultRoleLabel(role?: string): string {
  switch (role) {
    case 'lab_manager':
      return 'Encargado de Laboratorio';
    case 'super_admin':
      return 'Administrador';
    case 'admin':
      return 'Administrador';
    case 'teacher':
      return 'Profesor Supervisor';
    default:
      return 'Responsable de Laboratorio';
  }
}

export function ReportsPage() {
  const { user } = useAuth();
  const today = useMemo(() => getTodayIso(), []);

  // Data listeners
  const [loans, setLoans] = useState<Loan[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Form State
  const [authorName, setAuthorName] = useState(user?.displayName || 'Responsable');
  const [authorRole, setAuthorRole] = useState(defaultRoleLabel(user?.role));
  const [startDate, setStartDate] = useState(() => getDaysAgoIso(30));
  const [endDate, setEndDate] = useState(today);
  const [selectedModules, setSelectedModules] = useState<ReportModule[]>([
    'loans_academic',
    'loans_rental',
    'equipment_inventory',
    'equipment_status',
    'users',
  ]);
  const [customTitle, setCustomTitle] = useState('');
  const [isCustomTitle, setIsCustomTitle] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    // Preload PDF engine quietly in background for instant download
    loadHtml2Pdf().catch(() => { });
  }, []);

  useEffect(() => {
    if (user?.displayName) setAuthorName(user.displayName);
    if (user?.role) setAuthorRole(defaultRoleLabel(user.role));
  }, [user]);

  // Load real data
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const unsubLoans = watchLabLoans(
      user.labId,
      (nextLoans) => {
        setLoans(nextLoans);
        setLoading(false);
      },
      (err) => {
        setDataError(err.message);
        setLoading(false);
      }
    );

    const unsubEquip = watchEquipment(
      (nextEquip) => setEquipment(nextEquip),
      (err) => setDataError(err.message),
      { labId: user.labId }
    );

    const unsubUsers = watchLabUsers(
      (nextUsers) => setUsers(nextUsers),
      (err) => setDataError(err.message),
      user.labId
    );

    return () => {
      unsubLoans();
      unsubEquip();
      unsubUsers();
    };
  }, [user]);

  // Dynamic report title
  const computedTitle = useMemo(() => {
    return computeDynamicTitle(selectedModules);
  }, [selectedModules]);

  const activeTitle = isCustomTitle && customTitle.trim() ? customTitle.trim() : computedTitle;

  // Validation
  const validateForm = (): boolean => {
    setValidationError(null);

    if (!authorName.trim()) {
      setValidationError('Por favor ingresa el nombre de quien genera el reporte.');
      return false;
    }

    if (!startDate.trim() || !endDate.trim()) {
      setValidationError('Debes especificar la fecha de inicio y fecha de fin.');
      return false;
    }

    // Regla estricta solicitada: Fecha de fin no puede superar el día de creación (hoy)
    if (endDate > today) {
      setValidationError(
        `La fecha de fin (${endDate}) no puede ser posterior al día de hoy (${today}), que es la fecha de creación del reporte.`
      );
      return false;
    }

    if (startDate > endDate) {
      setValidationError('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return false;
    }

    if (selectedModules.length === 0) {
      setValidationError('Debes seleccionar al menos un módulo o sección para incluir en el reporte.');
      return false;
    }

    return true;
  };

  // Module toggle handlers
  const toggleModule = (modId: ReportModule) => {
    setSelectedModules((prev) => {
      const exists = prev.includes(modId);
      if (exists) {
        return prev.filter((id) => id !== modId);
      }
      return [...prev, modId];
    });
  };

  const selectAllModules = () => {
    setSelectedModules(REPORT_MODULE_DEFS.map((m) => m.id));
  };

  const clearModules = () => {
    setSelectedModules([]);
  };

  // Quick date ranges
  const applyRange = (days: number) => {
    setEndDate(today);
    setStartDate(getDaysAgoIso(days));
    setValidationError(null);
  };

  // Filtered stats in period
  const stats = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T23:59:59`).getTime();

    const periodLoans = loans.filter((l) => {
      if (!l.requestedAt) return true;
      const t = new Date(l.requestedAt).getTime();
      return t >= start && t <= end;
    });

    const academic = periodLoans.filter((l) => l.loanType !== 'rental').length;
    const rental = periodLoans.filter((l) => l.loanType === 'rental').length;
    const flaggedEquip = equipment.filter(
      (e) =>
        e.status === 'maintenance' ||
        e.status === 'damaged' ||
        e.status === 'out_of_service' ||
        (e.notes && e.notes.trim().length > 0)
    ).length;

    return {
      totalLoansPeriod: periodLoans.length,
      academic,
      rental,
      equipmentTotal: equipment.length,
      flaggedEquip,
      usersTotal: users.length,
    };
  }, [loans, equipment, users, startDate, endDate]);

  const reportConfig: ReportConfig = useMemo(() => {
    return {
      authorName: authorName.trim(),
      authorRole: authorRole.trim() || 'Responsable',
      department: 'Departamento de Topografía',
      institution: 'Universidad Autónoma de Guerrero',
      startDate,
      endDate,
      reportTitle: activeTitle,
      folio: generateReportFolio(),
      modules: selectedModules,
    };
  }, [authorName, authorRole, startDate, endDate, activeTitle, selectedModules]);

  const generatedHtml = useMemo(() => {
    return generateReportHtml(reportConfig, { loans, equipment, users });
  }, [reportConfig, loans, equipment, users]);

  const handleDownloadPdf = async () => {
    if (!validateForm()) return;
    setDownloadingPdf(true);
    setActionSuccess(null);
    setValidationError(null);
    try {
      const safeTitle = activeTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      await downloadReportPdf(generatedHtml, `${safeTitle}-${today}.pdf`);
      setActionSuccess('Reporte en PDF descargado directamente con éxito.');
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err) {
      console.error('Error al generar PDF:', err);
      setValidationError(
        err instanceof Error
          ? err.message
          : 'No se pudo generar el PDF directamente. Puedes usar "Previsualizar reporte" o descargar el archivo HTML.'
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadHtml = () => {
    if (!validateForm()) return;
    const safeTitle = activeTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    downloadReportHtml(generatedHtml, `${safeTitle}-${today}.html`);
    setActionSuccess('Archivo HTML oficial descargado con éxito.');
    setTimeout(() => setActionSuccess(null), 5000);
  };

  const handleOpenPreview = () => {
    if (!validateForm()) return;
    setPreviewOpen(true);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <MaterialIcons name="assessment" size={28} color={theme.color.navy} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Generar reporte institucional</Text>
          <Text style={styles.subtitle}>
            Genera informes oficiales con portada institucional UAGro, historial de operaciones, inventario y directorio.
          </Text>
        </View>
      </View>

      {dataError ? <Notice tone="danger" title="Error de conexión" description={dataError} /> : null}
      {validationError ? (
        <Notice tone="danger" title="Verificación requerida" description={validationError} />
      ) : null}
      {actionSuccess ? (
        <Notice tone="info" title="Operación completada" description={actionSuccess} />
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.color.navy} size="large" />
          <Text style={styles.loadingText}>Cargando datos del laboratorio...</Text>
        </View>
      ) : (
        <View style={styles.layout}>
          {/* Columna Izquierda: Formulario de Configuración */}
          <View style={styles.formCol}>
            {/* Bloque 1: Datos del emisor */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <MaterialIcons name="badge" size={20} color={theme.color.navy} />
                <Text style={styles.cardTitle}>Datos del responsable emisor</Text>
              </View>
              <Text style={styles.cardDesc}>
                Estos datos aparecerán en la portada oficial y en el bloque de firmas del informe.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Nombre completo del emisor</Text>
                <TextInput
                  value={authorName}
                  onChangeText={setAuthorName}
                  placeholder="Nombre y apellidos del responsable"
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Cargo institucional</Text>
                <TextInput
                  value={authorRole}
                  onChangeText={setAuthorRole}
                  placeholder="Ej. Encargado de Laboratorio, Administrador General..."
                  style={styles.input}
                />
              </View>

              <View style={styles.metaNotice}>
                <MaterialIcons name="account-balance" size={18} color={theme.color.navy} />
                <Text style={styles.metaNoticeText}>
                  Universidad Autónoma de Guerrero · Facultad de Ingeniería · Depto. de Topografía
                </Text>
              </View>
            </View>

            {/* Bloque 2: Rango de Fechas */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <MaterialIcons name="date-range" size={20} color={theme.color.navy} />
                <Text style={styles.cardTitle}>Período de evaluación</Text>
              </View>
              <Text style={styles.cardDesc}>
                Filtra los préstamos y rentas ocurridos en este intervalo. La fecha de fin no puede superar el día de hoy ({today}).
              </Text>

              <View style={styles.dateRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Fecha de inicio (AAAA-MM-DD)</Text>
                  <TextInput
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="AAAA-MM-DD"
                    style={styles.input}
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Fecha de fin (Máx. hoy: {today})</Text>
                  <TextInput
                    value={endDate}
                    onChangeText={(val) => {
                      setEndDate(val);
                      if (val > today) {
                        setValidationError(
                          `La fecha de fin no puede ser mayor al día de hoy (${today}).`
                        );
                      } else {
                        setValidationError(null);
                      }
                    }}
                    placeholder={today}
                    style={[styles.input, endDate > today && styles.inputError]}
                  />
                </View>
              </View>

              {/* Atajos de rango rápido */}
              <View style={styles.chipsRow}>
                <Pressable style={styles.chipBtn} onPress={() => applyRange(7)}>
                  <Text style={styles.chipBtnText}>Últimos 7 días</Text>
                </Pressable>
                <Pressable style={styles.chipBtn} onPress={() => applyRange(30)}>
                  <Text style={styles.chipBtnText}>Últimos 30 días</Text>
                </Pressable>
                <Pressable style={styles.chipBtn} onPress={() => applyRange(90)}>
                  <Text style={styles.chipBtnText}>Último trimestre</Text>
                </Pressable>
                <Pressable style={styles.chipBtn} onPress={() => applyRange(365)}>
                  <Text style={styles.chipBtnText}>Último año</Text>
                </Pressable>
              </View>
            </View>

            {/* Bloque 4: Título del Reporte */}
            <View style={styles.card}>
              <View style={styles.cardHeadBetween}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name="title" size={20} color={theme.color.navy} />
                  <Text style={styles.cardTitle}>Título del reporte</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setIsCustomTitle((v) => !v);
                    if (!isCustomTitle) setCustomTitle(computedTitle);
                  }}
                  style={styles.smallActionBtn}
                >
                  <Text style={styles.smallActionText}>
                    {isCustomTitle ? 'Usar automático' : 'Personalizar título'}
                  </Text>
                </Pressable>
              </View>

              {isCustomTitle ? (
                <TextInput
                  value={customTitle}
                  onChangeText={setCustomTitle}
                  placeholder="Escribe el título personalizado del reporte..."
                  style={[styles.input, { marginTop: 8 }]}
                />
              ) : (
                <View style={styles.autoTitleBox}>
                  <Text style={styles.autoTitleLabel}>Título automático institucional:</Text>
                  <Text style={styles.autoTitleText}>{computedTitle}</Text>
                </View>
              )}
            </View>

            {/* Bloque 3: Módulos a incluir */}
            <View style={styles.card}>
              <View style={styles.cardHeadBetween}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name="checklist" size={20} color={theme.color.navy} />
                  <Text style={styles.cardTitle}>Módulos a incluir en el reporte</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={selectAllModules} style={styles.smallActionBtn}>
                    <Text style={styles.smallActionText}>Seleccionar todo</Text>
                  </Pressable>
                  <Pressable onPress={clearModules} style={styles.smallActionBtn}>
                    <Text style={styles.smallActionText}>Limpiar</Text>
                  </Pressable>
                </View>
              </View>
              <Text style={styles.cardDesc}>
                Elige si deseas un reporte integral con todos los apartados o enfocado en módulos específicos:
              </Text>

              <View style={styles.modulesList}>
                {REPORT_MODULE_DEFS.map((mod) => {
                  const active = selectedModules.includes(mod.id);
                  return (
                    <Pressable
                      key={mod.id}
                      onPress={() => toggleModule(mod.id)}
                      style={[styles.moduleCard, active && styles.moduleCardActive]}
                    >
                      <MaterialIcons
                        name={active ? 'check-box' : 'check-box-outline-blank'}
                        size={22}
                        color={active ? theme.color.navy : theme.color.muted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.moduleLabel, active && styles.moduleLabelActive]}>
                          {mod.label}
                        </Text>
                        <Text style={styles.moduleDesc}>{mod.description}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>


          </View>

          {/* Columna Derecha: Resumen de Contenido y Acciones de Descarga */}
          <View style={styles.previewCol}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardTitle}>Resumen del documento</Text>
              <Text style={styles.summaryCardDesc}>
                Datos que se consolidarán en el informe con corte al {today}:
              </Text>

              <View style={styles.kpiGrid}>
                <View style={styles.kpiItem}>
                  <Text style={styles.kpiValue}>{stats.totalLoansPeriod}</Text>
                  <Text style={styles.kpiLabel}>Préstamos en período</Text>
                  <Text style={styles.kpiSub}>
                    {stats.academic} acad. · {stats.rental} rentas
                  </Text>
                </View>

                <View style={styles.kpiItem}>
                  <Text style={styles.kpiValue}>{stats.equipmentTotal}</Text>
                  <Text style={styles.kpiLabel}>Líneas de inventario</Text>
                  <Text style={styles.kpiSub}>Catálogo completo</Text>
                </View>

                <View style={styles.kpiItem}>
                  <Text style={[styles.kpiValue, stats.flaggedEquip > 0 && { color: theme.color.warning }]}>
                    {stats.flaggedEquip}
                  </Text>
                  <Text style={styles.kpiLabel}>Con detalle / mant.</Text>
                  <Text style={styles.kpiSub}>Observaciones</Text>
                </View>

                <View style={styles.kpiItem}>
                  <Text style={styles.kpiValue}>{stats.usersTotal}</Text>
                  <Text style={styles.kpiLabel}>Usuarios registrados</Text>
                  <Text style={styles.kpiSub}>Comunidad lab</Text>
                </View>
              </View>

              <View style={styles.actionsBox}>
                <Button
                  title={downloadingPdf ? 'Generando PDF...' : 'Descargar PDF'}
                  onPress={handleDownloadPdf}
                  loading={downloadingPdf}
                  style={styles.mainActionBtn}
                />
                <Button
                  title="Previsualizar reporte"
                  variant="secondary"
                  disabled={downloadingPdf}
                  onPress={handleOpenPreview}
                  style={styles.secondaryActionBtn}
                />
                <Button
                  title="Descargar archivo HTML autónomo"
                  variant="secondary"
                  disabled={downloadingPdf}
                  onPress={handleDownloadHtml}
                  style={styles.secondaryActionBtn}
                />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Modal de Previsualización */}
      <Modal
        visible={previewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MaterialIcons name="preview" size={24} color={theme.color.navy} />
                <View>
                  <Text style={styles.modalTitle}>Previsualización del reporte</Text>
                  <Text style={styles.modalSubtitle}>{activeTitle}</Text>
                </View>
              </View>
              <Pressable onPress={() => setPreviewOpen(false)} style={styles.closeBtn}>
                <MaterialIcons name="close" size={22} color={theme.color.muted} />
              </Pressable>
            </View>

            <View style={styles.previewContainer}>
              {React.createElement('iframe', {
                title: 'Report Preview',
                srcDoc: generatedHtml,
                style: {
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: '#fff',
                },
              })}
            </View>

            <View style={styles.modalFooter}>
              <Button
                title="Cerrar vista previa"
                variant="secondary"
                fullWidth={false}
                disabled={downloadingPdf}
                onPress={() => setPreviewOpen(false)}
              />
              <Button
                title={downloadingPdf ? 'Generando PDF...' : 'Descargar PDF ahora'}
                fullWidth={false}
                loading={downloadingPdf}
                onPress={async () => {
                  await handleDownloadPdf();
                  setPreviewOpen(false);
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
  root: { flex: 1, backgroundColor: theme.color.canvas },
  content: { padding: 32, paddingBottom: 64 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  headerIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: theme.color.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: { marginTop: 4, color: theme.color.muted, fontSize: theme.font.size.md },
  loadingBox: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: { color: theme.color.muted, fontSize: theme.font.size.md, fontWeight: '600' },
  layout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    alignItems: 'flex-start',
  },
  formCol: {
    flex: 1,
    minWidth: 380,
    gap: 16,
  },
  previewCol: {
    width: 360,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 20,
    ...theme.shadow.soft,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardHeadBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
  },
  cardDesc: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
    marginBottom: 14,
    lineHeight: 18,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    color: theme.color.navy,
    fontSize: theme.font.size.sm,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: theme.color.ink,
    backgroundColor: '#fff',
    fontSize: theme.font.size.md,
  },
  inputError: {
    borderColor: theme.color.red,
    backgroundColor: '#FFF5F5',
  },
  metaNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.color.infoSoft,
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  metaNoticeText: {
    flex: 1,
    color: theme.color.navy,
    fontSize: theme.font.size.xs,
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EDF2F7',
  },
  chipBtnText: {
    color: theme.color.navy,
    fontSize: theme.font.size.xs,
    fontWeight: '700',
  },
  smallActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: theme.color.infoSoft,
  },
  smallActionText: {
    color: theme.color.navy,
    fontSize: theme.font.size.xs,
    fontWeight: '700',
  },
  modulesList: {
    gap: 8,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  moduleCardActive: {
    borderColor: theme.color.navy,
    backgroundColor: '#F8FAFC',
  },
  moduleLabel: {
    color: theme.color.ink,
    fontSize: theme.font.size.md,
    fontWeight: '700',
  },
  moduleLabelActive: {
    color: theme.color.navy,
  },
  moduleDesc: {
    color: theme.color.muted,
    fontSize: theme.font.size.xs,
    marginTop: 2,
  },
  autoTitleBox: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  autoTitleLabel: {
    color: theme.color.muted,
    fontSize: theme.font.size.xs,
    fontWeight: '700',
    marginBottom: 4,
  },
  autoTitleText: {
    color: theme.color.navy,
    fontSize: theme.font.size.md,
    fontWeight: '800',
  },
  summaryCard: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 22,
    ...theme.shadow.soft,
  },
  summaryCardTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryCardDesc: {
    color: theme.color.muted,
    fontSize: theme.font.size.sm,
    marginBottom: 16,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  kpiItem: {
    flexGrow: 1,
    flexBasis: 140,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.line,
  },
  kpiValue: {
    color: theme.color.navy,
    fontSize: theme.font.size.xl,
    fontWeight: '800',
  },
  kpiLabel: {
    color: theme.color.ink,
    fontSize: theme.font.size.xs,
    fontWeight: '700',
    marginTop: 2,
  },
  kpiSub: {
    color: theme.color.muted,
    fontSize: 10,
    marginTop: 2,
  },
  coverBadgeBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    backgroundColor: theme.color.infoSoft,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D9EC',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  coverBadgeTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.sm,
    fontWeight: '800',
  },
  coverBadgeDesc: {
    color: theme.color.navy,
    fontSize: theme.font.size.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  actionsBox: {
    gap: 10,
  },
  mainActionBtn: {
    height: 46,
  },
  secondaryActionBtn: {
    height: 42,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '90%',
    maxWidth: 960,
    height: '90%',
    backgroundColor: theme.color.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.color.line,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.line,
  },
  modalTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: theme.color.muted,
    fontSize: theme.font.size.xs,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#E2E8F0',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.color.line,
    backgroundColor: '#fff',
  },
});
