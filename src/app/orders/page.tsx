// app/orders/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase.client';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { useAuth } from '@/app/context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

type Product = {
  id: string;
  productId?: string; // we mirror private id into productId
  name: string;
  price: number;
  stock: number;
  category?: string;
};

type Order = {
  id: string;
  items?: Array<{ productId: string; name: string; price: number; qty: number }>;
  productName?: string;  // legacy field (single-item)
  quantity?: number;     // legacy field
  total?: number;
  totalPrice?: number;   // legacy field
  status?: string;       // 'Waiting for Payment' | 'Paid' | legacy variants
  createdAt?: Timestamp; // preferred
  timestamp?: Timestamp; // legacy
  source?: 'manual' | 'checkout';
  proofUrl?: string;     // proof of payment image URL (from checkout)
};

export default function OrdersPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedId),
    [products, selectedId]
  );
  const computedTotal = useMemo(
    () => (selectedProduct ? Number(selectedProduct.price || 0) * (quantity || 0) : 0),
    [selectedProduct, quantity]
  );

  useEffect(() => {
    if (!user) return;

    // Products (live)
    const unsubProducts = onSnapshot(
      collection(db, 'users', user.uid, 'products'),
      (snapshot) => {
        const data = snapshot.docs.map((d) => {
          const p = d.data() as any;
          return {
            id: d.id,
            productId: p.productId || d.id,
            name: p.name,
            price: Number(p.price || 0),
            stock: Number(p.stock || 0),
            category: p.category,
          } as Product;
        });
        setProducts(data);
      }
    );

    // Orders (live, newest first)
    const unsubOrders = onSnapshot(
      query(collection(db, 'users', user.uid, 'orders'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Order[];
        setOrders(data);
      }
    );

    return () => {
      unsubProducts();
      unsubOrders();
    };
  }, [user]);

  const placeOrder = async () => {
    if (!user) return toast.error('Please sign in');
    if (!selectedId) return toast.error('Select a product');
    if (!quantity || quantity < 1) return toast.error('Quantity must be at least 1');

    const productRef = doc(db, 'users', user.uid, 'products', selectedId);
    const publicProductRef = doc(db, 'public_products', selectedId); // id == productId

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(productRef);
        if (!snap.exists()) throw new Error('Product not found');

        const p = snap.data() as Product;
        const currentStock = Number((p as any).stock || 0);
        if (currentStock < quantity) throw new Error('Not enough stock');

        const priceEach = Number((p as any).price || 0);
        const lineTotal = priceEach * quantity;

        // Clamp so stock never goes negative
        const nextStock = Math.max(0, currentStock - quantity);

        // Decrement stock in private & public
        tx.update(productRef, {
          stock: nextStock,
          updatedAt: serverTimestamp(),
        });
        tx.update(publicProductRef, {
          stock: nextStock,
          updatedAt: serverTimestamp(),
        });

        // Create order (manual orders are Paid immediately)
        const orderRef = doc(collection(db, 'users', user.uid, 'orders'));
        tx.set(orderRef, {
          items: [
            {
              productId: selectedId,
              name: (p as any).name || 'Item',
              price: priceEach,
              qty: quantity,
            },
          ],
          productName: (p as any).name, // legacy
          quantity, // legacy
          total: lineTotal,
          totalPrice: lineTotal, // legacy
          status: 'Paid',
          source: 'manual',
          createdAt: serverTimestamp(),
        });
      });

      // Finance entry separate (not part of tx)
      await addDoc(collection(db, 'users', user.uid, 'finance'), {
        type: 'income',
        source: 'product sale',
        amount: computedTotal,
        createdAt: serverTimestamp(),
      });

      setQuantity(1);
      setSelectedId('');
      toast.success('Order placed ✅');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to place order');
    }
  };

  const normalizeStatus = (s?: string) => {
    if (!s) return '—';
    if (s.toLowerCase() === 'paid') return 'Paid';
    if (s.toLowerCase().startsWith('waiting')) return 'Waiting for Payment';
    return s;
  };

  const pillClass = (s?: string) =>
    normalizeStatus(s) === 'Paid'
      ? 'bg-emerald-500/90 text-white'
      : 'bg-yellow-400/90 text-black';

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fbc2eb] via-[#a6c1ee] to-[#fbc2eb]">
      <Toaster />
      <div className="max-w-3xl mx-auto p-6">
        {/* Back to dashboard */}
        <div className="mb-4">
          <button
            onClick={() => router.push('/swiftflow/dashboard')}
            className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm"
          >
            ← Back to Entrepreneur Dashboard
          </button>
        </div>

        <h1 className="text-2xl font-bold mb-4">📦 Orders</h1>

        <div className="flex flex-col gap-4 mb-6 bg-white p-4 rounded-2xl shadow">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="">Select Product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} – R{Number(p.price).toFixed(2)} (Stock: {p.stock})
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || '1', 10)))}
              className="border p-2 rounded"
              placeholder="Quantity"
            />
            <div className="flex items-center justify-between border p-2 rounded bg-gray-50">
              <span className="text-gray-600">Total</span>
              <span className="font-semibold">R{computedTotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={placeOrder}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Place Order
          </button>
        </div>

        <h2 className="text-xl font-semibold mb-2">🧾 Order History</h2>
        <ul className="space-y-2">
          {orders.map((o) => {
            const created =
              o.createdAt?.toDate().toLocaleString() ||
              o.timestamp?.toDate().toLocaleString() ||
              '—';
            const amount = o.total ?? o.totalPrice ?? 0;

            const label = o.items?.length
              ? `${o.items[0].name} x${o.items[0].qty}` +
                (o.items.length > 1 ? ` +${o.items.length - 1} more` : '')
              : `${o.productName || 'Order'}`;

            return (
              <li key={o.id} className="border p-3 rounded shadow-sm bg-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {o.proofUrl ? (
                      <a href={o.proofUrl} target="_blank" rel="noreferrer">
                        <img
                          src={o.proofUrl}
                          alt="Proof"
                          className="h-12 w-12 rounded object-cover border"
                        />
                      </a>
                    ) : (
                      <div className="h-12 w-12 rounded bg-gray-100 grid place-items-center text-xs text-gray-500 border">
                        —
                      </div>
                    )}
                    <div className="min-w-0">
                      <strong className="block truncate">{label}</strong>
                      <div className="text-xs text-gray-500">{created}</div>
                      {o.proofUrl ? (
                        <a
                          href={o.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 underline"
                        >
                          View proof
                        </a>
                      ) : (
                        <span className="text-xs text-gray-500">No proof yet</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-semibold">R{Number(amount).toFixed(2)}</div>
                    <div className={`text-xs inline-block mt-1 px-2 py-0.5 rounded ${pillClass(o.status)}`}>
                      {normalizeStatus(o.status)}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}







