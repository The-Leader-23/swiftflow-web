import { db } from '@/lib/firebase.client'; // ✅ Make sure this points to client Firestore SDK
import { doc, setDoc } from 'firebase/firestore';

export async function createUserProfile(
  uid: string,
  email: string,
  role: 'customer' | 'entrepreneur'
) {
  try {
    // ✅ Creates user doc
    await setDoc(doc(db, 'users', uid), {
      email,
      role,
      createdAt: new Date(),
      isRegistered: role === 'entrepreneur',
    });

    // ✅ If entrepreneur, also publish to public_users
    if (role === 'entrepreneur') {
      await setDoc(doc(db, 'public_users', uid), {
        businessName: '',
        bio: '',
        businessType: '',
        logoUrl: '',
        isFeatured: false,
        createdAt: new Date(),
      });
    }

    console.log('✅ User profile created');
  } catch (err) {
    console.error('❌ Failed to create profile:', err);
    throw err;
  }
}



