'use client';

import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase.client';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';

// ✅ Accept userId as prop
export default function SalesChart({ userId }: { userId: string }) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;

    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 6); // Last 7 days
    start.setHours(0, 0, 0, 0);

    const loadData = async () => {
      const q = query(
        collection(db, 'users', userId, 'orders'),
        where('timestamp', '>=', Timestamp.fromDate(start))
      );
      const snap = await getDocs(q);

      const dayMap: Record<string, number> = {};

      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const label = d.toLocaleDateString('en-ZA', { weekday: 'short' });
        dayMap[label] = 0;
      }

      snap.forEach((doc) => {
        const order = doc.data();
        const date = order.timestamp.toDate();
        const label = date.toLocaleDateString('en-ZA', { weekday: 'short' });
        dayMap[label] += order.totalPrice || 0;
      });

      const finalData = Object.entries(dayMap).map(([day, amount]) => ({
        day,
        amount,
      }));

      setData(finalData);
    };

    loadData();
  }, [userId]);

  return (
    <div className="p-6 bg-white border rounded shadow mb-6">
      <h2 className="text-xl font-semibold mb-4">📈 Sales This Week</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <Line type="monotone" dataKey="amount" stroke="#1e40af" strokeWidth={3} />
          <CartesianGrid stroke="#ccc" />
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

