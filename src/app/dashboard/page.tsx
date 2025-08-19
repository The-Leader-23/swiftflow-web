'use client';

import { useEffect, useState } from 'react';
import { db, storage } from '@/lib/firebase.client';
import {
  collection,
  getDocs,
  onSnapshot,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  Timestamp,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { useAuth } from '@/app/context/AuthContext';
import EmailSettings from './EmailSettings';
import SalesChart from './charts';
import toast from 'react-hot-toast'; // for notifications

export default function Dashboard() {
  const { user } = useAuth();
  const [dailyRevenue, setDailyRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [lowStock, setLowStock] = useState<string[]>([]);

  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    const getRevenue = async () => {
      const q = query(
        collection(db, 'users', user.uid, 'finance'),
        where('timestamp', '>=', todayTimestamp)
      );
      const snap = await getDocs(q);

      let total = 0;
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.type === 'income') {
          total += data.amount || 0;
        }
      });
      setDailyRevenue(total);
    };

    const getOrders = async () => {
      const q = query(
        collection(db, 'users', user.uid, 'orders'),
        where('timestamp', '>=', todayTimestamp)
      );
      const snap = await getDocs(q);
      setTotalOrders(snap.size);
    };

    const unsubStock = onSnapshot(collection(db, 'users', user.uid, 'products'), (snap) => {
      const lows = snap.docs
        .filter((doc) => (doc.data().stock || 0) <= 5)
        .map((doc) => doc.data().name);
      setLowStock(lows);
    });

    getRevenue();
    getOrders();

    return () => unsubStock();
  }, [user]);

  // ✅ Real-time notification for new orders
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'orders'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    let lastOrderId: string | null = null;

    const unsub = onSnapshot(q, (snapshot) => {
      const latest = snapshot.docs[0];
      if (!latest) return;

      const data = latest.data();
      const orderId = latest.id;

      // Skip first load
      if (!lastOrderId) {
        lastOrderId = orderId;
        return;
      }

      if (orderId !== lastOrderId) {
        lastOrderId = orderId;
        toast.success(`🛒 New order from ${data.customerName || 'someone'}!`);
      }
    });

    return () => unsub();
  }, [user]);

  const addProduct = async () => {
    if (!user) return;
    const { name, price, stock } = newProduct;
    if (!name || !price || !stock) {
      alert('Please fill out all product fields.');
      return;
    }

    setUploading(true);
    let imageUrl = '';

    if (imageFile) {
      try {
        const storageRef = ref(storage, `products/${user.uid}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      } catch (error) {
        console.error('❌ Image upload failed:', error);
        alert('Image upload failed. Please try a smaller JPG or PNG file.');
        setUploading(false);
        return;
      }
    }

    try {
      const privateRef = await addDoc(collection(db, 'users', user.uid, 'products'), {
        name,
        price: parseFloat(price),
        stock: parseInt(stock),
        imageUrl,
        createdAt: Timestamp.now(),
      });

      // Sync to public_products
      await setDoc(doc(db, 'public_products', privateRef.id), {
        name,
        price: parseFloat(price),
        stock: parseInt(stock),
        imageUrl,
        ownerId: user.uid,
        isVisible: true,
        createdAt: Timestamp.now(),
      });

      setNewProduct({ name: '', price: '', stock: '' });
      setImageFile(null);
    } catch (err) {
      console.error('❌ Error adding product:', err);
      alert('Failed to add product.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📊 SwiftMind Dashboard</h1>

      <div className="grid gap-4 mb-6">
        <div className="border p-4 rounded bg-black/10">
          <h2 className="font-semibold text-lg">💸 Revenue Today</h2>
          <p className="text-2xl">R{dailyRevenue}</p>
        </div>

        <div className="border p-4 rounded bg-black/10">
          <h2 className="font-semibold text-lg">📦 Orders Today</h2>
          <p className="text-2xl">{totalOrders} orders</p>
        </div>

        <div className="border p-4 rounded bg-black/10">
          <h2 className="font-semibold text-lg">⚠️ Low Stock</h2>
          {lowStock.length > 0 ? (
            <ul className="list-disc list-inside">
              {lowStock.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>All stock healthy ✅</p>
          )}
        </div>
      </div>

      {/* ➕ Product Upload */}
      <div className="border p-4 rounded bg-black/10">
        <h2 className="font-semibold text-lg mb-2">➕ Add Product</h2>
        <input
          type="text"
          placeholder="Product name"
          value={newProduct.name}
          onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
          className="w-full mb-2 p-2 border rounded text-black"
        />
        <input
          type="number"
          placeholder="Price"
          value={newProduct.price}
          onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
          className="w-full mb-2 p-2 border rounded text-black"
        />
        <input
          type="number"
          placeholder="Stock"
          value={newProduct.stock}
          onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
          className="w-full mb-2 p-2 border rounded text-black"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] || null)}
          className="w-full mb-2"
        />
        <button
          onClick={addProduct}
          disabled={uploading}
          className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
        >
          {uploading ? 'Uploading...' : 'Add Product'}
        </button>
      </div>

      {/* 📧 Email Report Settings */}
      <EmailSettings userId={user?.uid || ''} />

      {/* 📊 Sales chart */}
      {user && <SalesChart userId={user.uid} />}
    </main>
  );
}




