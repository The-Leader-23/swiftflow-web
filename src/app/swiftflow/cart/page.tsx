'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';

export default function CartPage() {
  const [cart, setCart] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('swiftflow_cart') || '[]');
    setCart(stored);
  }, []);

  useEffect(() => {
    const sum = cart.reduce((acc, item) => {
      const price = parseFloat(item.price);
      const quantity = parseInt(item.quantity);
      return acc + (isNaN(price) || isNaN(quantity) ? 0 : price * quantity);
    }, 0);
    setTotal(sum);
  }, [cart]);

  const updateCart = (newCart: any[]) => {
    setCart(newCart);
    localStorage.setItem('swiftflow_cart', JSON.stringify(newCart));
  };

  const removeItem = (index: number) => {
    const updated = [...cart];
    const removedItem = updated.splice(index, 1)[0];
    updateCart(updated);
    toast.success(`🗑️ Removed ${removedItem.name}`);
  };

  const changeQuantity = (index: number, delta: number) => {
    const updated = [...cart];
    const newQuantity = (updated[index].quantity || 1) + delta;

    if (newQuantity < 1) {
      removeItem(index);
    } else {
      updated[index].quantity = newQuantity;
      updateCart(updated);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gradient-to-b from-[#f1fbc2eb] via-[#a6c1ee] to-[#f1fbc2eb] min-h-screen rounded-xl shadow-xl">
      <Toaster />

      {/* BACK BUTTON */}
      <button
        onClick={() => router.push('/swiftflow')}
        className="mb-6 text-sm bg-white/80 text-black px-4 py-2 rounded-full hover:bg-white transition"
      >
        ⬅️ Back to Store
      </button>

      <motion.h1
        className="text-4xl font-extrabold text-white drop-shadow mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        🛒 Your Cart
      </motion.h1>

      {cart.length === 0 ? (
        <motion.p
          className="text-gray-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Your cart is empty.
        </motion.p>
      ) : (
        <>
          <div className="space-y-4">
            <AnimatePresence>
              {cart.map((item, index) => (
                <motion.div
                  key={index}
                  className="flex items-center justify-between border border-white/20 backdrop-blur p-4 rounded-xl bg-white/30 shadow-md"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50, transition: { duration: 0.2 } }}
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-lg shadow"
                    />
                    <div>
                      <p className="font-bold text-white">{item.name}</p>
                      <div className="flex items-center gap-2 text-white/80 mt-1">
                        <button
                          className="px-2 rounded bg-white/20 hover:bg-white/40 text-white font-bold"
                          onClick={() => changeQuantity(index, -1)}
                        >
                          −
                        </button>
                        <span>Quantity: {item.quantity}</span>
                        <button
                          className="px-2 rounded bg-white/20 hover:bg-white/40 text-white font-bold"
                          onClick={() => changeQuantity(index, 1)}
                        >
                          +
                        </button>
                      </div>
                      <p className="text-sm text-white/90 mt-1">R{item.price} each</p>
                    </div>
                  </div>

                  <button
                    onClick={() => removeItem(index)}
                    className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded-lg transition"
                  >
                    Remove
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <motion.div
            className="mt-8 flex flex-col sm:flex-row justify-between items-center bg-white/20 backdrop-blur p-6 rounded-xl shadow-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-2xl font-bold text-white mb-4 sm:mb-0">
              Total: R{total.toFixed(2)}
            </p>
            <button
              onClick={() => router.push('/swiftflow/checkout')}
              className="bg-white text-[#121212] font-semibold px-6 py-3 rounded-lg hover:bg-[#f2f2f2] transition shadow"
            >
              Proceed to Checkout
            </button>
          </motion.div>
        </>
      )}
    </div>
  );
}


