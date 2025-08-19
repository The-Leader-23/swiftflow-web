// app/setup/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import { useAuth } from '@/app/context/AuthContext';
import { db, storage } from '@/lib/firebase.client';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

type BankState = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  paymentEmail: string;
  branchCode: string;
  swiftCode: string;
};

export default function SetupPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — Business
  const [biz, setBiz] = useState({
    businessName: '',
    bio: '',
    logoUrl: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [savingBiz, setSavingBiz] = useState(false);

  // Step 2 — Bank (one-time during registration)
  const [bank, setBank] = useState<BankState>({
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    paymentEmail: '',
    branchCode: '',
    swiftCode: '',
  });
  const [savingBank, setSavingBank] = useState(false);

  // Step 3 — Dashboard stats (preview only)
  const [lowStock, setLowStock] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);

  // Load any existing data to prefill (but bank is edited here only during setup)
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const uid = user.uid;

        // PUBLIC profile (logo, business info)
        const pubRef = doc(db, 'public_users', uid);
        const pubSnap = await getDoc(pubRef);
        if (pubSnap.exists()) {
          const d = pubSnap.data() as any;
          setBiz({
            businessName: d.businessName || '',
            bio: d.bio || '',
            logoUrl: d.logoUrl || '',
          });
          setLogoPreview(d.logoUrl || '');
        }

        // PRIVATE snapshot for bank mirror (prefill if present — still editable here during setup)
        const privateSnap = await getDoc(doc(db, 'users', uid));
        if (privateSnap.exists()) {
          const p = privateSnap.data() as any;
          const b = p.bankDetails || {};
          setBank((prev) => ({
            ...prev,
            bankName: b.bankName || prev.bankName,
            accountHolder: b.accountHolder || prev.accountHolder,
            accountNumber: b.accountNumber || prev.accountNumber,
            paymentEmail: b.paymentEmail || prev.paymentEmail,
            branchCode: b.branchCode || prev.branchCode,
            swiftCode: b.swiftCode || prev.swiftCode,
          }));

          // If user already completed setup, jump to preview
          const hasBusinessInfo = Boolean(p.businessName && p.bio);
          const hasBankInfo = Boolean(
            b.bankName && b.accountHolder && b.accountNumber
          );
          const isRegistered = Boolean(p.isRegistered);
          if (hasBusinessInfo && hasBankInfo && isRegistered) {
            setStep(3);
          } else if (hasBusinessInfo && !hasBankInfo) {
            setStep(2);
          } else {
            setStep(1);
          }
        }

        // Stats (preview)
        const productsSnap = await getDocs(collection(db, 'users', uid, 'products'));
        let lowCount = 0;
        productsSnap.forEach((p) => {
          const stock = Number((p.data() as any).stock || 0);
          if (stock <= 5) lowCount++;
        });
        setLowStock(lowCount);

        const ordersSnap = await getDocs(collection(db, 'users', uid, 'orders'));
        setTotalOrders(ordersSnap.size);

        let revenue = 0;
        ordersSnap.forEach((o) => {
          revenue += Number((o.data() as any).total || (o.data() as any).totalPrice || 0);
        });
        setTotalRevenue(revenue);
      } catch (e) {
        console.error('loadData failed:', e);
      }
    })();
  }, [user]);

  // Save business (public + private)
  const saveBusiness = async () => {
    if (!biz.businessName.trim() || !biz.bio.trim()) {
      toast.error('Please fill Business Name and Short Bio');
      return;
    }
    if (!user?.uid) {
      toast.error('No user — please sign in again');
      return;
    }

    setSavingBiz(true);
    try {
      let uploadedLogoUrl = biz.logoUrl;
      if (logoFile) {
        const logoRef = ref(storage, `logos/${user.uid}`);
        await uploadBytes(logoRef, logoFile);
        uploadedLogoUrl = await getDownloadURL(logoRef);
      }

      // Private
      await setDoc(
        doc(db, 'users', user.uid),
        {
          businessName: biz.businessName.trim(),
          bio: biz.bio.trim(),
          logoUrl: uploadedLogoUrl || '',
          role: 'entrepreneur',
          ownerId: user.uid,
          email: user.email ?? '',
          isVisible: true,
          hasBusinessInfo: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Public mirror
      await setDoc(
        doc(db, 'public_users', user.uid),
        {
          businessName: biz.businessName.trim(),
          bio: biz.bio.trim(),
          logoUrl: uploadedLogoUrl || '',
          isFeatured: false,
          isVisible: true,
          ownerId: user.uid,
          email: user.email ?? '',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      toast.success('Business info saved');
      setStep(2);
    } catch (e) {
      console.error('saveBusiness failed:', e);
      toast.error('Failed to save business info');
    } finally {
      setSavingBiz(false);
    }
  };

  // Save bank ONCE (private + mirror to public)
  const saveBank = async () => {
    if (!bank.bankName.trim() || !bank.accountHolder.trim() || !String(bank.accountNumber).trim()) {
      toast.error('Please fill in required bank fields');
      return;
    }
    if (!user?.uid) {
      toast.error('No user — please sign in again');
      return;
    }

    setSavingBank(true);
    try {
      const uid = user.uid;

      const payload: BankState = {
        bankName: bank.bankName.trim(),
        accountHolder: bank.accountHolder.trim(),
        accountNumber: String(bank.accountNumber).trim(),
        paymentEmail: (bank.paymentEmail || '').trim(),
        branchCode: (bank.branchCode || '').trim(),
        swiftCode: (bank.swiftCode || '').trim(),
      };

      // 1) PRIVATE (owner-only root doc)
      await setDoc(
        doc(db, 'users', uid),
        {
          bankDetails: payload,
          hasBankInfo: true,
          isRegistered: true, // ✅ setup complete after bank
          bankUpdatedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2) PUBLIC mirror (what checkout reads)
      await setDoc(
        doc(db, 'public_users', uid),
        {
          bankDetails: payload,
          hasBankDetails: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      toast.success('Bank details saved');
      setStep(3);
    } catch (e: any) {
      console.error('bank save failed:', e);
      toast.error('Failed to save bank details');
    } finally {
      setSavingBank(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto p-6">
      {/* progress */}
      <div className="flex justify-between mb-6 text-sm font-semibold">
        <span className={step === 1 ? 'text-blue-500' : ''}>1. Business</span>
        <span className={step === 2 ? 'text-blue-500' : ''}>2. Bank</span>
        <span className={step === 3 ? 'text-blue-500' : ''}>3. Done</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      {/* Step 1 — Business */}
      {step === 1 && (
        <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-blue-700 rounded-2xl p-6 shadow text-white">
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
              className="p-3 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Business Name"
              value={biz.businessName}
              onChange={(e) => setBiz({ ...biz, businessName: e.target.value })}
            />
            <textarea
              className="p-3 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Short bio"
              value={biz.bio}
              onChange={(e) => setBiz({ ...biz, bio: e.target.value })}
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

      {/* Step 2 — Bank (one-time) */}
      {step === 2 && (
        <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-blue-700 rounded-2xl p-6 shadow text-white">
          <h1 className="text-2xl font-bold mb-4">🏦 Bank Details</h1>

          <div className="grid md:grid-cols-2 gap-4">
            <input
              className="p-3 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Bank Name"
              value={bank.bankName}
              onChange={(e) => setBank({ ...bank, bankName: e.target.value })}
            />
            <input
              className="p-3 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Account Holder"
              value={bank.accountHolder}
              onChange={(e) => setBank({ ...bank, accountHolder: e.target.value })}
            />
            <input
              className="p-3 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Account Number"
              value={bank.accountNumber}
              onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })}
            />
            <input
              className="p-3 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Payment Email (optional)"
              value={bank.paymentEmail}
              onChange={(e) => setBank({ ...bank, paymentEmail: e.target.value })}
            />
            <input
              className="p-3 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Branch Code (optional)"
              value={bank.branchCode}
              onChange={(e) => setBank({ ...bank, branchCode: e.target.value })}
            />
            <input
              className="p-3 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="SWIFT (optional)"
              value={bank.swiftCode}
              onChange={(e) => setBank({ ...bank, swiftCode: e.target.value })}
            />
          </div>

          <button
            onClick={saveBank}
            disabled={savingBank}
            className="mt-5 px-5 py-2 rounded bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold disabled:opacity-60"
          >
            {savingBank ? 'Saving…' : 'Save & Continue'}
          </button>
        </div>
      )}

      {/* Step 3 — Done (preview) */}
      {step === 3 && (
        <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-blue-700 rounded-2xl p-6 shadow text-white">
          <h1 className="text-2xl font-bold mb-4">✅ All Set</h1>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded bg-white/10 border border-white/20">
              <h2 className="text-lg font-semibold">Low Stock</h2>
              <p className="text-3xl font-bold">{lowStock}</p>
            </div>
            <div className="p-4 rounded bg-white/10 border border-white/20">
              <h2 className="text-lg font-semibold">Orders</h2>
              <p className="text-3xl font-bold">{totalOrders}</p>
            </div>
            <div className="p-4 rounded bg-white/10 border border-white/20">
              <h2 className="text-lg font-semibold">Revenue</h2>
              <p className="text-3xl font-bold">R{totalRevenue}</p>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => router.push('/swiftflow/dashboard')}
              className="px-5 py-2 rounded bg-white text-gray-900 font-semibold"
            >
              Go to Entrepreneur Dashboard
            </button>
            <button
              onClick={() => router.push('/products')}
              className="px-5 py-2 rounded bg-white/10 border border-white/20 font-semibold"
            >
              Manage Stock & Orders
            </button>
          </div>
        </div>
      )}
    </main>
  );
}














