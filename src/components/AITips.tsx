'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase.client';
import {
  collection,
  query,
  where,
  Timestamp,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';

export default function AITips() {
  const [tips, setTips] = useState<string[]>([]);

  useEffect(() => {
    const fetchTips = async () => {
      const tipList: string[] = [];

      // 🔍 Restock alerts
      const unsub = onSnapshot(collection(db, 'products'), (snap) => {
        snap.docs.forEach((doc) => {
          const d = doc.data();
          if ((d.stock || 0) <= 3) {
            tipList.push(`⚠️ Restock "${d.name}" soon — stock is low.`);
          }
        });
        setTips((prev) => [...prev, ...tipList]);
      });

      // 📉 Weekly sales check
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);

      const salesQuery = query(
        collection(db, 'orders'),
        where('timestamp', '>=', Timestamp.fromDate(weekStart))
      );
      const salesSnap = await getDocs(salesQuery);

      const salesMap: Record<string, number> = {};
      salesSnap.forEach((doc) => {
        const data = doc.data();
        salesMap[data.productName] = (salesMap[data.productName] || 0) + data.quantity;
      });

      const sorted = Object.entries(salesMap).sort((a, b) => b[1] - a[1]);

      if (sorted.length === 0) {
        tipList.push('🛑 No sales in the past 7 days — consider promoting your top products.');
      } else {
        tipList.push(`🔥 "${sorted[0][0]}" is your best-seller this week — double down with ads.`);
      }

      setTips((prev) => [...prev, ...tipList]);

      return () => unsub();
    };

    fetchTips();
  }, []);

  return (
    <div className="mt-8 bg-gray-800 p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-semibold mb-2">💡 Smart Business Tips</h2>
      {tips.length > 0 ? (
        <ul className="list-disc list-inside text-gray-300 space-y-2">
          {tips.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-400">AI is analyzing your data... 🔄</p>
      )}
    </div>
  );
}
