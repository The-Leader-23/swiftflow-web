'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase.client';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { useAuth } from '@/app/context/AuthContext';
import toast from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  createdAt?: Timestamp;
}

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  total: number;
  createdAt?: Timestamp;
  proofUrl?: string;
  status?: string;
}

export default function ProductsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'bank'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [bankDetails, setBankDetails] = useState('');
  const [form, setForm] = useState({
    name: '',
    price: '',
    stock: '',
    category: '',
  });

  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(collection(db, 'users', user.uid, 'products'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        ...(doc.data() as Product),
        id: doc.id,
      }));
      setProducts(data);
    });

    const loadUser = async () => {
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists() && snap.data().bankDetails) {
        setBankDetails(snap.data().bankDetails);
      }

      const ordersSnap = await getDocs(collection(db, 'users', user.uid, 'orders'));
      const allOrders = ordersSnap.docs.map((doc) => ({
        ...(doc.data() as Order),
        id: doc.id,
      }));
      setOrders(allOrders);
    };

    loadUser();
    return () => unsub();
  }, [user]);

  const saveBankDetails = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { bankDetails });
      await updateDoc(doc(db, 'public_users', user.uid), { bankDetails });
      toast.success('Bank details saved!');
    } catch (err) {
      toast.error('Failed to save bank details.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (!user) return;
    const { name, price, stock, category } = form;
    if (!name || !price || !stock || !category) return alert('Fill in all fields!');

    try {
      const docRef = await addDoc(collection(db, 'users', user.uid, 'products'), {
        name,
        price: parseFloat(price),
        stock: parseInt(stock),
        category,
        createdAt: Timestamp.now(),
      });

      // Sync to public_products
      await setDoc(doc(db, 'public_products', docRef.id), {
        name,
        price: parseFloat(price),
        stock: parseInt(stock),
        category,
        ownerId: user.uid,
        isVisible: true,
        createdAt: Timestamp.now(),
      });

      setForm({ name: '', price: '', stock: '', category: '' });
      toast.success('Product added!');
    } catch (err) {
      toast.error('Failed to add product');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-10">
      <h1 className="text-3xl font-bold mb-4">Entrepreneur Dashboard</h1>

      <div className="flex gap-4 mb-6">
        {['products', 'orders', 'bank'].map((tab) => (
          <button
            key={tab}
            className={`tab-button ${activeTab === tab ? 'font-bold underline' : ''}`}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'products' && (
        <section>
          <h2 className="text-2xl font-semibold mb-3">🛒 Add Product</h2>
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

          <h2 className="text-xl font-semibold mb-2">📦 All Products</h2>
          <ul className="space-y-2">
            {products.map((p) => (
              <li key={p.id} className="border p-3 rounded shadow-sm">
                <strong>{p.name}</strong> – R{p.price} – Stock: {p.stock} – {p.category}
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeTab === 'orders' && (
        <section>
          <h2 className="text-2xl font-semibold mb-3">📄 Orders</h2>
          {orders.length === 0 ? (
            <p>No orders yet.</p>
          ) : (
            <ul className="space-y-4">
              {orders
                .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
                .map((o) => (
                  <li key={o.id} className="border p-4 rounded-xl shadow bg-white/90">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="text-lg font-bold">{o.customerName}</h3>
                      {o.status === 'paid' ? (
                        <span className="bg-green-200 text-green-800 text-xs font-bold px-2 py-1 rounded-full">
                          PAID
                        </span>
                      ) : o.proofUrl ? (
                        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">
                          🟢 New Proof Uploaded
                        </span>
                      ) : (
                        <span className="bg-gray-200 text-gray-700 text-xs font-medium px-2 py-1 rounded-full">
                          Pending
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-700">📞 {o.customerPhone}</p>
                    <p className="text-sm text-gray-700">💰 Total: R{o.total}</p>
                    <p className="text-sm text-gray-600">
                      🗓️ {o.createdAt?.toDate().toLocaleString()}
                    </p>

                    <div className="mt-3">
                      {o.proofUrl ? (
                        <>
                          <p className="text-sm font-medium text-gray-800 mb-1">
                            📸 Proof of Payment:
                          </p>
                          <img
                            src={o.proofUrl}
                            alt="Payment Proof"
                            className="w-full max-w-xs rounded shadow border"
                          />
                        </>
                      ) : (
                        <p className="text-sm text-red-600 font-medium">
                          ❌ No payment proof uploaded yet.
                        </p>
                      )}
                    </div>

                    {o.status !== 'paid' && o.proofUrl && (
                      <button
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'users', user!.uid, 'orders', o.id), {
                              status: 'paid',
                            });
                            toast.success(`✅ Marked as paid!`);
                            setOrders((prev) =>
                              prev.map((ord) =>
                                ord.id === o.id ? { ...ord, status: 'paid' } : ord
                              )
                            );
                          } catch (err) {
                            toast.error('❌ Failed to mark as paid');
                          }
                        }}
                        className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
                      >
                        ✅ Mark as Paid
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === 'bank' && (
        <section>
          <h2 className="text-2xl font-semibold mb-3">🏦 Bank Info</h2>
          <textarea
            value={bankDetails}
            onChange={(e) => setBankDetails(e.target.value)}
            className="w-full border rounded p-2 h-28"
            placeholder="Enter your banking information here..."
          />
          <button
            onClick={saveBankDetails}
            className="bg-green-600 text-white px-4 py-2 mt-2 rounded hover:bg-green-700"
          >
            Save Bank Info
          </button>
        </section>
      )}
    </div>
  );
}




