# Módulo de préstamos / solicitudes

## Flujo activo

1. **Alumno** solicita desde Catálogo (equipo + profesor)
2. **Encargado** ve la cola → Entregar o Rechazar
3. **Encargado** registra devolución cuando el material regresa
4. **Maestro** supervisa préstamos de sus alumnos
5. **Alumno** consulta estados en Mis solicitudes

## Qué debes hacer en Firebase

1. Publicar `firestore.rules` (create/update de `loans`)
2. Si la app pide índice, crea el que indica el link (o despliega `firestore.indexes.json`)

## Probar

| Cuenta | Acción |
|--------|--------|
| `alumno@labtopo.uagro.edu.mx` | Catálogo → Solicitar material |
| `encargado@labtopo.uagro.edu.mx` | Solicitudes → Entregar / Rechazar / Devolver |
| `maestro@labtopo.uagro.edu.mx` | Mis alumnos (préstamos vigentes) |

Contraseña: `LabTopo2026!` (ver `docs/CUENTAS_PRUEBA.md`)
