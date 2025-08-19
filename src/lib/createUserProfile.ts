// lib/createUserProfile.ts
import { db } from '@/lib/firebase.client'; // client SDK
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function createUserProfile(
  uid: string,
  email: string,
  role: 'customer' | 'entrepreneur'
) {
  try {
    // Base user doc (+ defaults for entrepreneurs)
    const userPayload: any = {
      email,
      role,
      createdAt: serverTimestamp(),
      isRegistered: role === 'entrepreneur', // keep your current behavior
      ...(role === 'entrepreneur'
        ? {
            emailSettings: {
              enabled: false,          // start OFF; they can enable in Settings
              recipient: email,        // default to their account email
              frequency: 'weekly' as const, // 'daily' | 'weekly'
            },
          }
        : {}),
    };

    // ✅ Create/merge user profile
    await setDoc(doc(db, 'users', uid), userPayload, { merge: true });

    // ✅ Publish entrepreneur to public_users (empty shell)
    if (role === 'entrepreneur') {
      await setDoc(
        doc(db, 'public_users', uid),
        {
          businessName: '',
          bio: '',
          businessType: '',
          logoUrl: '',
          isFeatured: false,
          ownerId: uid,
          hasBank: false,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    console.log('✅ User profile created');
  } catch (err) {
    console.error('❌ Failed to create profile:', err);
    throw err;
  }
}




