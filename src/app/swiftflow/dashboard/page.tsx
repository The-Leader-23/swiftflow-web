'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  Timestamp,
  addDoc,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { uploadImage } from '@/lib/uploadImage';
import { motion } from 'framer-motion';

export default function EntrepreneurDashboard() {
  const { user, loading: authLoading } = useAuth();

  const [dailyRevenue, setDailyRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [lowStock, setLowStock] = useState<string[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

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
      const low: string[] = [];
      const productList: any[] = [];

      productsSnap.docs.forEach((doc) => {
        const data = doc.data();
        productList.push({ id: doc.id, ...data });
        if (data.stock <= 3) low.push(data.name);
      });

      setProducts(productList);
      setLowStock(low);
    } catch (err) {
      console.error('🔥 Failed to load dashboard data:', err);
    }
  };

  const handleAddProduct = async () => {
    if (!user) return toast.error('No authenticated user!');
    if (!newProduct.name || !newProduct.price || !newProduct.stock || !imageFile)
      return toast.error('Fill all fields and upload an image!');

    setLoading(true);
    try {
      const imageUrl = await uploadImage(imageFile, user.uid);

      const productData = {
        ...newProduct,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock),
        imageUrl,
        createdAt: Timestamp.now(),
        isVisible: true,
        ownerId: user.uid,
      };

      const productRef = await addDoc(
        collection(db, 'users', user.uid, 'products'),
        productData
      );

      await addDoc(collection(db, 'public_products'), {
        ...productData,
        productId: productRef.id,
        businessId: user.uid,
      });

      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.data();

      if (userData?.businessName) {
        await setDoc(doc(db, 'public_users', user.uid), {
          businessName: userData.businessName,
          businessType: userData.businessType || 'Other',
          bio: userData.bio || '',
          logoUrl: userData.logoUrl || '',
          primaryColor: userData.primaryColor || '#6b7280',
        });

        toast.success('✅ Store synced to SwiftFlow!');
      }

      toast.success('🎉 Product added!');
      setNewProduct({ name: '', price: '', stock: '' });
      setImageFile(null);
      setImagePreview('');
      fetchDashboardData();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="p-6 text-gray-900">Loading your dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fbc2eb] via-[#a6c1ee] to-[#fbc2eb] text-gray-900 p-6">
      <Toaster />
      <h1 className="text-3xl font-bold mb-6 text-center">
        📊 SwiftFlow Entrepreneur Dashboard
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard title="💸 Revenue Today" value={`R${dailyRevenue}`} />
        <StatCard title="📦 Orders Today" value={`${totalOrders}`} />
        <StatCard
          title="⚠️ Low Stock"
          value={lowStock.length > 0 ? lowStock.join(', ') : 'All good ✅'}
        />
      </div>

      <ProductUploader
        newProduct={newProduct}
        setNewProduct={setNewProduct}
        imageFile={imageFile}
        setImageFile={setImageFile}
        imagePreview={imagePreview}
        setImagePreview={setImagePreview}
        handleAddProduct={handleAddProduct}
        loading={loading}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {products.map((product) => (
          <motion.div
            key={product.id}
            whileHover={{ scale: 1.02 }}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-md"
          >
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-48 object-contain bg-white p-4"
            />
            <div className="p-4">
              <h2 className="text-lg font-semibold">{product.name}</h2>
              <p className="text-sm text-blue-600">R{product.price}</p>
              <p className="text-xs text-gray-600 mt-1">Stock: {product.stock}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="border p-4 rounded bg-white shadow-md text-center">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-xl text-purple-600 font-bold">{value}</p>
    </div>
  );
}

function ProductUploader({
  newProduct,
  setNewProduct,
  imageFile,
  setImageFile,
  imagePreview,
  setImagePreview,
  handleAddProduct,
  loading,
}: any) {
  const handleChange =
    (field: 'name' | 'price' | 'stock') => (e: ChangeEvent<HTMLInputElement>) => {
      setNewProduct((prev: any) => ({
        ...prev,
        [field]: e.target.value,
      }));
    };

  return (
    <div className="border p-4 rounded bg-white shadow-md mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-900">➕ Add New Product</h2>
      <input
        type="text"
        placeholder="Product name"
        className="input mb-2 w-full text-gray-900 bg-white p-2 rounded border"
        value={newProduct.name}
        onChange={handleChange('name')}
      />
      <input
        type="number"
        placeholder="Price"
        className="input mb-2 w-full text-gray-900 bg-white p-2 rounded border"
        value={newProduct.price}
        onChange={handleChange('price')}
      />
      <input
        type="number"
        placeholder="Stock"
        className="input mb-2 w-full text-gray-900 bg-white p-2 rounded border"
        value={newProduct.stock}
        onChange={handleChange('stock')}
      />
      <input
        type="file"
        className="mb-2 w-full text-gray-700"
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
        className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded hover:from-blue-600 hover:to-purple-600 transition"
      >
        {loading ? 'Adding...' : 'Add Product'}
      </button>
    </div>
  );
}


