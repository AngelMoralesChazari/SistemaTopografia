import type { AppUser, Equipment, Loan } from '@lab-topo/domain';
import { REPORT_COVER_BASE64 } from '../assets/reportCoverBase64';

export type ReportModule =
  | 'loans_academic'
  | 'loans_rental'
  | 'equipment_inventory'
  | 'equipment_status'
  | 'users';

export const REPORT_MODULE_DEFS: {
  id: ReportModule;
  label: string;
  description: string;
}[] = [
  {
    id: 'loans_academic',
    label: 'Préstamos universitarios',
    description: 'Historial de solicitudes de alumnos y profesores de la universidad',
  },
  {
    id: 'loans_rental',
    label: 'Rentas a particulares',
    description: 'Historial de rentas a particulares y empresas externas',
  },
  {
    id: 'equipment_inventory',
    label: 'Inventario de material (cantidades)',
    description: 'Catálogo completo, existencias totales, disponibles y en préstamo',
  },
  {
    id: 'equipment_status',
    label: 'Estatus y fallas de material',
    description: 'Equipos con fallas, en mantenimiento, dañados o con observaciones',
  },
  {
    id: 'users',
    label: 'Directorio de usuarios (todos)',
    description: 'Censo completo de alumnos, docentes, particulares y administradores',
  },
];

export type ReportConfig = {
  authorName: string;
  authorRole: string;
  department: string;
  institution: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reportTitle: string;
  folio: string;
  modules: ReportModule[];
};

export type ReportData = {
  loans: Loan[];
  equipment: Equipment[];
  users: AppUser[];
};

export function computeDynamicTitle(modules: ReportModule[]): string {
  if (modules.length === 0) return 'Reporte General del Laboratorio';
  if (modules.length === REPORT_MODULE_DEFS.length) {
    return 'Reporte Integral de Operación, Inventario y Usuarios';
  }

  const parts: string[] = [];
  if (modules.includes('loans_academic') && modules.includes('loans_rental')) {
    parts.push('Préstamos y Rentas');
  } else if (modules.includes('loans_academic')) {
    parts.push('Préstamos Universitarios');
  } else if (modules.includes('loans_rental')) {
    parts.push('Rentas a Particulares');
  }

  if (modules.includes('equipment_inventory') && modules.includes('equipment_status')) {
    parts.push('Inventario y Estatus de Material');
  } else if (modules.includes('equipment_inventory')) {
    parts.push('Inventario de Material');
  } else if (modules.includes('equipment_status')) {
    parts.push('Estatus y Fallas de Material');
  }

  if (modules.includes('users')) {
    parts.push('Directorio de Usuarios');
  }

  return `Reporte de ${parts.join(', ')}`;
}

export function generateReportFolio(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const tail = String(now.getTime()).slice(-4);
  return `UAGRO-TOPO-${y}${m}-${tail}`;
}

