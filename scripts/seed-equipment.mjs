/**
 * Siembra categorías y equipos en Firestore.
 * Requiere: secrets/serviceAccount.json
 * Uso: npm run seed:equipment
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
const seedPath = join(__dirname, 'seed-equipment.json');
const LAB_ID = process.env.EXPO_PUBLIC_LAB_ID || 'lab-topo-uagro';

if (!existsSync(serviceAccountPath)) {
  console.error(`Falta ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
const items = JSON.parse(readFileSync(seedPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

const categories = [
  { id: 'cat-topografia', name: 'Topografía', sortOrder: 1 },
  { id: 'cat-gnss', name: 'GNSS', sortOrder: 2 },
  { id: 'cat-accesorios', name: 'Accesorios', sortOrder: 3 },
];

async function main() {
  console.log(`Sembrando inventario labId=${LAB_ID}...\n`);

  for (const cat of categories) {
    await db.collection('categories').doc(cat.id).set(
      {
        name: cat.name,
        description: null,
        sortOrder: cat.sortOrder,
        active: true,
        labId: LAB_ID,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`✓ categoría ${cat.name}`);
  }

  for (const item of items) {
    const existing = await db
      .collection('equipment')
      .where('labId', '==', LAB_ID)
      .where('internalCode', '==', item.internalCode)
      .limit(1)
      .get();

    const payload = {
      ...item,
      qtyReserved: 0,
      qtyLoaned: item.status === 'loaned' ? Math.max(1, item.qtyTotal - item.qtyAvailable) : 0,
      acquisitionDate: null,
      photoUrl: null,
      manualUrl: null,
      labId: LAB_ID,
      active: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (existing.empty) {
      await db.collection('equipment').add({
        ...payload,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`✓ equipo creado  ${item.internalCode} — ${item.name}`);
    } else {
      await existing.docs[0].ref.set(payload, { merge: true });
      console.log(`✓ equipo actualizado ${item.internalCode} — ${item.name}`);
    }
  }

  console.log(`
Listo. ${items.length} equipos en Firestore.
Publica las reglas actualizadas (equipment write para encargado/admin).
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
