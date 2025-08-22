// app/swiftflow/dashboard/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { db, storage } from '@/lib/firebase.client';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast, { Toaster } from 'react-hot-toast';

type Biz = {
  businessName: string;
  bio: string;
  logoUrl: string;
  primaryColor?: string;
};

type Bank = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  paymentEmail?: string;
};

const LOW_STOCK_THRESHOLD = 3;
const PRODUCTS_PATH = '/products';
const STOREFRONT_PATH = '/swiftflow';

export default function DashboardWizard() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // --------- UI classes ---------
  const cardClass =
    'bg-gradient-to-br from-gray-900 via-blue-900 to-blue-700 rounded-2xl p-6 shadow text-white';
  const inputClass =
    'p-3 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400';
  const chipClass = 'p-4 rounded bg-white/10 border border-white/20';

  // --------- Step 1: Business ---------
  const [biz, setBiz] = useState<Biz>({
    businessName: '',
    bio: '',
    logoUrl: '',
    primaryColor: '#6b7280',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoPreview = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : ''),
    [logoFile]
  );
  const [savingBiz, setSavingBiz] = useState(false);

  // --------- Step 2: Bank ---------
  const [bank, setBank] = useState<Bank>({
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    paymentEmail: '',
  });
  const [savingBank, setSavingBank] = useState(false);

  // --------- Step 3: Live stats ---------
  const [todayOrders, setTodayOrders] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [lowStock, setLowStock] = useState<
    Array<{ id: string; name: string; stock: number }>
  >([]);

  // Load profile & decide step
  useEffect(() => {
    const run = async () => {
      if (!user) return;
      const snap = await getDoc(doc(db, 'users', user.uid));
      const data = snap.exists() ? (snap.data() as any) : {};

      const hasBusinessInfo = Boolean(data.businessName && data.bio);
      const hasBankInfo = Boolean(
        data.bankDetails?.bankName &&
          data.bankDetails?.accountHolder &&
          data.bankDetails?.accountNumber
      );
      const isRegistered = Boolean(data.isRegistered);

      // Prefill forms
      setBiz({
        businessName: data.businessName ?? '',
        bio: data.bio ?? '',
        logoUrl: data.logoUrl ?? '',
        primaryColor: data.primaryColor ?? '#6b7280',
      });

      const bd = data.bankDetails ?? {};
      setBank({
        bankName: bd.bankName ?? '',
        accountHolder: bd.accountHolder ?? '',
        accountNumber: bd.accountNumber ?? '',
        paymentEmail: bd.paymentEmail ?? '',
      });

      if (hasBusinessInfo && hasBankInfo && isRegistered) setStep(3);
      else if (hasBusinessInfo && !hasBankInfo) setStep(2);
      else setStep(1);

      setLoading(false);
    };
    if (user) run();
  }, [user, db]);

  // Live stats for Step 3
  useEffect(() => {
    if (!user || step !== 3) return;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startTs = Timestamp.fromDate(start);

    // Orders
    const ordersRef = collection(db, 'users', user.uid, 'orders');
    const ordersQ = query(
      ordersRef,
      where('createdAt', '>=', startTs),
      orderBy('createdAt', 'desc')
    );

    const unsubOrders = onSnapshot(ordersQ, (snap) => {
      let count = 0;
      let revenue = 0;
      snap.forEach((d) => {
        const o = d.data() as any;
        count += 1;
        if (o.status === 'Paid') revenue += Number(o.total ?? o.totalPrice ?? 0);
      });
      setTodayOrders(count);
      setTodayRevenue(revenue);
    });

    // Low stock
    const productsRef = collection(db, 'users', user.uid, 'products');
    const unsubProducts = onSnapshot(productsRef, (snap) => {
      const lows: Array<{ id: string; name: string; stock: number }> = [];
      snap.forEach((d) => {
        const p = d.data() as any;
        const stockNum = Number(p.stock ?? 0);
        if (stockNum <= LOW_STOCK_THRESHOLD) {
          lows.push({ id: d.id, name: p.name || 'Unnamed', stock: stockNum });
        }
      });
      lows.sort((a, b) => a.stock - b.stock);
      setLowStock(lows);
    });

    return () => {
      unsubOrders();
      unsubProducts();
    };
  }, [user, step, db]);

  // Save business
  const saveBusiness = async () => {
    if (!user) return;
    if (!biz.businessName || !biz.bio) {
      return toast.error('Please complete Business Name & Short Bio.');
    }

    setSavingBiz(true);
    try {
      let logoUrl = biz.logoUrl;

      if (logoFile) {
        // ✅ foldered path to satisfy: match /logos/{userId}/{filePath=**}
        const filename =
          logoFile.name && logoFile.name.trim().length > 0 ? logoFile.name : 'logo.jpg';
        const storageRef = ref(storage, `logos/${user.uid}/${filename}`);
        await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(storageRef);
      }

      const payload = {
        businessName: biz.businessName,
        bio: biz.bio,
        logoUrl,
        primaryColor: biz.primaryColor || '#6b7280',
        updatedAt: serverTimestamp(),
        role: 'entrepreneur',
        ownerId: user.uid,
        email: user.email ?? '',
        isVisible: true,
        hasBusinessInfo: true,
      };

      await setDoc(doc(db, 'users', user.uid), payload, { merge: true });

      await setDoc(
        doc(db, 'public_users', user.uid),
        {
          businessName: payload.businessName,
          bio: payload.bio,
          logoUrl: payload.logoUrl,
          primaryColor: payload.primaryColor,
          ownerId: user.uid,
          email: payload.email,
          isVisible: true,
          isFeatured: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setBiz((b) => ({ ...b, logoUrl }));
      setLogoFile(null);
      toast.success('Business info saved ✅');
      setStep(2);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save business info.');
    } finally {
      setSavingBiz(false);
    }
  };

  // Save bank
  const saveBank = async () => {
    if (!user) return;
    if (!bank.bankName || !bank.accountHolder || !bank.accountNumber) {
      return toast.error('Please fill all required bank fields.');
    }
    setSavingBank(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        bankDetails: {
          bankName: bank.bankName,
          accountHolder: bank.accountHolder,
          accountNumber: bank.accountNumber,
          paymentEmail: bank.paymentEmail || '',
        },
        updatedAt: serverTimestamp(),
        hasBankInfo: true,
        isRegistered: true,
      });

      toast.success('Bank details saved ✅');
      setStep(3);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save bank details.');
    } finally {
      setSavingBank(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Toaster />
        <p className="text-gray-600">Please sign in…</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Toaster />
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fbc2eb] via-[#a6c1ee] to-[#fbc2eb] px-4 py-10">
      <Toaster />
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Progress */}
        <div className="bg-white rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between text-sm font-medium">
            <div className={step >= 1 ? 'text-black' : 'text-gray-400'}>1. Business</div>
            <div className={step >= 2 ? 'text-black' : 'text-gray-400'}>2. Bank</div>
            <div className={step >= 3 ? 'text-black' : 'text-gray-400'}>3. Dashboard</div>
          </div>
          <div className="mt-3 h-2 w-full bg-gray-100 rounded">
            <div
              className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded"
              style={{ width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' }}
            />
          </div>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className={cardClass}>
            <h1 className="text-2xl font-bold mb-4">🏪 Business Info</h1>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-20 h-20 rounded-full overflow-hidden border border-white/30">
                <img
                  src={logoPreview || biz.logoUrl || '/placeholder.svg'}
                  alt="logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <label className="text-sm">
                <span className="block font-medium">Change Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="text-white"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className="grid gap-4">
              <input
                className={inputClass}
                placeholder="Business Name"
                value={biz.businessName}
                onChange={(e) => setBiz({ ...biz, businessName: e.target.value })}
                maxLength={60}
              />
              <textarea
                className={`${inputClass}`}
                placeholder="Short bio"
                value={biz.bio}
                onChange={(e) => setBiz({ ...biz, bio: e.target.value })}
                maxLength={280}
              />
            </div>

            <button
              onClick={saveBusiness}
              disabled={savingBiz}
              className="mt-5 px-5 py-2 rounded bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold disabled:opacity-60"
            >
              {savingBiz ? 'Saving…' : 'Save & Continue'}
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className={cardClass}>
            <h1 className="text-2xl font-bold mb-4">🏦 Bank Details</h1>

            <div className="grid md:grid-cols-2 gap-4">
              <input
                className={inputClass}
                placeholder="Bank Name"
                value={bank.bankName}
                onChange={(e) => setBank({ ...bank, bankName: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Account Holder"
                value={bank.accountHolder}
                onChange={(e) => setBank({ ...bank, accountHolder: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Account Number"
                value={bank.accountNumber}
                onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Payment Email (optional)"
                type="email"
                value={bank.paymentEmail}
                onChange={(e) => setBank({ ...bank, paymentEmail: e.target.value })}
              />
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-2 rounded border border-white/20 bg-white/10 font-semibold"
              >
                Back
              </button>
              <button
                onClick={saveBank}
                disabled={savingBank}
                className="px-5 py-2 rounded bg-white text-gray-900 font-semibold disabled:opacity-60"
              >
                {savingBank ? 'Saving…' : 'Save & Finish'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className={cardClass}>
            <h1 className="text-2xl font-bold">Entrepreneur Dashboard</h1>
            <p className="text-white/80 mb-4">
              You’re all set. Manage products & orders.
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              <div className={chipClass}>
                <p className="text-sm text-white/70">Orders Today</p>
                <p className="text-3xl font-extrabold">{todayOrders}</p>
              </div>
              <div className={chipClass}>
                <p className="text-sm text-white/70">Paid Revenue Today</p>
                <p className="text-3xl font-extrabold">R{todayRevenue.toFixed(2)}</p>
              </div>
              <div className={chipClass}>
                <p className="text-sm text-white/70">
                  Low Stock (≤ {LOW_STOCK_THRESHOLD})
                </p>
                {lowStock.length === 0 ? (
                  <p className="text-lg font-semibold mt-1">All good ✅</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {lowStock.slice(0, 5).map((p) => (
                      <li key={p.id} className="text-sm flex justify-between">
                        <span className="truncate">{p.name}</span>
                        <span className="font-semibold">x{p.stock}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={PRODUCTS_PATH}
                className="px-4 py-2 rounded bg-white text-gray-900 font-medium hover:opacity-90"
                onClick={(e) => {
                  e.preventDefault();
                  router.push(PRODUCTS_PATH);
                }}
              >
                Manage Products & Orders
              </Link>
              <Link
                href={STOREFRONT_PATH}
                className="px-4 py-2 rounded bg-white text-gray-900 font-medium hover:opacity-90"
              >
                View Public Storefront
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}