export function formatMexicoDate(dateOrIso: string | Date | null | undefined): string {
  if (!dateOrIso) return '—';
  let d: Date;
  if (dateOrIso instanceof Date) {
    d = dateOrIso;
  } else if (typeof dateOrIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOrIso)) {
    const [y, m, day] = dateOrIso.split('-').map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(dateOrIso);
  }
  if (Number.isNaN(d.getTime())) return String(dateOrIso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateDisplay(isoOrDateStr: string | null | undefined): string {
  return formatMexicoDate(isoOrDateStr);
}

function formatDateFormal(d = new Date()): string {
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function filterLoansByDate(loans: Loan[], startIso: string, endIso: string): Loan[] {
  const start = new Date(`${startIso}T00:00:00`).getTime();
  const end = new Date(`${endIso}T23:59:59`).getTime();
  return loans.filter((l) => {
    if (!l.requestedAt) return true;
    const t = new Date(l.requestedAt).getTime();
    return t >= start && t <= end;
  });
}

function escapeHtml(str: unknown): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function statusBadge(status: string): string {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pending: { label: 'Pendiente', bg: '#FEF3C7', color: '#92400E' },
    approved: { label: 'Aprobada', bg: '#E0E7FF', color: '#3730A3' },
    delivered: { label: 'Entregado', bg: '#D1FAE5', color: '#065F46' },
    returned: { label: 'Devuelto', bg: '#E0F2FE', color: '#0369A1' },
    returned_late: { label: 'Retraso', bg: '#FEE2E2', color: '#991B1B' },
    damaged: { label: 'Dañado', bg: '#FEE2E2', color: '#991B1B' },
    lost: { label: 'Extraviado', bg: '#FEE2E2', color: '#991B1B' },
    rejected: { label: 'Rechazada', bg: '#F3F4F6', color: '#4B5563' },
    available: { label: 'Disponible', bg: '#D1FAE5', color: '#065F46' },
    loaned: { label: 'En préstamo', bg: '#E0E7FF', color: '#3730A3' },
    maintenance: { label: 'Mantenimiento', bg: '#FEF3C7', color: '#92400E' },
    out_of_service: { label: 'Fuera de serv.', bg: '#FEE2E2', color: '#991B1B' },
    reserved: { label: 'Reservado', bg: '#EDE9FE', color: '#5B21B6' },
    student: { label: 'Alumno', bg: '#E0F2FE', color: '#0369A1' },
    teacher: { label: 'Docente', bg: '#E0E7FF', color: '#3730A3' },
    renter: { label: 'Particular', bg: '#FEF3C7', color: '#92400E' },
    lab_manager: { label: 'Encargado', bg: '#D1FAE5', color: '#065F46' },
    admin: { label: 'Administrador', bg: '#FCE7F3', color: '#9D174D' },
    super_admin: { label: 'Administrador', bg: '#FCE7F3', color: '#9D174D' },
  };

  const item = map[status] || {
    label: status,
    bg: '#F3F4F6',
    color: '#374151',
  };
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;background:${item.bg};color:${item.color};text-transform:capitalize;">${escapeHtml(item.label)}</span>`;
}

export function generateReportHtml(config: ReportConfig, data: ReportData): string {
  const filteredLoans = filterLoansByDate(data.loans, config.startDate, config.endDate);
  const academicLoans = filteredLoans.filter((l) => l.loanType !== 'rental');
  const rentalLoans = filteredLoans.filter((l) => l.loanType === 'rental');

  const totalEquipmentItems = data.equipment.length;
  const totalEquipmentUnits = data.equipment.reduce((acc, eq) => acc + (eq.qtyTotal || 0), 0);
  const availableEquipmentUnits = data.equipment.reduce(
    (acc, eq) => acc + (eq.qtyAvailable || 0),
    0
  );
  const loanedEquipmentUnits = data.equipment.reduce((acc, eq) => acc + (eq.qtyLoaned || 0), 0);
  const flaggedEquipment = data.equipment.filter(
    (eq) =>
      eq.status === 'maintenance' ||
      eq.status === 'damaged' ||
      eq.status === 'out_of_service' ||
      (eq.notes && eq.notes.trim().length > 0)
  );

  const totalUsers = data.users.length;
  const studentsCount = data.users.filter((u) => u.role === 'student').length;
  const teachersCount = data.users.filter((u) => u.role === 'teacher').length;
  const rentersCount = data.users.filter((u) => u.role === 'renter').length;
  const staffCount = data.users.filter((u) => u.role === 'admin' || u.role === 'super_admin' || u.role === 'lab_manager').length;

  const todayFormal = formatDateFormal(new Date());

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(config.reportTitle)} - ${escapeHtml(config.folio)}</title>
  <style>
    @page {
      size: letter portrait;
      margin: 14mm 12mm 14mm 12mm;
    }
    @page:first {
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #0F172A;
      background: #FFFFFF;
      font-size: 12px;
      line-height: 1.45;
    }
    .cover-page {
      position: relative;
      width: 100%;
      height: 100vh;
      min-height: 1050px;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
      padding: 85mm 18mm 25mm 18mm;
    }
    .cover-bg-img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: fill;
      z-index: 0;
      pointer-events: none;
    }
    .cover-content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
      min-height: 720px;
    }
    .cover-top-badge {
      display: inline-block;
      background: #002B49;
      color: #FFFFFF;
      padding: 6px 14px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .cover-inst-title {
      font-size: 26px;
      font-weight: 900;
      color: #002B49;
      margin: 0 0 4px 0;
      letter-spacing: -0.5px;
      line-height: 1.15;
    }
    .cover-dept-title {
      font-size: 18px;
      font-weight: 800;
      color: #B3192B;
      margin: 0 0 16px 0;
      letter-spacing: -0.2px;
    }
    .cover-divider {
      width: 120px;
      height: 4px;
      background: #B3192B;
      border-radius: 2px;
      margin-bottom: 24px;
    }
    .cover-report-title-wrap {
      background: rgba(255, 255, 255, 0.94);
      border-left: 6px solid #002B49;
      border-radius: 0 12px 12px 0;
      padding: 22px 24px;
      box-shadow: 0 4px 20px rgba(0, 43, 73, 0.08);
      margin-bottom: 30px;
    }
    .cover-report-label {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #64748B;
      margin-bottom: 6px;
    }
    .cover-report-title {
      font-size: 28px;
      font-weight: 900;
      color: #002B49;
      margin: 0;
      line-height: 1.2;
      letter-spacing: -0.5px;
    }
    .cover-meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 24px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.03);
    }
    .cover-meta-item {
      display: flex;
      flex-direction: column;
    }
    .cover-meta-label {
      font-size: 10px;
      font-weight: 800;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 3px;
    }
    .cover-meta-value {
      font-size: 13px;
      font-weight: 700;
      color: #0F172A;
    }
    .cover-kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 15px;
    }
    .kpi-card {
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid #CBD5E1;
      border-radius: 8px;
      padding: 10px 12px;
      text-align: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.02);
    }
    .kpi-val {
      font-size: 20px;
      font-weight: 900;
      color: #002B49;
      line-height: 1.1;
    }
    .kpi-lbl {
      font-size: 10px;
      color: #64748B;
      font-weight: 700;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .cover-footer {
      font-size: 11px;
      color: #475569;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid rgba(100, 116, 139, 0.25);
      padding-top: 10px;
    }

    /* Inner Pages Layout */
    .report-page {
      padding: 12mm 16mm 14mm 16mm;
      box-sizing: border-box;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #002B49;
      padding-bottom: 8px;
      margin-bottom: 18px;
    }
    .header-logo-text {
      font-size: 13px;
      font-weight: 800;
      color: #002B49;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header-doc-info {
      font-size: 10px;
      color: #64748B;
      font-weight: 700;
      text-align: right;
    }
    .section-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 22px 0 12px 0;
      page-break-after: avoid;
      break-after: avoid;
    }
    .section-num {
      background: #002B49;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 900;
      width: 22px;
      height: 22px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .section-title {
      font-size: 15px;
      font-weight: 800;
      color: #002B49;
      margin: 0;
    }
    .section-desc {
      font-size: 11px;
      color: #64748B;
      margin-bottom: 12px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      font-size: 11px;
    }
    th {
      background: #002B49;
      color: #FFFFFF;
      font-weight: 700;
      text-align: left;
      padding: 7px 9px;
      font-size: 10.5px;
      letter-spacing: 0.3px;
      border: 1px solid #002B49;
    }
    td {
      padding: 6px 9px;
      border: 1px solid #E2E8F0;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background: #F8FAFC;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .td-bold {
      font-weight: 700;
      color: #0F172A;
    }
    .td-num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .notes-tag {
      display: block;
      margin-top: 3px;
      padding: 3px 6px;
      background: #FFFBEB;
      border-left: 3px solid #F59E0B;
      font-size: 10px;
      color: #92400E;
      border-radius: 2px;
    }

    /* Signatures Block */
    .signatures-wrap {
      margin-top: 35px;
      page-break-inside: avoid;
      break-inside: avoid;
      border-top: 1px dashed #CBD5E1;
      padding-top: 20px;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 45px;
    }
    .sig-box {
      border-top: 1.5px solid #002B49;
      padding-top: 8px;
      text-align: center;
    }
    .sig-name {
      font-size: 12px;
      font-weight: 800;
      color: #002B49;
    }
    .sig-role {
      font-size: 10px;
      color: #64748B;
      margin-top: 2px;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
    }
  </style>
</head>
<body>

  <!-- PORTADA OFICIAL UAGRO -->
  <div class="cover-page">
    <img src="${REPORT_COVER_BASE64}" class="cover-bg-img" alt="Membrete UAGro" />
    <div class="cover-content">
      <div>
        <span class="cover-top-badge">UAGro · Documento Oficial</span>
        <h1 class="cover-inst-title">UNIVERSIDAD AUTÓNOMA DE GUERRERO</h1>
        <h2 class="cover-dept-title">DEPARTAMENTO DE TOPOGRAFÍA · FACULTAD DE INGENIERÍA</h2>
        <div class="cover-divider"></div>

      <div class="cover-report-title-wrap">
        <div class="cover-report-label">Informe Oficial del Laboratorio</div>
        <h3 class="cover-report-title">${escapeHtml(config.reportTitle)}</h3>
      </div>

      <div class="cover-meta-grid">
        <div class="cover-meta-item">
          <span class="cover-meta-label">Fecha de creación / emisión</span>
          <span class="cover-meta-value">${escapeHtml(todayFormal)}</span>
        </div>
        <div class="cover-meta-item">
          <span class="cover-meta-label">Folio institucional</span>
          <span class="cover-meta-value">${escapeHtml(config.folio)}</span>
        </div>
        <div class="cover-meta-item">
          <span class="cover-meta-label">Generado por</span>
          <span class="cover-meta-value">${escapeHtml(config.authorName)}</span>
        </div>
        <div class="cover-meta-item">
          <span class="cover-meta-label">Cargo / Función</span>
          <span class="cover-meta-value">${escapeHtml(config.authorRole)}</span>
        </div>
        <div class="cover-meta-item" style="grid-column: span 2;">
          <span class="cover-meta-label">Período evaluado en este reporte</span>
          <span class="cover-meta-value">Del ${formatDateDisplay(config.startDate)} al ${formatDateDisplay(config.endDate)}</span>
        </div>
      </div>

      <div class="cover-kpis">
        <div class="kpi-card">
          <div class="kpi-val">${filteredLoans.length}</div>
          <div class="kpi-lbl">Solicitudes período</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val">${totalEquipmentUnits}</div>
          <div class="kpi-lbl">Piezas en inventario</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val">${loanedEquipmentUnits}</div>
          <div class="kpi-lbl">Piezas en préstamo</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val">${totalUsers}</div>
          <div class="kpi-lbl">Usuarios registrados</div>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <span>Sistema de Control y Gestión del Laboratorio de Topografía · UAGro</span>
      <span>${escapeHtml(config.folio)}</span>
    </div>
    </div>
  </div>

  <!-- CONTENIDO DETALLADO -->
  <div class="report-page">

    <div class="header-bar">
      <div>
        <div class="header-logo-text">UAGro · Departamento de Topografía</div>
        <div style="font-size: 11px; color:#B3192B; font-weight:700;">${escapeHtml(config.reportTitle)}</div>
      </div>
      <div class="header-doc-info">
        <div>Folio: ${escapeHtml(config.folio)}</div>
        <div>Emisión: ${escapeHtml(todayFormal)}</div>
      </div>
    </div>

    ${
      config.modules.includes('equipment_inventory')
        ? `
      <div class="section-title-wrap">
        <div class="section-num">1</div>
        <h3 class="section-title">Inventario General de Materiales y Equipos</h3>
      </div>
      <div class="section-desc">
        Catálogo institucional de instrumentación topográfica registrada. Existencias físicas totales, disponibles y en servicio.
      </div>

      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;margin-bottom:12px;">
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;padding:8px;border-radius:6px;text-align:center;">
          <div style="font-size:16px;font-weight:800;color:#002B49;">${totalEquipmentItems}</div>
          <div style="font-size:10px;color:#64748B;font-weight:700;">MODELOS / LÍNEAS</div>
        </div>
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;padding:8px;border-radius:6px;text-align:center;">
          <div style="font-size:16px;font-weight:800;color:#002B49;">${totalEquipmentUnits}</div>
          <div style="font-size:10px;color:#64748B;font-weight:700;">PIEZAS TOTALES</div>
        </div>
        <div style="background:#F0FDF4;border:1px solid #BBF7D0;padding:8px;border-radius:6px;text-align:center;">
          <div style="font-size:16px;font-weight:800;color:#166534;">${availableEquipmentUnits}</div>
          <div style="font-size:10px;color:#166534;font-weight:700;">DISPONIBLES</div>
        </div>
        <div style="background:#EFF6FF;border:1px solid #BFDBFE;padding:8px;border-radius:6px;text-align:center;">
          <div style="font-size:16px;font-weight:800;color:#1D4ED8;">${loanedEquipmentUnits}</div>
          <div style="font-size:10px;color:#1D4ED8;font-weight:700;">EN PRÉSTAMO</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:110px;">Código</th>
            <th>Equipo / Material</th>
            <th>Categoría</th>
            <th>Marca / Modelo</th>
            <th style="width:50px;text-align:center;">Total</th>
            <th style="width:50px;text-align:center;">Disp.</th>
            <th style="width:50px;text-align:center;">Prést.</th>
            <th style="width:80px;text-align:center;">Estatus</th>
          </tr>
        </thead>
        <tbody>
          ${data.equipment
            .map(
              (eq) => `
            <tr>
              <td class="td-bold">${escapeHtml(eq.internalCode)}</td>
              <td>
                <span class="td-bold">${escapeHtml(eq.name)}</span>
                ${eq.notes ? `<span class="notes-tag">${escapeHtml(eq.notes)}</span>` : ''}
              </td>
              <td>${escapeHtml(eq.categoryName)}</td>
              <td>${escapeHtml([eq.brand, eq.model].filter(Boolean).join(' · ') || '—')}</td>
              <td class="td-num td-bold">${eq.qtyTotal}</td>
              <td class="td-num" style="color:#166534;font-weight:700;">${eq.qtyAvailable}</td>
              <td class="td-num" style="color:#1D4ED8;font-weight:700;">${eq.qtyLoaned}</td>
              <td style="text-align:center;">${statusBadge(eq.status)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `
        : ''
    }

    ${
      config.modules.includes('equipment_status')
        ? `
      <div class="section-title-wrap">
        <div class="section-num">2</div>
        <h3 class="section-title">Estatus Físico, Mantenimiento y Reporte de Fallas</h3>
      </div>
      <div class="section-desc">
        Equipos en mantenimiento, con fallas reportadas, desgaste o que requieren supervisión técnica.
      </div>

      ${
        flaggedEquipment.length === 0
          ? `<p style="padding:12px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:6px;color:#166534;font-weight:600;">
              ✓ No se registran equipos en mantenimiento ni con fallas críticas activas en este período.
            </p>`
          : `
          <table>
            <thead>
              <tr>
                <th style="width:110px;">Código</th>
                <th>Equipo</th>
                <th>Categoría</th>
                <th style="width:90px;text-align:center;">Estatus</th>
                <th>Observaciones / Diagnóstico de condición</th>
              </tr>
            </thead>
            <tbody>
              ${flaggedEquipment
                .map(
                  (eq) => `
                <tr>
                  <td class="td-bold">${escapeHtml(eq.internalCode)}</td>
                  <td class="td-bold">${escapeHtml(eq.name)}</td>
                  <td>${escapeHtml(eq.categoryName)}</td>
                  <td style="text-align:center;">${statusBadge(eq.status)}</td>
                  <td>
                    ${
                      eq.notes
                        ? `<span style="font-weight:600;color:#92400E;">${escapeHtml(eq.notes)}</span>`
                        : '<span style="color:#64748B;">En revisión / seguimiento preventivo</span>'
                    }
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        `
      }
    `
        : ''
    }

    ${
      config.modules.includes('loans_academic')
        ? `
      <div class="section-title-wrap">
        <div class="section-num">3</div>
        <h3 class="section-title">Historial de Préstamos Universitarios (Académicos)</h3>
      </div>
      <div class="section-desc">
        Registro de solicitudes y préstamos de material a alumnos y profesores durante el período (${formatDateDisplay(
          config.startDate
        )} al ${formatDateDisplay(config.endDate)}).
      </div>

      ${
        academicLoans.length === 0
          ? `<p style="padding:12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;color:#64748B;">
              No se registraron préstamos universitarios en el rango de fechas seleccionado.
            </p>`
          : `
          <table>
            <thead>
              <tr>
                <th style="width:85px;">Folio</th>
                <th style="width:85px;">Fecha</th>
                <th>Alumno / Matrícula</th>
                <th>Profesor</th>
                <th>Equipo entregado</th>
                <th style="width:80px;text-align:center;">Estatus</th>
                <th>Condición / Obs. de entrega</th>
              </tr>
            </thead>
            <tbody>
              ${academicLoans
                .map(
                  (l) => `
                <tr>
                  <td class="td-bold">#${escapeHtml(l.folio)}</td>
                  <td>${formatDateDisplay(l.requestedAt)}</td>
                  <td>
                    <span class="td-bold">${escapeHtml(l.studentName)}</span>
                    ${l.studentNumber ? `<br><span style="font-size:10px;color:#64748B;">Mat. ${escapeHtml(l.studentNumber)}</span>` : ''}
                  </td>
                  <td>${escapeHtml(l.teacherName || '—')}</td>
                  <td>
                    <span class="td-bold">${escapeHtml(l.equipmentName)}</span>
                    <br><span style="font-size:10px;color:#64748B;">${escapeHtml(l.equipmentCode)}</span>
                  </td>
                  <td style="text-align:center;">${statusBadge(l.status)}</td>
                  <td>
                    ${
                      l.deliveryNotes
                        ? `<span class="notes-tag">Entrega: ${escapeHtml(l.deliveryNotes)}</span>`
                        : '<span style="color:#059669;font-weight:600;font-size:10px;">✓ Perfecto estado</span>'
                    }
                    ${l.damageNotes ? `<br><span style="color:#DC2626;font-size:10px;font-weight:700;">Daño: ${escapeHtml(l.damageNotes)}</span>` : ''}
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        `
      }
    `
        : ''
    }

    ${
      config.modules.includes('loans_rental')
        ? `
      <div class="section-title-wrap">
        <div class="section-num">4</div>
        <h3 class="section-title">Historial de Rentas de Equipo a Particulares</h3>
      </div>
      <div class="section-desc">
        Servicios de renta a terceros y particulares dentro del período evaluado (${formatDateDisplay(
          config.startDate
        )} al ${formatDateDisplay(config.endDate)}).
      </div>

      ${
        rentalLoans.length === 0
          ? `<p style="padding:12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;color:#64748B;">
              No se registraron rentas a particulares en el rango de fechas seleccionado.
            </p>`
          : `
          <table>
            <thead>
              <tr>
                <th style="width:85px;">Folio</th>
                <th style="width:85px;">Fecha</th>
                <th>Solicitante / Particular</th>
                <th>Equipo rentado</th>
                <th style="width:85px;">Devolución</th>
                <th style="width:80px;text-align:center;">Estatus</th>
                <th>Pago / Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${rentalLoans
                .map(
                  (l) => `
                <tr>
                  <td class="td-bold">#${escapeHtml(l.folio)}</td>
                  <td>${formatDateDisplay(l.requestedAt)}</td>
                  <td>
                    <span class="td-bold">${escapeHtml(l.studentName)}</span>
                  </td>
                  <td>
                    <span class="td-bold">${escapeHtml(l.equipmentName)}</span>
                    <br><span style="font-size:10px;color:#64748B;">${escapeHtml(l.equipmentCode)}</span>
                  </td>
                  <td>${formatDateDisplay(l.dueAt)}</td>
                  <td style="text-align:center;">${statusBadge(l.status)}</td>
                  <td>
                    ${
                      l.paymentConfirmed
                        ? '<span style="color:#059669;font-weight:700;">✓ Pago confirmado</span>'
                        : '<span style="color:#D97706;font-weight:600;">Pendiente de pago</span>'
                    }
                    ${l.deliveryNotes ? `<br><span class="notes-tag">Estado: ${escapeHtml(l.deliveryNotes)}</span>` : ''}
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        `
      }
    `
        : ''
    }

    ${
      config.modules.includes('users')
        ? `
      <div class="section-title-wrap">
        <div class="section-num">5</div>
        <h3 class="section-title">Directorio y Censo de Usuarios del Laboratorio</h3>
      </div>
      <div class="section-desc">
        Usuarios registrados en la plataforma: ${studentsCount} alumnos, ${teachersCount} docentes, ${rentersCount} particulares y ${staffCount} administradores/encargados.
      </div>

      <table>
        <thead>
          <tr>
            <th>Nombre Completo</th>
            <th>Correo Electrónico</th>
            <th style="width:100px;text-align:center;">Rol</th>
            <th>Matrícula / ID</th>
            <th style="width:80px;text-align:center;">Estatus</th>
          </tr>
        </thead>
        <tbody>
          ${data.users
            .map(
              (u) => `
            <tr>
              <td class="td-bold">${escapeHtml(u.displayName)}</td>
              <td>${escapeHtml(u.email)}</td>
              <td style="text-align:center;">${statusBadge(u.role)}</td>
              <td>${escapeHtml(u.studentId || u.employeeId || '—')}</td>
              <td style="text-align:center;">
                ${
                  u.active !== false
                    ? '<span style="color:#166534;font-weight:700;">Activo</span>'
                    : '<span style="color:#991B1B;font-weight:700;">Inactivo</span>'
                }
              </td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `
        : ''
    }

    <!-- BLOQUE DE FIRMAS Y VALIDEZ OFICIAL -->
    <div class="signatures-wrap">
      <div style="font-size:11px;color:#475569;text-align:justify;margin-bottom:10px;">
        Se expide el presente informe oficial para los fines administrativos, académicos y de auditoría correspondientes, haciendo constar la veracidad de los registros físicos y digitales del Sistema de Control de Laboratorio de Topografía de la Universidad Autónoma de Guerrero.
      </div>

      <div class="signatures-grid">
        <div class="sig-box">
          <div class="sig-name">${escapeHtml(config.authorName)}</div>
          <div class="sig-role">${escapeHtml(config.authorRole)}<br>Responsable de Emisión</div>
        </div>
        <div class="sig-box">
          <div class="sig-name">Jefatura de Departamento</div>
          <div class="sig-role">Depto. de Topografía · UAGro<br>Visto Bueno</div>
        </div>
        <div class="sig-box">
          <div class="sig-name">Laboratorio de Topografía</div>
          <div class="sig-role">Sello Oficial Institucional<br>Facultad de Ingeniería</div>
        </div>
      </div>
    </div>

  </div>

</body>
</html>`;
}

/**
 * Carga el bundle autónomo de html2pdf.js en el navegador sin intermediación
 * de bundlers (Metro/Webpack), evitando errores de resolución de html2canvas/jspdf.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadHtml2Pdf(): Promise<any> {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).html2pdf) return (window as any).html2pdf;

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-lib="html2pdf"]') as HTMLScriptElement | null;
    if (existing) {
      const start = Date.now();
      const interval = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).html2pdf) {
          clearInterval(interval);
          resolve((window as any).html2pdf);
        } else if (Date.now() - start > 15000) {
          clearInterval(interval);
          reject(new Error('Tiempo de espera agotado al inicializar el generador de PDF.'));
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.setAttribute('data-lib', 'html2pdf');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).html2pdf) {
        resolve((window as any).html2pdf);
      } else {
        reject(new Error('No se pudo inicializar la librería de generación de PDF.'));
      }
    };
    script.onerror = () => {
      reject(new Error('No se pudo cargar el motor para generar el PDF. Verifica tu conexión a internet.'));
    };
    document.head.appendChild(script);
  });
}

export async function downloadReportPdf(
  html: string,
  filename = 'reporte-laboratorio-topografia.pdf'
): Promise<void> {
  if (typeof window === 'undefined') return;

  const html2pdf = await loadHtml2Pdf();
  if (!html2pdf) {
    throw new Error('El motor de generación de PDF no está disponible en este entorno.');
  }

  const opt = {
    margin: 0,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollY: 0,
      scrollX: 0,
    },
    jsPDF: {
      unit: 'mm',
      format: 'letter',
      orientation: 'portrait',
    },
    pagebreak: {
      mode: ['css', 'legacy'],
      before: '.page-break',
    },
  };

  await html2pdf().set(opt).from(html).save();
}

export function printReport(html: string): void {
  if (typeof window === 'undefined') return;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    }
  }, 400);
}

export function downloadReportHtml(html: string, filename = 'reporte-laboratorio-topografia.html'): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
