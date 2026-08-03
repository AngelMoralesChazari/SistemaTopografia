import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme, getLabId } from '@lab-topo/config';
import {
  EQUIPMENT_STATUS_LABELS,
  type Equipment,
  type EquipmentStatus,
} from '@lab-topo/domain';
import { createEquipment, watchEquipment } from '@lab-topo/services';
import { Badge, Button, Notice, TextField, type BadgeTone } from '@lab-topo/ui';
import { useAuth } from '../auth/AuthContext';

function statusTone(status: EquipmentStatus): BadgeTone {
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

export function EquipmentPage() {
  const { user } = useAuth();
  const canWrite = user?.role === 'admin' || user?.role === 'lab_manager';
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [categoryName, setCategoryName] = useState('Topografía');
  const [qtyTotal, setQtyTotal] = useState('1');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const unsub = watchEquipment(
      (next) => {
        setItems(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((e) =>
      `${e.name} ${e.internalCode} ${e.categoryName} ${e.status}`.toLowerCase().includes(q)
    );
  }, [items, search]);

  const kpis = useMemo(() => {
    const available = items.filter((e) => e.status === 'available').length;
    const loaned = items.filter((e) => e.status === 'loaned').length;
    const maintenance = items.filter((e) => e.status === 'maintenance').length;
    return { total: items.length, available, loaned, maintenance };
  }, [items]);

  const onCreate = async () => {
    if (!canWrite) return;
    setFormError(null);
    if (!code.trim() || !name.trim()) {
      setFormError('Código y nombre son obligatorios.');
      return;
    }
    const total = Math.max(1, Number(qtyTotal) || 1);
    setSaving(true);
    try {
      await createEquipment({
        internalCode: code,
        name,
        brand: brand || null,
        model: model || null,
        categoryId: `cat-${categoryName.toLowerCase().replace(/\s+/g, '-')}`,
        categoryName,
        status: 'available',
        trackMode: total > 1 ? 'bulk' : 'unit',
        qtyTotal: total,
        qtyAvailable: total,
        notes: notes || null,
        labId: user?.labId ?? getLabId(),
        active: true,
      });
      setShowForm(false);
      setCode('');
      setName('');
      setBrand('');
      setModel('');
      setCategoryName('Topografía');
      setQtyTotal('1');
      setNotes('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Catálogo de equipos</Text>
          <Text style={styles.subtitle}>Inventario activo del laboratorio de topografía.</Text>
        </View>
        {canWrite ? (
          <Pressable style={styles.primaryBtn} onPress={() => setShowForm((v) => !v)}>
            <Text style={styles.primaryBtnText}>{showForm ? 'Cerrar formulario' : '+ Nuevo equipo'}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.kpis}>
        {[
          { label: 'Total equipos', value: String(kpis.total) },
          { label: 'Disponibles', value: String(kpis.available) },
          { label: 'En préstamo', value: String(kpis.loaned) },
          { label: 'Mantenimiento', value: String(kpis.maintenance) },
        ].map((kpi) => (
          <View key={kpi.label} style={styles.kpi}>
            <Text style={styles.kpiLabel}>{kpi.label}</Text>
            <Text style={styles.kpiValue}>{kpi.value}</Text>
          </View>
        ))}
      </View>

      {showForm ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Alta de equipo</Text>
          {formError ? <Notice tone="danger" title={formError} /> : null}
          <View style={styles.formGrid}>
            <TextField label="Código interno" value={code} onChangeText={setCode} containerStyle={styles.formField} />
            <TextField label="Nombre" value={name} onChangeText={setName} containerStyle={styles.formField} />
            <TextField label="Marca" value={brand} onChangeText={setBrand} containerStyle={styles.formField} />
            <TextField label="Modelo" value={model} onChangeText={setModel} containerStyle={styles.formField} />
            <TextField
              label="Categoría"
              value={categoryName}
              onChangeText={setCategoryName}
              containerStyle={styles.formField}
            />
            <TextField
              label="Cantidad total"
              value={qtyTotal}
              onChangeText={setQtyTotal}
              keyboardType="number-pad"
              containerStyle={styles.formField}
            />
          </View>
          <TextField label="Observaciones" value={notes} onChangeText={setNotes} />
          <Button title="Guardar equipo" loading={saving} onPress={onCreate} />
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View>
            <Text style={styles.cardTitle}>Equipos registrados</Text>
            <Text style={styles.cardSub}>{filtered.length} resultados</Text>
          </View>
          <View style={styles.search}>
            <MaterialIcons name="search" size={18} color={theme.color.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar equipo..."
              placeholderTextColor={theme.color.muted}
              style={styles.searchInput}
            />
          </View>
        </View>

        {error ? <Notice tone="danger" title="Error al cargar" description={error} /> : null}
        {loading ? <ActivityIndicator color={theme.color.navy} /> : null}

        {!loading && filtered.length === 0 ? (
          <Notice
            title="Sin equipos"
            description="Ejecuta npm run seed:equipment o registra el primer equipo."
          />
        ) : null}

        {!loading
          ? filtered.map((item) => (
              <View key={item.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowCode}>{item.internalCode}</Text>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowMeta}>
                    {item.categoryName}
                    {item.brand ? ` · ${item.brand}` : ''}
                    {item.model ? ` ${item.model}` : ''}
                  </Text>
                </View>
                <Text style={styles.rowQty}>
                  {item.qtyAvailable}/{item.qtyTotal}
                </Text>
                <Badge label={EQUIPMENT_STATUS_LABELS[item.status]} tone={statusTone(item.status)} />
              </View>
            ))
          : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.canvas },
  content: { padding: 32, paddingBottom: 48 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 20,
  },
  title: {
    color: theme.color.navy,
    fontSize: theme.font.size.display,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 8,
    color: theme.color.muted,
    fontSize: theme.font.size.md,
  },
  primaryBtn: {
    backgroundColor: theme.color.navy,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: theme.font.size.md,
    fontWeight: '800',
  },
  kpis: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  kpi: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 100,
    padding: 16,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    ...theme.shadow.soft,
  },
  kpiLabel: { color: theme.color.muted, fontSize: theme.font.size.sm },
  kpiValue: {
    marginTop: 12,
    color: theme.color.navy,
    fontSize: theme.font.size.xxl,
    fontWeight: '800',
  },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.lg,
    padding: 20,
    marginBottom: 18,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  cardTitle: {
    color: theme.color.navy,
    fontSize: theme.font.size.lg,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSub: { color: theme.color.muted, fontSize: theme.font.size.sm },
  search: {
    minWidth: 240,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: 8,
    backgroundColor: '#FBFCFD',
  },
  searchIcon: { color: theme.color.muted, fontSize: theme.font.size.md },
  searchInput: { flex: 1, fontSize: theme.font.size.md, color: theme.color.ink },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  formField: {
    flexGrow: 1,
    flexBasis: 220,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowCode: { color: theme.color.muted, fontSize: theme.font.size.sm, fontWeight: '700' },
  rowName: { color: theme.color.ink, fontSize: theme.font.size.lg, fontWeight: '700', marginTop: 2 },
  rowMeta: { color: theme.color.muted, fontSize: theme.font.size.md, marginTop: 2 },
  rowQty: {
    color: theme.color.navy,
    fontSize: theme.font.size.md,
    fontWeight: '800',
    minWidth: 48,
    textAlign: 'right',
  },
});
