import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function updateEmailSettings(userId: string, settings: {
  enabled: boolean;
  recipient: string;
}) {
  await setDoc(doc(db, 'users', userId), {
    emailSettings: settings,
  }, { merge: true });
}

export async function getEmailSettings(userId: string): Promise<{
  enabled: boolean;
  recipient: string;
} | null> {
  const docRef = doc(db, 'users', userId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data().emailSettings || null;
}
