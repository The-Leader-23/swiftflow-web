'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DailySales {
  date: string;
  total: number;
}

export default function SmartCharts() {
  const [salesData, setSalesData] = useState<DailySales[]>([]);

  useEffect(() => {
    const fetchSales = async () => {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, 'orders'),
        where('timestamp', '>=', Timestamp.fromDate(startDate))
      );

      const snap = await getDocs(q);
      const raw: { [key: string]: number } = {};

      snap.forEach((doc) => {
        const data = doc.data();
        const date = new Date(data.timestamp.toDate());
        const key = date.toISOString().slice(0, 10); // YYYY-MM-DD
        raw[key] = (raw[key] || 0) + data.totalPrice;
      });

      // Fill missing days
      const final: DailySales[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        final.push({ date: key.slice(5), total: raw[key] || 0 }); // MM-DD
      }

      setSalesData(final);
    };

    fetchSales();
  }, []);

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-2">📊 Weekly Revenue</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={salesData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis tickFormatter={(val) => `R${val}`} />
          <Tooltip formatter={(val: any) => `R${val}`} />
          <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
