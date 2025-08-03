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
  const id = params?.id as string;

  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState('');
  const [showGoToCart, setShowGoToCart] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        const userRef = doc(db, 'public_users', id);
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
      } catch (error) {
        console.error('Error loading store:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const addToCart = (product: any) => {
    if (!selectedSize) {
      alert('⚠️ Please select a size before adding to cart.');
      return;
    }

    const storedCart = JSON.parse(localStorage.getItem('swiftflow_cart') || '[]');
    const existing = storedCart.find((item: any) => item.id === product.id && item.size === selectedSize);

    const updatedCart = existing
      ? storedCart.map((item: any) =>
          item.id === product.id && item.size === selectedSize
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      : [...storedCart, { ...product, quantity: 1, storeId: id, size: selectedSize }];

    localStorage.setItem('swiftflow_cart', JSON.stringify(updatedCart));
    setShowGoToCart(true);
  };

  const bg = storeInfo?.primaryColor || '#3b82f6';

  return (
    <div className="min-h-screen text-gray-900 bg-gradient-to-br from-[#fbc2eb] via-[#a6c1ee] to-[#fbc2eb]">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <button
          onClick={() => router.back()}
          className="mb-6 text-sm text-blue-700 underline hover:text-blue-900 transition"
        >
          ← Back to SwiftFlow
        </button>

        <div className="rounded-2xl border border-gray-300 p-6 mb-10 flex flex-col md:flex-row items-center md:items-start gap-6 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white bg-gray-100 shadow-inner">
            {storeInfo?.logoUrl ? (
              <img
                src={storeInfo.logoUrl}
                alt="Logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                No Logo
              </div>
            )}
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-1">{storeInfo?.businessName}</h1>
            <p className="text-sm text-blue-600">{storeInfo?.businessType}</p>
            <p className="text-sm text-gray-600 mt-2 max-w-xl">
              {storeInfo?.bio || 'This store has no description yet.'}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-blue-600">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="text-gray-600">No public products yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <motion.div
                key={product.id}
                whileHover={{ scale: 1.03 }}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
              >
                <div className="relative">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-64 object-contain bg-white p-4"
                  />
                  <div className="absolute top-2 right-2 text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                    🛒 Tap to add
                  </div>
                </div>

                <div className="p-4">
                  <h2 className="text-lg font-semibold mb-1">{product.name}</h2>
                  <p className="text-sm text-blue-600">Price: R{product.price}</p>
                  <p className="text-sm text-gray-600">Stock: {product.stock}</p>

                  <select
                    className="mt-2 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    onChange={(e) => setSelectedSize(e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>Select Size</option>
                    <option value="S">Small</option>
                    <option value="M">Medium</option>
                    <option value="L">Large</option>
                    <option value="XL">Extra Large</option>
                  </select>

                  <button
                    onClick={() => addToCart(product)}
                    className="mt-3 w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2 rounded-lg hover:from-blue-600 hover:to-purple-600 transition shadow-md"
                  >
                    ➕ Add to Cart
                  </button>

                  {showGoToCart && (
                    <button
                      onClick={() => router.push('/swiftflow/cart')}
                      className="mt-2 text-sm text-blue-700 underline hover:text-blue-900"
                    >
                      🛒 Go to My Cart
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

