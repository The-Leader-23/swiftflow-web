// app/swiftflow/role-redirect/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase.client';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function RoleRedirect() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/signup');
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? snap.data() : null;
        const role = (data?.role as string) ?? 'customer';

        if (role === 'entrepreneur') {
          router.replace('/swiftflow/dashboard');
        } else {
          router.replace('/swiftflow');
        }
      } catch (err) {
        console.error('role-redirect error:', err);
        router.replace('/swiftflow');
      }
    });

    return () => unsub();
  }, [router]);

  return (
    <div className="h-screen flex items-center justify-center text-lg text-gray-600">
      Redirecting…
    </div>
  );
}





