'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase.client';
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { useAuth } from '@/app/context/AuthContext';

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
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!user) return;

    const unsubProducts = onSnapshot(
      collection(db, 'users', user.uid, 'products'),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Product[];
        setProducts(data);
      }
    );

    const unsubOrders = onSnapshot(
      collection(db, 'users', user.uid, 'orders'),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Order[];
        setOrders(data);
      }
    );

    return () => {
      unsubProducts();
      unsubOrders();
    };
  }, [user]);

  const placeOrder = async () => {
    if (!user || !selectedId || quantity < 1) {
      alert('Select a product and valid quantity');
      return;
    }

    const productRef = doc(db, 'users', user.uid, 'products', selectedId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
      alert('Product not found');
      return;
    }

    const product = productSnap.data() as Product;

    if (product.stock < quantity) {
      alert('Not enough stock');
      return;
    }

    const total = product.price * quantity;

    // Add order
    await addDoc(collection(db, 'users', user.uid, 'orders'), {
      productId: selectedId,
      productName: product.name,
      quantity,
      totalPrice: total,
      timestamp: Timestamp.now(),
    });

    // Add finance entry
    await addDoc(collection(db, 'users', user.uid, 'finance'), {
      type: 'income',
      source: 'product sale',
      amount: total,
      timestamp: Timestamp.now(),
    });

    // Update product stock
    await updateDoc(productRef, {
      stock: product.stock - quantity,
    });

    setQuantity(1);
    setSelectedId('');
  };

  return (
    <main className="max-w-3xl mx-auto p-6">
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
  );
}



