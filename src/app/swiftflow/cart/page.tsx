'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';

type CartItem = {
  id: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  size?: string | null;
  storeId: string; // MUST equal seller UID
};

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const router = useRouter();

  // Load & normalize cart; also enforce single-store
  useEffect(() => {
    const stored: CartItem[] = JSON.parse(localStorage.getItem('swiftflow_cart') || '[]');

    const normalized = (stored || []).map((it) => ({
      ...it,
      productId: it.productId ?? it.id,
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1,
    })) as CartItem[];

    // single-store guard (prevents bank fetch mismatch later)
    if (normalized.length > 0) {
      const firstStore = normalized[0].storeId;
      const mixed = normalized.some((x) => x.storeId !== firstStore);
      if (mixed) {
        toast.error('Cart had items from multiple stores. We reset it to avoid confusion.');
        localStorage.removeItem('swiftflow_cart');
        setCart([]);
        return;
      }
    }

    setCart(normalized);
  }, []);

  useEffect(() => {
    const sum = cart.reduce((acc, item) => acc + Number(item.price) * Number(item.quantity), 0);
    setTotal(sum);
  }, [cart]);

  const updateCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem('swiftflow_cart', JSON.stringify(newCart));
  };

  const removeItem = (index: number) => {
    const updated = [...cart];
    const removedItem = updated.splice(index, 1)[0];
    updateCart(updated);
    toast.success(`🗑️ Removed ${removedItem?.name}`);
  };

  const changeQuantity = (index: number, delta: number) => {
    const updated = [...cart];
    const newQuantity = (Number(updated[index].quantity) || 1) + delta;

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

      <button
        onClick={() => router.back()}
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
        <motion.p className="text-gray-200" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          Your cart is empty.
        </motion.p>
      ) : (
        <>
          <div className="space-y-4">
            <AnimatePresence>
              {cart.map((item, index) => (
                <motion.div
                  key={`${item.id}-${item.size}-${index}`}
                  className="flex items-center justify-between border border-white/20 backdrop-blur p-4 rounded-xl bg-white/30 shadow-md"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50, transition: { duration: 0.2 } }}
                >
                  <div className="flex items-center gap-4">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg shadow"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-white/40" />
                    )}
                    <div>
                      <p className="font-bold text-white">
                        {item.name} {item.size ? `(${item.size})` : ''}
                      </p>
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
                      <p className="text-sm text-white/90 mt-1">R{Number(item.price).toFixed(2)} each</p>
                    </div>
                  </div>

                  <button
                    onClick={() => removeItem(index)}
                    className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold text-xs px-4 py-2 rounded-full transition shadow-lg"
                  >
                    ❌ Remove
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
            <p className="text-2xl font-bold text-white mb-4 sm:mb-0">Total: R{total.toFixed(2)}</p>
            <button
              onClick={() => router.push('/swiftflow/checkout')}
              className="bg-gradient-to-r from-yellow-300 to-yellow-500 text-[#121212] font-bold px-6 py-3 rounded-xl hover:brightness-110 transition shadow-lg"
            >
              🚀 Proceed to Checkout
            </button>
          </motion.div>
        </>
      )}
    </div>
  );
}


