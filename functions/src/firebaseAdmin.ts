// functions/src/firebaseAdmin.ts
import { getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Admin SDK exactly once
const app = getApps().length ? getApp() : initializeApp();

export const db = getFirestore(app);
// (export auth/storage later if you need them)
// export const auth = getAuth(app);
// export const storage = getStorage(app);
