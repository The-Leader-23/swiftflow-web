'use client';

import { useEffect, useState } from 'react';
import { db, storage } from '@/lib/firebase.client';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  setDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { getApp } from 'firebase/app';

type BankDetails =
  | string
  | {
      bankName?: string;
      accountHolder?: string;
      accountNumber?: string;
      paymentEmail?: string;
      branchCode?: string;
      swiftCode?: string;
      [k: string]: any;
    };

type CartItem = {
  id: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  size?: string | null;
  storeId: string;
};

export default function CheckoutPage() {
  console.log('🔥 Firebase project:', getApp().options.projectId);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: '', phone: '' });

  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState('');

  const router = useRouter();

  // Load cart + single-store guard
  useEffect(() => {
    const stored: CartItem[] = JSON.parse(localStorage.getItem('swiftflow_cart') || '[]');

    const normalized = (stored || []).map((it) => ({
      ...it,
      productId: it.productId ?? it.id,
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1,
    })) as CartItem[];

    if (normalized.length === 0) {
      setCart([]);
      setStoreId(null);
      return;
    }

    const sId = normalized[0].storeId;
    const mixed = normalized.some((x) => x.storeId !== sId);

    if (mixed) {
      toast.error('Cart had items from multiple stores. We reset it to avoid confusion.');
      localStorage.removeItem('swiftflow_cart');
      setCart([]);
      setStoreId(null);
      return;
    }

    setCart(normalized);
    setStoreId(sId);
  }, []);

  // Fetch bank details (public) with fallbacks
  useEffect(() => {
    if (!storeId) return;
    (async () => {
      try {
        console.log('🧭 Fetching bank for storeId =', storeId);

        // 1) Primary: public_users/{storeId}
        const publicDocRef = doc(db, 'public_users', storeId);
        const publicSnap = await getDoc(publicDocRef);

        if (publicSnap.exists()) {
          const data = publicSnap.data();
          const bd =
            (data?.bankDetails as BankDetails) ??
            (data?.bank as BankDetails) ??
            (data?.bankInfo as BankDetails) ??
            null;
          if (bd) {
            setBankDetails(bd);
            return;
          }
        }

        // 2) Fallback by ownerId
        const qSnap = await getDocs(
          query(collection(db, 'public_users'), where('ownerId', '==', storeId), limit(1))
        );
        if (!qSnap.empty) {
          const data = qSnap.docs[0].data();
          const bd =
            (data?.bankDetails as BankDetails) ??
            (data?.bank as BankDetails) ??
            (data?.bankInfo as BankDetails) ??
            null;
          if (bd) {
            setBankDetails(bd);
            return;
          }
        }

        // 3) Final fallback: private settings doc → normalize to public shape
        const settingsSnap = await getDoc(doc(db, 'users', storeId, 'settings', 'bank'));
        if (settingsSnap.exists()) {
          const d = settingsSnap.data() as any;
          const normalized: BankDetails = {
            bankName: d.bankName || '',
            accountHolder: d.accountName || '', // map UI field → expected key
            accountNumber: d.accountNumber || '',
            branchCode: d.branchCode || '',
            paymentEmail: d.paymentEmail || '',
            swiftCode: d.swiftCode || '',
          };
          // If at least one field exists, use it
          if (
            normalized.bankName ||
            normalized.accountHolder ||
            normalized.accountNumber ||
            normalized.branchCode ||
            normalized.paymentEmail ||
            normalized.swiftCode
          ) {
            setBankDetails(normalized);
            return;
          }
        }

        setBankDetails(null);
      } catch (err) {
        console.error('Failed to fetch bank details:', err);
        setBankDetails(null);
      }
    })();
  }, [storeId]);

  // After success, re-fetch (in case owner added details late)
  useEffect(() => {
    if (success && storeId) {
      const t = setTimeout(async () => {
        const ref_ = doc(db, 'public_users', storeId);
        const snap_ = await getDoc(ref_);
        const data_ = snap_.exists() ? snap_.data() : null;
        const bd_ =
          (data_?.bankDetails as BankDetails) ??
          (data_?.bank as BankDetails) ??
          (data_?.bankInfo as BankDetails) ??
          null;

        if (!bd_) {
          const qSnap = await getDocs(
            query(collection(db, 'public_users'), where('ownerId', '==', storeId), limit(1))
          );
          if (!qSnap.empty) {
            const d = qSnap.docs[0].data();
            const bd2 =
              (d?.bankDetails as BankDetails) ??
              (d?.bank as BankDetails) ??
              (d?.bankInfo as BankDetails) ??
              null;
            setBankDetails(bd2);
            return;
          }
        }

        setBankDetails(bd_);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [success, storeId]);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleInAppCheckout = async () => {
    if (!customer.name.trim() || !customer.phone.trim()) {
      toast.error('Please enter your name and phone.');
      return;
    }
    if (!cart.length || !storeId) {
      toast.error('Your cart is empty.');
      return;
    }

    setLoading(true);
    try {
      const items = cart.map((it) => ({
        productId: it.productId ?? it.id,
        name: it.name,
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 0,
        size: it.size || null,
      }));

      const orderRef = await addDoc(collection(db, 'users', storeId, 'orders'), {
        customerName: customer.name.trim(),
        customerPhone: customer.phone.trim(),
        items,
        total,
        status: 'Waiting for Payment',
        isPaidPending: true,
        createdAt: serverTimestamp(),
      });

      setOrderId(orderRef.id);
      setSuccess(true);
      localStorage.removeItem('swiftflow_cart');
      setCart([]);
    } catch (err: any) {
      console.error('Order failed:', err?.code, err?.message, err);
      toast.error(
        err?.code === 'permission-denied'
          ? 'Permissions blocked by Firestore rules'
          : 'Failed to place order.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Upload proof: upload image to Storage, then attach proofUrl (+flags) to the order
  const handleProofUpload = async () => {
    if (!proofFile || !orderId || !storeId) return;

    const fileRef = ref(storage, `proofs/${storeId}/${orderId}/proof.jpg`);
    setUploading(true);

    try {
      await uploadBytes(fileRef, proofFile);
      const url = await getDownloadURL(fileRef);
      setProofUrl(url);

      const orderRef = doc(db, 'users', storeId, 'orders', orderId);

      // Only proof fields — Firestore rules allow this for public users
      await setDoc(
        orderRef,
        {
          proofUrl: url,
          isProofUploaded: true,
          proofUploadedAt: serverTimestamp(),
        },
        { merge: true }
      );

      toast.success('✅ Payment proof uploaded!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload.');
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
        <div className="text-white/90">
          <p>Your cart is empty.</p>
          <button
            onClick={() => router.back()}
            className="mt-4 bg-white text-black px-4 py-2 rounded-xl hover:brightness-95 transition"
          >
            ← Back
          </button>
        </div>
      ) : success ? (
        <>
          <motion.div
            className="bg-green-600/80 text-white p-5 rounded-xl shadow mb-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            🎉 Your order was placed successfully!
            <span className="text-sm block mt-1">Please complete payment below to confirm it.</span>
          </motion.div>

          <motion.div className="bg-white/80 p-4 rounded-xl shadow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-lg font-bold text-gray-800 mb-2">💳 Bank Transfer Instructions</h2>

            {bankDetails ? (
              typeof bankDetails === 'string' ? (
                <p className="whitespace-pre-wrap text-sm text-gray-700">{bankDetails}</p>
              ) : (
                <>
                  {bankDetails.bankName && (
                    <p className="text-sm text-gray-700">
                      <strong>Bank:</strong> {bankDetails.bankName}
                    </p>
                  )}
                  {bankDetails.accountHolder && (
                    <p className="text-sm text-gray-700">
                      <strong>Account Holder:</strong> {bankDetails.accountHolder}
                    </p>
                  )}
                  {bankDetails.accountNumber && (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-gray-700">
                        <strong>Account Number:</strong> {bankDetails.accountNumber}
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(String(bankDetails.accountNumber));
                          toast.success('✅ Account number copied!');
                        }}
                        className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200 transition"
                      >
                        📋 Copy
                      </button>
                    </div>
                  )}
                  {bankDetails.branchCode && (
                    <p className="text-sm text-gray-700">
                      <strong>Branch Code:</strong> {bankDetails.branchCode}
                    </p>
                  )}
                  {bankDetails.swiftCode && (
                    <p className="text-sm text-gray-700">
                      <strong>SWIFT:</strong> {bankDetails.swiftCode}
                    </p>
                  )}
                  <p className="text-sm text-gray-700 mt-2">
                    <strong>Reference:</strong>{' '}
                    <span className="text-blue-800 font-medium">{customer.name || 'Your Name'}</span>
                  </p>
                  <div className="mt-3 text-sm text-gray-700 leading-relaxed">
                    ✅ <strong>Use your name as the reference</strong> so we can match your order.
                    <br />
                    📩 Email: <strong>{(bankDetails as any).paymentEmail || 'payments@swiftflow.africa'}</strong>
                    <br />
                    📸 After payment, upload proof below.
                  </div>
                </>
              )
            ) : (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                Bank details for this store aren’t available yet. Please contact the store or try
                again shortly.
              </div>
            )}
          </motion.div>

          <motion.div className="bg-white/90 p-4 rounded-xl shadow mt-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-lg font-bold text-gray-800 mb-3">📤 Upload Payment Proof</h2>

            {proofUrl ? (
              <img src={proofUrl} alt="Proof" className="w-full max-w-sm rounded shadow" />
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2">
                  Accepted: images under 5MB (PNG/JPEG). Use your bank app’s export/screenshot.
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  className="block w-full border border-gray-300 rounded px-3 py-2 bg-white text-black mb-3"
                />
                <button
                  disabled={!proofFile || uploading}
                  onClick={handleProofUpload}
                  className="bg-gradient-to-r from-green-500 to-green-700 text-white px-4 py-2 rounded-xl hover:brightness-110 transition disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : '✅ Upload Proof'}
                </button>
              </>
            )}
          </motion.div>
        </>
      ) : (
        <>
          <motion.div className="space-y-4 mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            {cart.map((item, index) => (
              <div
                key={`${item.id}-${item.size}-${index}`}
                className="flex justify-between border border-white/20 p-2 rounded-xl bg-white/30 text-white"
              >
                <span>
                  {item.name} {item.size ? `(${item.size})` : ''} x{item.quantity}
                </span>
                <span>R{(Number(item.price) * Number(item.quantity)).toFixed(2)}</span>
              </div>
            ))}
            <div className="text-right font-bold text-xl text-white">Total: R{total.toFixed(2)}</div>
          </motion.div>

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

          <motion.div className="flex flex-col sm:flex-row gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <button
              onClick={() => router.back()}
              className="w-full bg-white text-black px-4 py-3 rounded-xl hover:brightness-95 transition shadow"
            >
              ← Back
            </button>
            <button
              onClick={handleInAppCheckout}
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-300 to-yellow-500 text-[#121212] font-semibold px-4 py-3 rounded-xl hover:brightness-105 transition shadow disabled:opacity-60"
            >
              {loading ? 'Sending Order...' : '🧾 Place Order (Manual Payment)'}
            </button>
          </motion.div>
        </>
      )}
    </div>
  );
}





