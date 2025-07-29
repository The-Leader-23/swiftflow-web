'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function CartPage() {
  const [cart, setCart] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('swiftflow_cart') || '[]');
    setCart(stored);
  }, []);

  const removeItem = (index: number) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
    localStorage.setItem('swiftflow_cart', JSON.stringify(updated));
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <motion.h1
        className="text-3xl font-bold mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        🛒 Your Cart
      </motion.h1>

      {cart.length === 0 ? (
        <motion.p
          className="text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Your cart is empty.
        </motion.p>
      ) : (
        <>
          <div className="space-y-4">
            {cart.map((item, index) => (
              <motion.div
                key={index}
                className="flex items-center justify-between border p-4 rounded bg-white shadow-sm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center gap-4">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div>
                    <p className="font-bold">{item.name}</p>
                    <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                    <p className="text-sm">R{item.price} each</p>
                  </div>
                </div>

                <button
                  onClick={() => removeItem(index)}
                  className="text-red-600 hover:underline text-sm"
                >
                  Remove
                </button>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="mt-6 flex justify-between items-center bg-gray-50 p-4 rounded shadow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-xl font-bold">Total: R{total.toFixed(2)}</p>
            <button
              onClick={() => router.push('/swiftflow/checkout')}
              className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800 transition"
            >
              Proceed to Checkout
            </button>
          </motion.div>
        </>
      )}
    </div>
  );
}
