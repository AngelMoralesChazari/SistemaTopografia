import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseConfig, isFirebaseConfigured } from '@lab-topo/config';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  const config = getFirebaseConfig();
  if (!isFirebaseConfigured(config)) {
    throw new Error(
      'Firebase no está configurado. Copia .env.example a apps/mobile/.env y apps/web/.env con tu firebaseConfig.'
    );
  }
  app = getApps().length ? getApps()[0]! : initializeApp(config);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;

  const firebaseApp = getFirebaseApp();

  // En móvil sin AsyncStorage el token caduca y no se refresca (auth/user-token-expired).
  if (Platform.OS !== 'web') {
    try {
      auth = initializeAuth(firebaseApp, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      // Ya inicializado (Fast Refresh / segundo import)
      auth = getAuth(firebaseApp);
    }
  } else {
    auth = getAuth(firebaseApp);
  }

  return auth;
}

export function getDb(): Firestore {
  if (!db) db = getFirestore(getFirebaseApp());
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) storage = getStorage(getFirebaseApp());
  return storage;
}

export function checkFirebaseReady(): { ok: boolean; message: string } {
  const config = getFirebaseConfig();
  if (!isFirebaseConfigured(config)) {
    return {
      ok: false,
      message: 'Faltan variables EXPO_PUBLIC_FIREBASE_* en el archivo .env',
    };
  }
  return { ok: true, message: `Proyecto: ${config.projectId}` };
}
