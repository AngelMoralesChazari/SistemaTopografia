# Acceso inicial — Firebase (usuarios + reglas)

Para entrar a la **app móvil** y al **sitio web** necesitas:

1. Publicar reglas de Firestore/Storage  
2. Crear cuentas de prueba (seed)

---

## Paso 1 — Publicar reglas de seguridad

### Opción A (rápida, desde la consola)

1. Abre [Firebase Console](https://console.firebase.google.com/) → proyecto `lab-topografia-uagro`
2. **Firestore → Rules**  
   Copia el contenido de `firestore.rules` del repo → **Publish**
3. **Storage → Rules**  
   Copia el contenido de `storage.rules` → **Publish**

### Opción B (CLI)

```powershell
npm install -g firebase-tools
firebase login
firebase use lab-topografia-uagro
firebase deploy --only firestore:rules,storage
```

---

## Paso 2 — Descargar cuenta de servicio

1. Firebase Console → ⚙️ **Configuración del proyecto** → **Cuentas de servicio**
2. **Generar nueva clave privada**
3. Guarda el JSON como:

```text
Sistema Topografia/secrets/serviceAccount.json
```

Ese archivo **no se sube a Git** (ya está ignorado).

---

## Paso 3 — Sembrar usuarios

En la raíz del proyecto:

```powershell
npm install
npm run seed:users
```

Se crean 5 cuentas:

| Correo | Rol | Contraseña |
|--------|-----|------------|
| `admin1@labtopo.uagro.edu.mx` | Superadministrador | `LabTopo2026!` |
| `admin2@labtopo.uagro.edu.mx` | Administrador | `LabTopo2026!` |
| `encargado@labtopo.uagro.edu.mx` | Encargado | `LabTopo2026!` |
| `maestro@labtopo.uagro.edu.mx` | Maestro | `LabTopo2026!` |
| `alumno@labtopo.uagro.edu.mx` | Alumno | `LabTopo2026!` |

También crea `settings/general`, `settings/loanPolicy` y `stats/dashboard`.

---

## Paso 4 — Entrar

```powershell
npm run mobile
# o
npm run web
```

- **Web (encargado/admin):** `encargado@labtopo.uagro.edu.mx` / `LabTopo2026!`
- **Móvil (alumno):** `alumno@labtopo.uagro.edu.mx` / `LabTopo2026!`
- **Particular (renta):** no hay cuenta seed; usa **Registro para renta de equipo** en el login. El encargado aprueba en **Particulares**.

Tras el login verás el shell según el rol (tabs móvil / sidebar web).

---

## Si algo falla

| Síntoma | Qué revisar |
|---------|-------------|
| “No se pudo leer el perfil en Firestore” | Reglas no publicadas |
| “no hay perfil en Firestore” | No corriste `npm run seed:users` |
| Correo/contraseña incorrectos | Usuario no creado en Authentication |
| Rol incorrecto (siempre alumno) | Cierra sesión, vuelve a entrar (fuerza refresh del token) |

---

## Alternativa manual (sin script)

1. Authentication → Add user (email/password)
2. Copia el **UID**
3. Firestore → colección `users` → documento con ID = UID:

```json
{
  "uid": "PEGAR_UID",
  "email": "tu@correo.com",
  "displayName": "Nombre",
  "role": "lab_manager",
  "active": true,
  "labId": "lab-topo-uagro",
  "groupIds": [],
  "studentId": null,
  "employeeId": "LAB-001"
}
```

Roles válidos: `super_admin` | `admin` | `lab_manager` | `teacher` | `student` | `renter`

Para `renter` (particular), el documento también incluye: `renterStatus` (`pending` | `approved` | `rejected`), `phone`, `company`, `ine`, `rfc`, `address`. Los particulares se crean por registro en la app (no por seed).
