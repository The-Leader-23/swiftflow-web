'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  getDocs,
  collection,
  query,
} from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { motion } from 'framer-motion';

interface Business {
  id: string;
  businessName: string;
  businessType: string;
  bio: string;
  logoUrl?: string;
  primaryColor?: string;
}

export default function SwiftFlowHome() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    const loadAll = async () => {
      const q = query(collection(db, 'public_users'));
      const snap = await getDocs(q);

      const temp: Business[] = [];

      for (const docSnap of snap.docs) {
        const userId = docSnap.id;
        const userData = docSnap.data();

        if (userData.businessName) {
          temp.push({
            id: userId,
            businessName: userData.businessName,
            businessType: userData.businessType || 'Other',
            bio: userData.bio || '',
            logoUrl: userData.logoUrl || '',
            primaryColor: userData.primaryColor || '#6b7280',
          });
        }
      }

      setBusinesses(temp);
    };

    loadAll();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fbc2eb] via-[#a6c1ee] to-[#fbc2eb] text-gray-900 px-6 py-10">
      <div className="flex justify-between items-center max-w-6xl mx-auto mb-10">
        <motion.h1
          className="text-4xl font-extrabold tracking-tight"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          🛍️ Discover SwiftFlow Stores
        </motion.h1>

        {mounted && !user && (
          <button
            onClick={() => router.push('/login')}
            className="bg-white px-4 py-2 rounded-xl shadow text-sm hover:shadow-md transition font-semibold border border-gray-300"
          >
            Log in
          </button>
        )}
      </div>

      {businesses.length === 0 ? (
        <p className="text-center text-gray-600 mt-20">No public stores yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {businesses.map((biz) => (
            <StoreCard key={biz.id} biz={biz} />
          ))}
        </div>
      )}
    </div>
  );
}

function StoreCard({ biz }: { biz: Business }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="bg-white border border-gray-200 rounded-2xl overflow-hidden p-5 shadow-md hover:shadow-xl transition cursor-pointer"
    >
      <Link href={`/swiftflow/store/${biz.id}`}>
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-white border border-gray-300 mb-4">
            {biz.logoUrl ? (
              <img
                src={biz.logoUrl}
                alt="logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                No Logo
              </div>
            )}
          </div>

          <h2 className="text-xl font-bold mb-1">{biz.businessName}</h2>
          <p className="text-sm text-blue-600 mb-1">{biz.businessType}</p>
          <p className="text-sm text-gray-600 line-clamp-3">{biz.bio}</p>
        </div>
      </Link>
    </motion.div>
  );
}






  