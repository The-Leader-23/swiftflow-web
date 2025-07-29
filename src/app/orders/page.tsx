'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import SwiftMindLayout from '..//swiftmind/SwiftMindLayout';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface Order {
  id: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  timestamp?: Timestamp;
}

export default function OrdersPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState(1);

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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Order[];
      setOrders(data);
    });
    return () => unsub();
  }, []);

  const placeOrder = async () => {
    if (!selectedId || quantity < 1) return alert('Select a product and valid quantity');

    const productRef = doc(db, 'products', selectedId);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) return alert('Product not found');

    const product = productSnap.data() as Product;

    if (product.stock < quantity) return alert('Not enough stock');

    const total = product.price * quantity;

    await addDoc(collection(db, 'orders'), {
      productId: selectedId,
      productName: product.name,
      quantity,
      totalPrice: total,
      timestamp: Timestamp.now(),
    });

    await addDoc(collection(db, 'finance'), {
      type: 'income',
      source: 'product sale',
      amount: total,
      timestamp: Timestamp.now(),
    });

    await updateDoc(productRef, {
      stock: product.stock - quantity,
    });

    setQuantity(1);
    setSelectedId('');
  };

  return (
    <SwiftMindLayout>
      <main className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">📦 Orders</h1>

        <div className="flex flex-col gap-4 mb-6">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="">Select Product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} – R{p.price} (Stock: {p.stock})
              </option>
            ))}
          </select>

          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value))}
            className="border p-2 rounded"
            placeholder="Quantity"
          />

          <button
            onClick={placeOrder}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Place Order
          </button>
        </div>

        <h2 className="text-xl font-semibold mb-2">🧾 Order History</h2>
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id} className="border p-3 rounded shadow-sm">
              <strong>{o.productName}</strong> – {o.quantity} unit(s) – Total: R{o.totalPrice}
            </li>
          ))}
        </ul>
      </main>
    </SwiftMindLayout>
  );
}

