'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  onSnapshot,
  Timestamp,
  where,
  getDocs,
} from 'firebase/firestore';
import SwiftMindLayout from '..//swiftmind/SwiftMindLayout';
import SalesChart from '../dashboard/charts';

interface ProductSales {
  [productName: string]: number;
}

export default function InsightsPage() {
  const [topProduct, setTopProduct] = useState('');
  const [productSales, setProductSales] = useState<ProductSales>({});
  const [reorderList, setReorderList] = useState<string[]>([]);

  useEffect(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);
    const weekStart = Timestamp.fromDate(startOfWeek);

    const getWeeklySales = async () => {
      const q = query(
        collection(db, 'orders'),
        where('timestamp', '>=', weekStart)
      );
      const snap = await getDocs(q);

      const sales: ProductSales = {};
      snap.forEach((doc) => {
        const data = doc.data();
        const name = data.productName;
        const qty = data.quantity;
        sales[name] = (sales[name] || 0) + qty;
      });

      setProductSales(sales);

      const sorted = Object.entries(sales).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) setTopProduct(sorted[0][0]);
    };

    const getLowStock = () => {
      const unsub = onSnapshot(collection(db, 'products'), (snap) => {
        const low = snap.docs
          .filter((doc) => (doc.data().stock || 0) <= 3)
          .map((doc) => doc.data().name);
        setReorderList(low);
      });

      return () => unsub();
    };

    getWeeklySales();
    const unsubStock = getLowStock();

    return () => unsubStock();
  }, []);

  return (
    <SwiftMindLayout>
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">📈 Swift Insights</h1>

        <SalesChart />

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">🔥 Top Product This Week</h2>
          <p className="text-xl">
            {topProduct ? topProduct : 'No sales this week yet 😴'}
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">📊 Weekly Sales Summary</h2>
          {Object.entries(productSales).length > 0 ? (
            <ul className="space-y-1">
              {Object.entries(productSales).map(([name, qty]) => (
                <li key={name}>
                  {name}: <strong>{qty} unit(s)</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>No data yet</p>
          )}
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">⚠️ Reorder Suggestions</h2>
          {reorderList.length > 0 ? (
            <ul className="list-disc list-inside">
              {reorderList.map((item, i) => (
                <li key={i}>
                  {item} stock is low. Suggest restocking soon 💡
                </li>
              ))}
            </ul>
          ) : (
            <p>All products are well-stocked ✅</p>
          )}
        </section>
      </main>
    </SwiftMindLayout>
  );
}


