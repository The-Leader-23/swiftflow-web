'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import SwiftMindLayout from '..//swiftmind/SwiftMindLayout';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  createdAt?: Timestamp;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({
    name: '',
    price: '',
    stock: '',
    category: '',
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
      setProducts(data);
    });

    return () => unsub();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    const { name, price, stock, category } = form;
    if (!name || !price || !stock || !category) return alert('Fill in all fields!');

    await addDoc(collection(db, 'products'), {
      name,
      price: parseFloat(price),
      stock: parseInt(stock),
      category,
      createdAt: Timestamp.now(),
    });

    setForm({ name: '', price: '', stock: '', category: '' });
  };

  return (
    <SwiftMindLayout>
      <main className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">🛒 Products DB</h1>

        <div className="grid gap-4 mb-6">
          {['name', 'price', 'stock', 'category'].map((field) => (
            <input
              key={field}
              name={field}
              placeholder={field.toUpperCase()}
              value={(form as any)[field]}
              onChange={handleChange}
              className="border rounded p-2"
            />
          ))}
          <button
            onClick={handleSubmit}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add Product
          </button>
        </div>

        <h2 className="text-xl font-semibold mb-2">🧾 All Products</h2>
        <ul className="space-y-2">
          {products.map((p) => (
            <li key={p.id} className="border p-3 rounded shadow-sm">
              <strong>{p.name}</strong> – R{p.price} – Stock: {p.stock} – {p.category}
            </li>
          ))}
        </ul>
      </main>
    </SwiftMindLayout>
  );
}


