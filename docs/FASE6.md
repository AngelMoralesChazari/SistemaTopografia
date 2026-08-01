# Fase 6 — Scaffold completado

## Qué se creó

- Monorepo npm workspaces (`apps/*`, `packages/*`)
- Design tokens UAGro (`#19315F`) en `@lab-topo/config`
- Dominio: roles, permisos, estados de préstamo (`@lab-topo/domain`)
- Firebase Auth + helpers (`@lab-topo/services`)
- UI base: Button, TextField, Badge, Avatar, Notice, Toast (`@lab-topo/ui`)
- App móvil: Login + tabs por rol (placeholders) — **Expo SDK 54** (compatible con Expo Go de tienda)
- App web: Login + AppShell sidebar (estilo dashboard) + KPIs placeholder

## Tu siguiente paso

1. Copia `.env.example` → `apps/mobile/.env` y `apps/web/.env`
2. Pega tu `firebaseConfig`
3. `npm run mobile` o `npm run web`

## Siguiente fase (7)

Módulo de usuarios / seed admin + apertura controlada de reglas Firestore.
