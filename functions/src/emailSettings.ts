import { db } from './firebaseAdmin'; // ✅ correct: this is admin.firestore()
import * as functions from 'firebase-functions';

type EmailSettings = {
  enabled: boolean;
  recipient: string;
  frequency: 'daily' | 'weekly' | 'off';
};

export async function updateEmailSettings(
  userId: string,
  settings: EmailSettings
) {
  await db.collection('users').doc(userId).set(
    {
      emailSettings: settings,
    },
    { merge: true }
  );
}

export async function getEmailSettings(
  userId: string
): Promise<EmailSettings | null> {
  const snap = await db.collection('users').doc(userId).get();
  if (!snap.exists) return null;

  const settings = snap.data()?.emailSettings || {};
  return {
    enabled: settings.enabled ?? false,
    recipient: settings.recipient ?? '',
    frequency: settings.frequency ?? 'daily',
  };
}
