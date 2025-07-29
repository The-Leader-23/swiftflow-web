'use client';

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

interface PageProps {
  params: { userId: string };
}

export default function PublicStorefront({ params }: PageProps) {
  const [userData, setUserData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [note, setNote] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const userRef = doc(db, 'users', params.userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserData(userSnap.data());
      }

      const productRef = collection(db, 'users', params.userId, 'products');
      const productSnap = await getDocs(productRef);
      setProducts(productSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    load();
  }, [params.userId]);

  const handleOrder = async () => {
    if (!selectedProduct || !selectedSize || !customerName) return;

    setSubmitting(true);
    await addDoc(collection(db, 'users', params.userId, 'orders'), {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      size: selectedSize,
      customerName,
      note,
      createdAt: new Date(),
    });

    setSubmitting(false);
    setSelectedProduct(null);
    setCustomerName('');
    setNote('');
    setSelectedSize('');
    alert('✅ Order placed!');
  };

  const primaryColor = userData?.primaryColor || '#000000';

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        {userData?.logoUrl && (
          <img
            src={userData.logoUrl}
            alt="Logo"
            className="w-16 h-16 rounded-full object-cover"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold">{userData?.businessName}</h1>
          <p className="text-gray-500">{userData?.bio}</p>
          <p className="text-sm text-gray-400">
            🚚 {userData?.deliveryTime} | Zones: {userData?.deliveryZones?.join(', ')}
          </p>
        </div>
      </div>

      {/* Products */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {products.map((product: any) => (
          <div
            key={product.id}
            className="border rounded-lg p-4 hover:shadow-md transition cursor-pointer"
            onClick={() => setSelectedProduct(product)}
          >
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-40 object-cover rounded mb-3"
            />
            <h2 className="text-lg font-semibold">{product.name}</h2>
            <p className="text-gray-500 text-sm">
              Sizes: {product.sizes.join(', ')}
            </p>
            <p className="mt-1 font-bold">R{product.price}</p>
          </div>
        ))}
      </div>

      {/* Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-[95%] max-w-md shadow-xl space-y-4 relative">
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-2 right-3 text-gray-400 hover:text-black"
            >
              ✕
            </button>
            <img
              src={selectedProduct.imageUrl}
              className="w-full h-48 object-cover rounded"
              alt={selectedProduct.name}
            />
            <h2 className="text-xl font-bold">{selectedProduct.name}</h2>
            <p className="text-gray-600 mb-2">Price: R{selectedProduct.price}</p>

            <div>
              <label className="text-sm font-medium">Select Size:</label>
              <select
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                className="w-full border rounded px-2 py-1 mt-1"
              >
                <option value="">Choose size</option>
                {selectedProduct.sizes.map((size: string) => (
                  <option key={size}>{size}</option>
                ))}
              </select>
            </div>

            <input
              type="text"
              placeholder="Your Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />

            <textarea
              placeholder="Delivery Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={2}
            />

            <button
              onClick={handleOrder}
              disabled={submitting}
              className="w-full text-white py-2 rounded"
              style={{ backgroundColor: primaryColor }}
            >
              {submitting ? 'Sending Order...' : 'Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
