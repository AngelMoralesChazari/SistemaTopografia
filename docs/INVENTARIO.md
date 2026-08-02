# Inventario / Catálogo

## Qué incluye

- Modelo `Equipment` en `@lab-topo/domain`
- `equipmentService` (listar, watch, crear, actualizar)
- `MaterialCard` en design system
- Móvil alumno: **Catálogo**
- Móvil encargado/admin: **Inventario** + alta
- Web: **Catálogo de equipos** + alta + KPIs
- Seed: `npm run seed:equipment`
- Reglas: encargado/admin pueden crear/editar equipos

## Pasos que debes ejecutar

1. **Publicar reglas** (Firestore Rules): copia `firestore.rules` → Publish  
2. **Índices**: al abrir el catálogo, si Firebase pide índice, usa el link del error o publica `firestore.indexes.json`  
3. Sembrar equipos:

```powershell
npm run seed:equipment
```

4. Recarga la app:
   - Alumno → tab Catálogo
   - Encargado → tab Inventario
   - Web → menú Catálogo de equipos

## Cuentas de prueba

- `alumno@labtopo.uagro.edu.mx` / `LabTopo2026!`
- `encargado@labtopo.uagro.edu.mx` / `LabTopo2026!`
