'use client';

import { useEffect, useState } from 'react';
import { db, storage } from '@/lib/firebase.client';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';

export default function CheckoutPage() {
  const [cart, setCart] = useState<any[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState('');

  const router = useRouter();

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('swiftflow_cart') || '[]');
    setCart(stored);
    if (stored.length > 0 && stored[0].storeId) {
      setStoreId(stored[0].storeId);
    }
  }, []);

  useEffect(() => {
    if (!storeId) return;

    const fetchBankDetails = async () => {
      try {
        const refDoc = doc(db, 'users', storeId);
        const snap = await getDoc(refDoc);
        if (snap.exists()) {
          setBankDetails(snap.data()?.bankDetails || null);
        }
      } catch (err) {
        console.error('Failed to fetch bank details:', err);
      }
    };

    fetchBankDetails();
  }, [storeId]);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleInAppCheckout = async () => {
    if (!customer.name || !customer.phone || !cart.length || !storeId) {
      toast.error('Please fill in all details and ensure cart is not empty.');
      return;
    }

    setLoading(true);

    try {
      const docRef = await addDoc(collection(db, 'users', storeId, 'orders'), {
        customerName: customer.name,
        customerPhone: customer.phone,
        cartItems: cart,
        total,
        isPaidPending: true,
        createdAt: serverTimestamp(),
      });

      setOrderId(docRef.id);
      setSuccess(true);
      localStorage.removeItem('swiftflow_cart');
      setCart([]);
    } catch (err) {
      console.error('Order failed:', err);
      toast.error('Failed to place order.');
    } finally {
      setLoading(false);
    }
  };

  const handleProofUpload = async () => {
    if (!proofFile || !orderId || !storeId) return;

    const fileRef = ref(storage, `proofs/${storeId}/${orderId}/proof.jpg`);
    setUploading(true);

    try {
      await uploadBytes(fileRef, proofFile);
      const url = await getDownloadURL(fileRef);
      setProofUrl(url);

      await updateDoc(doc(db, 'users', storeId, 'orders', orderId), {
        proofUrl: url,
        isProofUploaded: true,
      });

      toast.success('✅ Payment proof uploaded!');
    } catch (err) {
      toast.error('Failed to upload.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-gradient-to-b from-[#f1fbc2eb] via-[#a6c1ee] to-[#f1fbc2eb] min-h-screen rounded-xl shadow-xl">
      <Toaster />
      <motion.h1
        className="text-4xl font-extrabold text-white drop-shadow mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        🧾 Checkout
      </motion.h1>

      {cart.length === 0 && !success ? (
        <p className="text-white/80">Your cart is empty.</p>
      ) : success ? (
        <>
          {/* 🎉 Order Confirmation */}
          <motion.div
            className="bg-green-600/80 text-white p-5 rounded-xl shadow mb-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            🎉 Your order was placed successfully!
            <br />
            <span className="text-sm block mt-1">Please complete payment below to confirm it.</span>
          </motion.div>

          {/* 💳 Bank Details */}
          {bankDetails && (
            <motion.div
              className="bg-white/80 p-4 rounded-xl shadow mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <h2 className="text-lg font-bold text-gray-800 mb-2">💳 Bank Transfer Instructions</h2>
              <p className="text-sm text-gray-700"><strong>Bank:</strong> {bankDetails.bankName}</p>
              <p className="text-sm text-gray-700"><strong>Account Holder:</strong> {bankDetails.accountHolder}</p>

              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-gray-700"><strong>Account Number:</strong> {bankDetails.accountNumber}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(bankDetails.accountNumber);
                    toast.success('✅ Account number copied!');
                  }}
                  className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200 transition"
                >
                  📋 Copy
                </button>
              </div>

              <p className="text-sm text-gray-700 mt-2">
                <strong>Reference:</strong> <span className="text-blue-800 font-medium">{customer.name || 'Your Name'}</span>
              </p>

              <div className="mt-4 text-sm text-gray-700 leading-relaxed">
                ✅ <strong>Use your name as the reference</strong> so we can match your order.<br />
                📸 After payment, upload proof below or send via WhatsApp/email.<br />
                📩 Email: <strong>{bankDetails.paymentEmail || 'payments@swiftflow.africa'}</strong>
              </div>
            </motion.div>
          )}

          {/* 🖼 Upload Proof Section */}
          <motion.div
            className="bg-white/90 p-4 rounded-xl shadow mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <h2 className="text-lg font-bold text-gray-800 mb-3">📤 Upload Payment Proof</h2>

            {proofUrl ? (
              <img src={proofUrl} alt="Proof" className="w-full max-w-sm rounded shadow" />
            ) : (
              <>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  className="block mb-3"
                />
                <button
                  disabled={!proofFile || uploading}
                  onClick={handleProofUpload}
                  className="bg-gradient-to-r from-green-500 to-green-700 text-white px-4 py-2 rounded-xl hover:brightness-110 transition disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : '✅ Upload Proof'}
                </button>
              </>
            )}
          </motion.div>
        </>
      ) : (
        <>
          {/* 🛍 Order Summary */}
          <motion.div className="space-y-4 mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            {cart.map((item, index) => (
              <div key={index} className="flex justify-between border border-white/20 p-2 rounded-xl bg-white/30 text-white">
                <span>{item.name} x{item.quantity}</span>
                <span>R{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="text-right font-bold text-xl text-white">
              Total: R{total.toFixed(2)}
            </div>
          </motion.div>

          {/* 👤 Customer Details */}
          <motion.div className="space-y-4 mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <input
              type="text"
              placeholder="Your Name"
              className="w-full bg-white/90 rounded-xl px-4 py-3 text-black placeholder-gray-500"
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            />
            <input
              type="tel"
              placeholder="Phone Number"
              className="w-full bg-white/90 rounded-xl px-4 py-3 text-black placeholder-gray-500"
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            />
          </motion.div>

          {/* 📲 Actions */}
          <motion.div className="flex flex-col sm:flex-row gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <button
              onClick={() => {
                const message = `Hi! I'd like to place an order:\n\n${cart
                  .map((item) => `- ${item.name} x${item.quantity} (R${item.price})`)
                  .join('\n')}\n\nTotal: R${total}\n\nName: ${customer.name}\nPhone: ${customer.phone}`;
                const encoded = encodeURIComponent(message);
                window.open(`https://wa.me/?text=${encoded}`, '_blank');
              }}
              className="w-full bg-green-600 text-white px-4 py-3 rounded-xl hover:bg-green-700 transition shadow"
            >
              📲 Checkout via WhatsApp
            </button>
            <button
              onClick={handleInAppCheckout}
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-300 to-yellow-500 text-[#121212] font-semibold px-4 py-3 rounded-xl hover:brightness-105 transition shadow"
            >
              {loading ? 'Sending Order...' : '🧾 Place Order (Manual Payment)'}
            </button>
          </motion.div>
        </>
      )}
    </div>
  );
}

