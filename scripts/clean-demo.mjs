/**
 * Script para limpiar datos de prueba antes de una demostración.
 *
 * Limpia:
 * 1. Todos los préstamos, solicitudes y retrasos (colección 'loans').
 * 2. Registros de bitácora (colección 'audit_logs').
 * 3. Restaura el stock de los equipos: qtyAvailable = qtyTotal, qtyLoaned = 0, qtyReserved = 0, status = 'available'.
 * 4. Elimina usuarios de prueba creados con Google (Auth + Firestore users/{uid}),
 *    conservando intactos los perfiles semilla oficiales (admin1, admin2, encargado, maestro, alumno).
 *
 * Requiere: secrets/serviceAccount.json
 * Uso: node scripts/clean-demo.mjs
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
const seedUsersPath = join(__dirname, 'seed-users.json');

if (!existsSync(serviceAccountPath)) {
  console.error(`
================================================================================
❌ No se encontró: secrets/serviceAccount.json
================================================================================
Para ejecutar esta limpieza automatizada:
1. Ve a Firebase Console: https://console.firebase.google.com/
2. Abre tu proyecto: lab-topografia-uagro
3. ⚙️ Configuración del proyecto → Pestaña "Cuentas de servicio"
4. Clic en "Generar nueva clave privada" (se descargará un archivo .json)
5. Renómbralo y guárdalo exactamente en:
   ${serviceAccountPath}
6. Vuelve a ejecutar: npm run clean:demo
================================================================================
`);
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore();

// Correos protegidos que NO deben borrarse
const PROTECTED_EMAILS = new Set([
  'admin1@labtopo.uagro.edu.mx',
  'admin2@labtopo.uagro.edu.mx',
  'encargado@labtopo.uagro.edu.mx',
  'maestro@labtopo.uagro.edu.mx',
  'alumno@labtopo.uagro.edu.mx',
]);

// Cargar también emails de seed-users.json si existen
if (existsSync(seedUsersPath)) {
  try {
    const seedList = JSON.parse(readFileSync(seedUsersPath, 'utf8'));
    for (const u of seedList) {
      if (u.email) PROTECTED_EMAILS.add(u.email.toLowerCase().trim());
    }
  } catch {
    // Ignorar si no se puede leer
  }
}

async function deleteCollection(collectionPath, batchSize = 100) {
  const collectionRef = db.collection(collectionPath);
  let totalDeleted = 0;

  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    totalDeleted += snapshot.size;
  }

  return totalDeleted;
}

async function resetEquipmentStock() {
  const snapshot = await db.collection('equipment').get();
  if (snapshot.empty) return 0;

  const batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const qtyTotal = Number(data.qtyTotal || 1);
    batch.update(doc.ref, {
      qtyTotal,
      qtyAvailable: qtyTotal,
      qtyLoaned: 0,
      qtyReserved: 0,
      status: 'available',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    count++;
  }

  await batch.commit();
  return count;
}

async function cleanGoogleAndTestUsers() {
  let listUsersResult;
  let nextPageToken;
  let deletedCount = 0;

  do {
    listUsersResult = await auth.listUsers(100, nextPageToken);
    for (const userRecord of listUsersResult.users) {
      const email = (userRecord.email || '').toLowerCase().trim();
      const isGoogle = userRecord.providerData.some((p) => p.providerId === 'google.com');

      // Si inició con Google o no es de los correos protegidos
      if (isGoogle || (!PROTECTED_EMAILS.has(email) && !email.endsWith('@labtopo.uagro.edu.mx'))) {
        console.log(`  🗑️  Eliminando usuario de prueba/Google: ${email || userRecord.uid} (${userRecord.displayName || 'Sin nombre'})`);
        
        // 1. Borrar de Firebase Auth
        try {
          await auth.deleteUser(userRecord.uid);
        } catch (err) {
          console.warn(`     Error al borrar de Auth: ${err.message}`);
        }

        // 2. Borrar documento en Firestore users/{uid}
        try {
          await db.collection('users').doc(userRecord.uid).delete();
        } catch (err) {
          console.warn(`     Error al borrar de Firestore: ${err.message}`);
        }

        deletedCount++;
      } else {
        console.log(`  🛡️  Conservando usuario oficial: ${email} (${userRecord.displayName || ''})`);
      }
    }
    nextPageToken = listUsersResult.pageToken;
  } while (nextPageToken);

  return deletedCount;
}

async function main() {
  console.log('\n🚀 Iniciando limpieza de datos de prueba para la demostración...\n');

  // 1. Limpiar préstamos
  console.log('1. Eliminando historial de préstamos, pedidos y retrasos (loans)...');
  const loansDeleted = await deleteCollection('loans');
  console.log(`   ✅ ${loansDeleted} solicitudes/préstamos eliminados.\n`);

  // 2. Limpiar logs de auditoría
  console.log('2. Eliminando registros de bitácora (audit_logs)...');
  const auditDeleted = await deleteCollection('audit_logs');
  console.log(`   ✅ ${auditDeleted} logs de auditoría eliminados.\n`);

  // 3. Restaurar stock de equipos
  console.log('3. Restaurando stock y estatus de equipos (equipment)...');
  const eqReset = await resetEquipmentStock();
  console.log(`   ✅ ${eqReset} equipos restaurados con su stock total disponible.\n`);

  // 4. Limpiar cuenta de Google y usuarios temporales
  console.log('4. Limpiando cuentas temporales y accesos con Google...');
  const usersDeleted = await cleanGoogleAndTestUsers();
  console.log(`   ✅ ${usersDeleted} cuentas de prueba eliminadas.\n`);

  console.log('================================================================================');
  console.log('🎉 ¡Base de datos limpia y lista para la demostración de mañana!');
  console.log('================================================================================\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error durante la limpieza:', err);
  process.exit(1);
});
