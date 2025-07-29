'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function RoleRedirect() {
  const router = useRouter();

  useEffect(() => {
    const redirectBasedOnRole = async () => {
      const user = auth.currentUser;

      if (!user) {
        router.push('/signup');
        return;
      }

      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.data();
      const role = userData?.role;

      if (role === 'entrepreneur') {
        if (!userData?.isRegistered) {
          router.push('/swiftmind/setup'); // ✅ Correct route
        } else {
          router.push('/swiftmind/dashboard');
        }
      } else {
        router.push('/swiftflow');
      }
    };

    redirectBasedOnRole();
  }, [router]);

  return (
    <div className="h-screen flex items-center justify-center text-lg text-gray-600">
      Redirecting you to your dashboard...
    </div>
  );
}


