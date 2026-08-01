# Sistema de Inventario y Préstamo — Laboratorio de Topografía (UAGro)

Plataforma web + móvil para control de inventario, préstamos, autorizaciones y auditoría.

## Estado del proyecto

| Fase | Estado |
|------|--------|
| 1–5 Análisis, arquitectura, BD, UI, Firebase | Completadas |
| **6 Scaffold monorepo** | **En curso** |
| 7+ Módulos | Pendiente |

## Estructura

```
apps/mobile     Expo (Android / iOS)
apps/web        Expo Web (panel administrativo)
packages/config Tokens + Firebase env helpers
packages/domain Roles, permisos, estados
packages/ui     Design System (Button, Badge, …)
packages/services Auth + Firebase SDK
```

## Requisitos

- Node.js 20+
- Expo Go en el teléfono compatible con **SDK 54** (versión de Play Store / App Store)
- Cuenta Firebase (`lab-topografia-uagro`) ya creada

## Configuración rápida

1. Instalar dependencias desde la raíz:

```bash
npm install
```

2. Copiar variables de entorno:

```bash
copy .env.example apps\mobile\.env
copy .env.example apps\web\.env
```

3. Completa en ambos `.env` los valores de tu `firebaseConfig` (Firebase Console).

4. Arrancar (pueden correr a la vez; usan puertos distintos):

```bash
npm run mobile
# Metro: http://localhost:8081  → app móvil (QR con Expo Go)
# Si abres el navegador ahí, verás el login MÓVIL en web (no es el panel admin)

npm run web
# Panel admin: http://localhost:8082
```

## Notas

- Firestore y Storage siguen con reglas denegadas (`allow read, write: if false`). El login Auth funciona; el perfil en `users/{uid}` se leerá cuando abramos reglas / creemos el usuario seed en Fase 7.
- Sin documento `users/{uid}`, el rol por defecto al entrar será `student` hasta asignar Custom Claims / documento de perfil.
- Prototipos de referencia: `flujo_mobil.html`, `dashboard.html`.
