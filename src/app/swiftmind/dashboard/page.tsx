'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast, { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function EntrepreneurDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [dailyRevenue, setDailyRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [lowStock, setLowStock] = useState<string[]>([]);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const fetchDashboardData = async () => {
    if (!user) return;

    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const todayTimestamp = Timestamp.fromDate(todayStart);

    try {
      const ordersSnap = await getDocs(collection(db, 'users', user.uid, 'orders'));
      const orders = ordersSnap.docs.map((doc) => doc.data());
      const todaysOrders = orders.filter(
        (order) => order.timestamp?.seconds >= todayTimestamp.seconds
      );

      setTotalOrders(todaysOrders.length);
      const revenue = todaysOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      setDailyRevenue(revenue);

      const productsSnap = await getDocs(collection(db, 'users', user.uid, 'products'));
      const lowStockList: string[] = [];
      productsSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.stock <= 3) lowStockList.push(data.name);
      });
      setLowStock(lowStockList);
    } catch (err) {
      console.error('🔥 Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const handleAddProduct = async () => {
    if (!user) {
      toast.error('No authenticated user!');
      return;
    }
  
    if (!newProduct.name || !newProduct.price || !newProduct.stock || !imageFile) {
      toast.error('Please fill all product fields!');
      return;
    }
  
    setLoading(true);
    try {
      const storageRef = ref(storage, `products/${user.uid}/${imageFile.name}`);
      await uploadBytes(storageRef, imageFile);
      const imageUrl = await getDownloadURL(storageRef);
  
      const productData = {
        ...newProduct,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock),
        imageUrl,
        createdAt: Timestamp.now(),
        isVisible: true, // ✅ optionally used for visibility control
        ownerId: user.uid,
      };
  
      // Save privately under the entrepreneur
      const productRef = await addDoc(collection(db, 'users', user.uid, 'products'), productData);
  
      // Save publicly under SwiftFlow
      await addDoc(collection(db, 'public_products'), {
        ...productData,
        productId: productRef.id,
        businessId: user.uid,
      });
  
      toast.success('Product uploaded and synced to SwiftFlow! 🎉');
      router.push('/swiftmind/products');
    } catch (err) {
      console.error('❌ Upload failed:', err);
      toast.error('Failed to upload product.');
    }
    setLoading(false);
  };  

  if (authLoading) {
    return <div className="p-4 text-white">Loading user...</div>;
  }

  return (
    <div className="p-4 text-white">
      <Toaster />
      <h1 className="text-2xl font-bold mb-4">📊 SwiftMind Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="border p-4 rounded">
          <h2 className="text-lg font-semibold">💸 Revenue Today</h2>
          <p>R{dailyRevenue}</p>
        </div>
        <div className="border p-4 rounded">
          <h2 className="text-lg font-semibold">📦 Orders Today</h2>
          <p>{totalOrders} orders</p>
        </div>
        <div className="border p-4 rounded">
          <h2 className="text-lg font-semibold">⚠️ Low Stock</h2>
          <p>{lowStock.length > 0 ? lowStock.join(', ') : 'All stock healthy ✅'}</p>
        </div>
      </div>

      <div className="border p-4 rounded mb-6">
        <h2 className="text-lg font-semibold mb-2">➕ Add Product</h2>
        <input
          type="text"
          placeholder="Product name"
          className="input mb-2 w-full"
          value={newProduct.name}
          onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
        />
        <input
          type="number"
          placeholder="Price"
          className="input mb-2 w-full"
          value={newProduct.price}
          onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
        />
        <input
          type="number"
          placeholder="Stock"
          className="input mb-2 w-full"
          value={newProduct.stock}
          onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
        />
        <input
          type="file"
          className="mb-2 w-full"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setImageFile(file);
              setImagePreview(URL.createObjectURL(file));
            }
          }}
        />

        {imagePreview && (
          <img
            src={imagePreview}
            alt="Preview"
            className="w-full mb-2 rounded border h-40 object-cover"
          />
        )}

        <button
          onClick={handleAddProduct}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          {loading ? 'Adding...' : 'Add Product'}
        </button>
      </div>
    </div>
  );
}











