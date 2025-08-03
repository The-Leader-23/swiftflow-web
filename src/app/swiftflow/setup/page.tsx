'use client';

import { useState } from 'react';
import { db, storage } from '@/lib/firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast, { Toaster } from 'react-hot-toast';

export default function SetupPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    businessName: '',
    businessType: '',
    bio: '',
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    paymentEmail: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  const handleSubmit = async () => {
    if (!user) return toast.error('You must be logged in.');
    const { businessName, businessType, bio, bankName, accountHolder, accountNumber } = form;

    if (!businessName || !businessType || !bio || !bankName || !accountHolder || !accountNumber) {
      return toast.error('Please complete all required fields.');
    }

    let logoUrl = '';

    try {
      if (logoFile) {
        const storageRef = ref(storage, `logos/${user.uid}`);
        await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(storageRef);
      }

      const businessData = {
        businessName,
        businessType,
        bio,
        logoUrl,
        primaryColor: '#6b7280',
        createdAt: Timestamp.now(),
      };

      const bankDetails = {
        bankName,
        accountHolder,
        accountNumber,
        paymentEmail: form.paymentEmail || '',
      };

      // Save private + public info
      await setDoc(doc(db, 'users', user.uid), {
        ...businessData,
        bankDetails,
        isRegistered: true,
        email: user.email,
        role: 'entrepreneur',
      });

      // Only public-facing info
      await setDoc(doc(db, 'public_users', user.uid), {
        ...businessData,
        email: user.email,
      });

      toast.success('🎉 Business registered!');
      router.push('/swiftflow/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      toast.error('Something went wrong!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fbc2eb] via-[#a6c1ee] to-[#fbc2eb] flex items-center justify-center px-4 py-10 text-gray-900">
      <Toaster />
      <div className="w-full max-w-xl bg-white rounded-2xl p-8 shadow-lg">
        <h1 className="text-3xl font-bold mb-6 text-center">🚀 Setup Your Business</h1>

        <input
          type="text"
          placeholder="Business Name"
          className="w-full mb-3 p-3 border rounded bg-white"
          value={form.businessName}
          onChange={(e) => setForm({ ...form, businessName: e.target.value })}
        />
        <input
          type="text"
          placeholder="Business Type (e.g. Fashion, Food)"
          className="w-full mb-3 p-3 border rounded bg-white"
          value={form.businessType}
          onChange={(e) => setForm({ ...form, businessType: e.target.value })}
        />
        <textarea
          placeholder="Tell us about your store"
          className="w-full mb-3 p-3 border rounded bg-white"
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />

        <hr className="my-6" />

        <h2 className="font-semibold mb-2 text-gray-800">🏦 Bank Details</h2>
        <input
          type="text"
          placeholder="Bank Name"
          className="w-full mb-3 p-3 border rounded bg-white"
          value={form.bankName}
          onChange={(e) => setForm({ ...form, bankName: e.target.value })}
        />
        <input
          type="text"
          placeholder="Account Holder Name"
          className="w-full mb-3 p-3 border rounded bg-white"
          value={form.accountHolder}
          onChange={(e) => setForm({ ...form, accountHolder: e.target.value })}
        />
        <input
          type="text"
          placeholder="Account Number"
          className="w-full mb-3 p-3 border rounded bg-white"
          value={form.accountNumber}
          onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
        />
        <input
          type="email"
          placeholder="Payment Email (optional)"
          className="w-full mb-3 p-3 border rounded bg-white"
          value={form.paymentEmail}
          onChange={(e) => setForm({ ...form, paymentEmail: e.target.value })}
        />

        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setLogoFile(file);
              setPreviewUrl(URL.createObjectURL(file));
            }
          }}
          className="mb-3"
        />

        {previewUrl && (
          <img
            src={previewUrl}
            alt="Preview"
            className="w-28 h-28 rounded-full object-cover mb-3 border mx-auto"
          />
        )}

        <button
          onClick={handleSubmit}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded hover:from-blue-600 hover:to-purple-600 transition font-semibold"
        >
          Register Business
        </button>
      </div>
    </div>
  );
}









