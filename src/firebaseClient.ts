import type { FirebaseApp } from 'firebase/app';
import { getApp, getApps, initializeApp } from 'firebase/app';
import type { FirebaseStorage } from 'firebase/storage';
import { getStorage } from 'firebase/storage';

type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  appId: string;
  messagingSenderId?: string;
};

function readFirebaseConfig(): FirebaseClientConfig | null {
  const {
    VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_APP_ID,
    VITE_FIREBASE_MESSAGING_SENDER_ID,
  } = import.meta.env;

  if (
    !VITE_FIREBASE_API_KEY ||
    !VITE_FIREBASE_AUTH_DOMAIN ||
    !VITE_FIREBASE_PROJECT_ID ||
    !VITE_FIREBASE_STORAGE_BUCKET ||
    !VITE_FIREBASE_APP_ID
  ) {
    return null;
  }

  return {
    apiKey: VITE_FIREBASE_API_KEY,
    authDomain: VITE_FIREBASE_AUTH_DOMAIN,
    projectId: VITE_FIREBASE_PROJECT_ID,
    storageBucket: VITE_FIREBASE_STORAGE_BUCKET,
    appId: VITE_FIREBASE_APP_ID,
    messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID,
  };
}

let firebaseAppInstance: FirebaseApp | null | undefined;
let firebaseInitLogged = false;

export function getFirebaseApp(): FirebaseApp | null {
  if (firebaseAppInstance !== undefined) {
    if (!firebaseInitLogged && firebaseAppInstance) {
      console.info('[Firebase] Initialized (cached) for project:', firebaseAppInstance.options.projectId ?? 'unknown');
      firebaseInitLogged = true;
    }
    return firebaseAppInstance;
  }
  const config = readFirebaseConfig();
  if (!config) {
    firebaseAppInstance = null;
    return firebaseAppInstance;
  }
  try {
    firebaseAppInstance = getApps().length ? getApp() : initializeApp(config, 'shirtlab-uploads');
    if (!firebaseInitLogged && firebaseAppInstance) {
      const projectId = firebaseAppInstance.options.projectId ?? config.projectId;
      console.info('[Firebase] Initialized for project:', projectId ?? 'unknown');
      firebaseInitLogged = true;
    }
  } catch (error) {
    console.warn('[Firebase] Failed to initialize app', error);
    firebaseAppInstance = null;
  }
  return firebaseAppInstance;
}

let firebaseStorageInstance: FirebaseStorage | null | undefined;

export function getFirebaseStorage(): FirebaseStorage | null {
  if (firebaseStorageInstance !== undefined) {
    return firebaseStorageInstance;
  }
  const app = getFirebaseApp();
  if (!app) {
    firebaseStorageInstance = null;
    return firebaseStorageInstance;
  }
  try {
    firebaseStorageInstance = getStorage(app);
  } catch (error) {
    console.warn('[Firebase] Failed to initialize storage', error);
    firebaseStorageInstance = null;
  }
  return firebaseStorageInstance;
}

export function isFirebaseUploadsEnabled(): boolean {
  return Boolean(getFirebaseStorage());
}
