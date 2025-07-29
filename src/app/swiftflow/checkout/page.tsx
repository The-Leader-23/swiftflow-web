'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function CheckoutPage() {
  const [cart, setCart] = useState<any[]>([]);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('swiftflow_cart') || '[]');
    setCart(stored);
  }, []);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const storeId = cart[0]?.storeId;

  const sendWhatsAppMessage = () => {
    const message = `Hi! I'd like to place an order:\n\n${cart
      .map((item) => `- ${item.name} x${item.quantity} (R${item.price})`)
      .join('\n')}\n\nTotal: R${total}\n\nName: ${customer.name}\nPhone: ${customer.phone}`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleInAppCheckout = async () => {
    if (!customer.name || !customer.phone || !storeId) return;
    setLoading(true);

    try {
      await addDoc(collection(db, 'users', storeId, 'orders'), {
        customerName: customer.name,
        customerPhone: customer.phone,
        cartItems: cart,
        total,
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
      localStorage.removeItem('swiftflow_cart');
      setCart([]);
    } catch (err) {
      console.error('Order failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const recommended = cart.length > 0 ? cart.slice(0, 2) : [];

  return (
    <div className="max-w-3xl mx-auto p-6">
      <motion.h1
        className="text-3xl font-bold mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        🧾 Checkout
      </motion.h1>

      {cart.length === 0 ? (
        <p className="text-gray-500">Your cart is empty.</p>
      ) : success ? (
        <motion.div
          className="bg-green-100 text-green-800 p-4 rounded"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          🎉 Order sent successfully!
          <button
            className="block mt-4 text-blue-600 underline"
            onClick={() => router.push('/')}
          >
            Back to home
          </button>
        </motion.div>
      ) : (
        <>
          <motion.div
            className="space-y-4 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {cart.map((item, index) => (
              <div key={index} className="flex justify-between border p-2 rounded bg-white">
                <span>{item.name} x{item.quantity}</span>
                <span>R{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="text-right font-bold text-lg">
              Total: R{total.toFixed(2)}
            </div>
          </motion.div>

          <motion.div
            className="space-y-4 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <input
              type="text"
              placeholder="Your Name"
              className="w-full border rounded px-4 py-2"
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            />
            <input
              type="tel"
              placeholder="Phone Number"
              className="w-full border rounded px-4 py-2"
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            />
          </motion.div>

          <motion.div
            className="flex flex-col sm:flex-row gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <button
              onClick={sendWhatsAppMessage}
              className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
            >
              📲 Checkout via WhatsApp
            </button>
            <button
              onClick={handleInAppCheckout}
              disabled={loading}
              className="w-full bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition"
            >
              {loading ? 'Sending Order...' : '🧾 Checkout via App'}
            </button>
          </motion.div>

          {recommended.length > 0 && (
            <motion.div
              className="mt-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <h2 className="text-xl font-semibold mb-3">🛍️ You might also like:</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recommended.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 border rounded bg-white shadow"
                  >
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-600">R{item.price}</p>
                    <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
