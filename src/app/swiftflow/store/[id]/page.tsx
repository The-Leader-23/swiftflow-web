'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from 'firebase/firestore';
import { motion } from 'framer-motion';

export default function StorefrontPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.userId as string;

  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      const userRef = doc(db, 'users', id);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setStoreInfo(userSnap.data());
      }

      const productQuery = query(
        collection(db, 'public_products'),
        where('ownerId', '==', id),
        where('isVisible', '==', true)
      );
      const productSnap = await getDocs(productQuery);
      const items = productSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(items);
      setLoading(false);
    };

    fetchData();
  }, [id]);

  const addToCart = (product: any) => {
    const storedCart = JSON.parse(localStorage.getItem('swiftflow_cart') || '[]');
    const existing = storedCart.find((item: any) => item.id === product.id);

    const updatedCart = existing
      ? storedCart.map((item: any) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      : [...storedCart, { ...product, quantity: 1, storeId: id }];

    localStorage.setItem('swiftflow_cart', JSON.stringify(updatedCart));
    alert(`🛒 ${product.name} added to cart`);
  };

  const bg = storeInfo?.primaryColor || '#1f2937';

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#111827] to-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <button
          onClick={() => router.back()}
          className="mb-6 text-sm text-blue-500 underline hover:text-blue-300"
        >
          ← Back to SwiftFlow
        </button>

        <div
          className="rounded-xl border border-gray-700 p-6 mb-10 flex flex-col md:flex-row items-center md:items-start gap-6"
          style={{ backgroundColor: `${bg}22` }}
        >
          <div className="w-20 h-20 rounded-full overflow-hidden border border-white bg-white/10">
            {storeInfo?.logoUrl ? (
              <img
                src={storeInfo.logoUrl}
                alt="Logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-300">
                No Logo
              </div>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1">{storeInfo?.businessName}</h1>
            <p className="text-sm text-purple-300">{storeInfo?.businessType}</p>
            <p className="text-sm text-gray-400 mt-2 max-w-xl">
              {storeInfo?.bio || 'This store has no description yet.'}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-blue-400">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="text-gray-400">No public products yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <motion.div
                key={product.id}
                whileHover={{ scale: 1.03 }}
                className="bg-white/5 border border-gray-700 rounded-2xl overflow-hidden backdrop-blur-md"
              >
                <div className="relative">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-64 object-contain bg-black p-4"
                  />
                  <div className="absolute top-2 right-2 text-xs bg-black text-white px-2 py-1 rounded-full">
                    🛒 Tap to add
                  </div>
                </div>

                <div className="p-4">
                  <h2 className="text-lg font-semibold mb-1">{product.name}</h2>
                  <p className="text-sm text-blue-300">Price: R{product.price}</p>
                  <p className="text-sm text-gray-400">Stock: {product.stock}</p>
                  <button
                    onClick={() => addToCart(product)}
                    className="mt-3 w-full bg-black text-white py-2 rounded hover:bg-gray-800 transition"
                  >
                    ➕ Add to Cart
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}





