/**
 * Crea usuarios en Firebase Auth + documentos en Firestore.
 *
 * Requisitos:
 * 1. Descarga la clave de cuenta de servicio (JSON) desde Firebase Console
 * 2. Guárdala como: secrets/serviceAccount.json  (está en .gitignore)
 * 3. npm install (incluye firebase-admin)
 * 4. npm run seed:users
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const serviceAccountPath = join(root, 'secrets', 'serviceAccount.json');
const seedPath = join(__dirname, 'seed-users.json');
const LAB_ID = process.env.EXPO_PUBLIC_LAB_ID || 'lab-topo-uagro';

if (!existsSync(serviceAccountPath)) {
  console.error(`
No se encontró secrets/serviceAccount.json

Cómo obtenerlo:
1. Firebase Console → ⚙️ Configuración del proyecto → Cuentas de servicio
2. "Generar nueva clave privada"
3. Guarda el archivo como:
   ${serviceAccountPath}
`);
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
const users = JSON.parse(readFileSync(seedPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function upsertAuthUser(entry) {
  try {
    const existing = await auth.getUserByEmail(entry.email);
    await auth.updateUser(existing.uid, {
      password: entry.password,
      displayName: entry.displayName,
      disabled: false,
    });
    return existing.uid;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      const created = await auth.createUser({
        email: entry.email,
        password: entry.password,
        displayName: entry.displayName,
        emailVerified: true,
      });
      return created.uid;
    }
    throw error;
  }
}

async function main() {
  console.log(`Sembrando ${users.length} usuarios en labId=${LAB_ID}...\n`);

  for (const entry of users) {
    const uid = await upsertAuthUser(entry);

    // Custom claim (útil para Functions/reglas futuras)
    await auth.setCustomUserClaims(uid, { role: entry.role, labId: LAB_ID });

    const profile = {
      uid,
      email: entry.email,
      displayName: entry.displayName,
      role: entry.role,
      studentId: entry.studentId ?? null,
      employeeId: entry.employeeId ?? null,
      groupIds: [],
      active: true,
      labId: LAB_ID,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'seed-script',
    };

    await db.collection('users').doc(uid).set(profile, { merge: true });
    console.log(`✓ ${entry.role.padEnd(12)} ${entry.email}  (${uid})`);
  }

  await db.collection('settings').doc('general').set(
    {
      labName: 'Laboratorio de Topografía',
      facultyName: 'Facultad de Topografía',
      universityName: 'Universidad Autónoma de Guerrero',
      maxAdmins: 2,
      timezone: 'America/Mexico_City',
      labId: LAB_ID,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await db.collection('settings').doc('loanPolicy').set(
    {
      defaultLoanDays: 3,
      allowRental: true,
      rentalRequiresPaymentBeforeDelivery: true,
      maxActiveLoansPerStudent: 3,
      labId: LAB_ID,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await db.collection('stats').doc('dashboard').set(
    {
      pendingCount: 0,
      loanedCount: 0,
      returnedToday: 0,
      overdueCount: 0,
      labId: LAB_ID,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`
Listo.

Cuentas de prueba (contraseña: LabTopo2026!):
  admin1@labtopo.uagro.edu.mx     → Administrador
  admin2@labtopo.uagro.edu.mx     → Administrador
  encargado@labtopo.uagro.edu.mx  → Encargado
  maestro@labtopo.uagro.edu.mx    → Maestro
  alumno@labtopo.uagro.edu.mx     → Alumno

Siguiente:
1. Publica las reglas (firestore.rules / storage.rules) en Firebase Console
   o: npx firebase deploy --only firestore:rules,storage
2. Entra en la app móvil o web con cualquiera de esas cuentas
`);
}

main().catch((error) => {
  console.error('Error al sembrar usuarios:', error);
  process.exit(1);
});
