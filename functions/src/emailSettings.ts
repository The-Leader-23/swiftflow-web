// functions/src/emailSettings.ts
import { db } from './firebaseAdmin';

export type EmailSettings = {
  enabled: boolean;
  recipient: string;
  frequency: 'daily' | 'weekly' | 'off';
};

/**
 * Update email settings for a user
 */
export async function updateEmailSettings(userId: string, settings: EmailSettings) {
  await db.collection('users').doc(userId).set(
    { emailSettings: settings },
    { merge: true }
  );
}

/**
 * Get email settings for a user
 * Returns sane defaults if missing
 */
export async function getEmailSettings(userId: string): Promise<EmailSettings | null> {
  const snap = await db.collection('users').doc(userId).get();
  if (!snap.exists) return null;

  const s = (snap.data()?.emailSettings || {}) as Partial<EmailSettings>;
  return {
    enabled: s.enabled ?? false,
    recipient: s.recipient ?? '',
    frequency: (s.frequency as EmailSettings['frequency']) ?? 'daily',
  };
}


