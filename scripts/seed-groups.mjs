/**
 * Siembra los 16 grupos de Topografía en Firestore.
 * Requiere: secrets/serviceAccount.json
 * Uso: npm run seed:groups
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
const LAB_ID = process.env.EXPO_PUBLIC_LAB_ID || 'lab-topo-uagro';

if (!existsSync(serviceAccountPath)) {
  console.error(`Falta ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

const TOPOGRAPHY_GROUPS = [
  '101', '102',
  '201', '202',
  '301', '302',
  '401', '402',
  '501', '502',
  '601', '602',
  '701', '702',
  '801', '802',
];

async function main() {
  console.log(`Sembrando grupos de Topografía en labId=${LAB_ID}...\n`);

  for (const code of TOPOGRAPHY_GROUPS) {
    const ref = db.collection('groups').doc(code);
    await ref.set(
      {
        id: code,
        code,
        name: `Grupo ${code}`,
        career: 'Topografía',
        labId: LAB_ID,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`✓ Grupo ${code} guardado en Firestore.`);
  }

  console.log(`\nÉxito: Se sembraron ${TOPOGRAPHY_GROUPS.length} grupos de Topografía.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
