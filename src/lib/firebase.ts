// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage'; // ✅ Needed for image uploads

const firebaseConfig = {
  apiKey: "AIzaSyC4lLuryWo8OgssybmY-OapmXPqy3dwDJk",
  authDomain: "swift-c3347.firebaseapp.com",
  projectId: "swift-c3347",
  storageBucket: "swift-c3347.firebasestorage.app",// ✅ this is correct // ✅ FIXED
  messagingSenderId: "750004933370",
  appId: "1:750004933370:web:5e00507b1f49f5945b6f43",
  measurementId: "G-TPQE2GRSHQ"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app); // ✅ Add this

export { db, auth, storage }; // ✅ Export storage too

