'use client';

import { useState } from 'react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { auth, db, storage } from '@/lib/firebase';
import {
  FaRocket,
  FaMapMarkerAlt,
  FaClock,
  FaPaintBrush,
  FaImage,
  FaStore,
} from 'react-icons/fa';

export default function BusinessSetupPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [zones, setZones] = useState('');
  const [time, setTime] = useState('');
  const [color, setColor] = useState('#000000');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      alert('You must be logged in to register a business.');
      return;
    }

    setIsLoading(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      const publicRef = doc(db, 'public_users', user.uid);
      let logoUrl = '';

      if (logoFile) {
        if (logoFile.size > 5 * 1024 * 1024) {
          alert('Logo too large. Please upload a file under 5MB.');
          setIsLoading(false);
          return;
        }

        try {
          console.log('📤 Uploading logo...');
          const logoRef = ref(storage, `logos/${user.uid}`);
          await uploadBytes(logoRef, logoFile);
          logoUrl = await getDownloadURL(logoRef);
          console.log('✅ Upload successful. URL:', logoUrl);
        } catch (err) {
          console.error('❌ Logo upload failed:', err);
          alert('Logo upload failed. Your business will still be registered.');
          logoUrl = '';
        }
      }

      const data = {
        businessName: name,
        bio: description,
        deliveryZones: zones.split(',').map((z) => z.trim()),
        deliveryTime: time,
        primaryColor: color,
        logoUrl: logoUrl,
        isRegistered: true,
        createdAt: new Date(),
      };

      await setDoc(userRef, data, { merge: true });
      await setDoc(publicRef, data, { merge: true });

      await new Promise((res) => setTimeout(res, 1000));
      router.push('/swiftmind/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      alert('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-100 via-purple-100 to-blue-100 px-4 py-12">
      <div className="bg-white/80 backdrop-blur-md shadow-xl rounded-2xl max-w-xl w-full p-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6 flex items-center justify-center gap-2">
          <FaRocket className="text-orange-500" /> Set Up Your Business
        </h1>

        {/* Brand Name */}
        <div className="mb-5">
          <label className="block text-sm font-semibold mb-1 flex items-center gap-2 text-gray-700">
            <FaStore /> Brand Name
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-black"
            placeholder="e.g. NW, Busi’s Kitchen, Teko Footwear"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Category / Description */}
        <div className="mb-5">
          <label className="block text-sm font-semibold mb-1 flex items-center gap-2 text-gray-700">
            <FaPaintBrush /> Category / Services
          </label>
          <textarea
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-black"
            placeholder="e.g. Clothes, Food Delivery, Car Wash, Art etc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Delivery Zones */}
        <div className="mb-5">
          <label className="block text-sm font-semibold mb-1 flex items-center gap-2 text-gray-700">
            <FaMapMarkerAlt /> Delivery Zones
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-black"
            placeholder="e.g. Joburg, Randfontein"
            value={zones}
            onChange={(e) => setZones(e.target.value)}
          />
        </div>

        {/* Delivery Time */}
        <div className="mb-5">
          <label className="block text-sm font-semibold mb-1 flex items-center gap-2 text-gray-700">
            <FaClock /> Delivery Time
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-black"
            placeholder="e.g. 1–2 days"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        {/* Brand Color */}
        <div className="mb-5">
          <label className="block text-sm font-semibold mb-1 flex items-center gap-2 text-gray-700">
            <FaPaintBrush /> Brand Color
          </label>
          <input
            type="color"
            className="w-full rounded-lg px-2 py-1"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>

        {/* Upload Logo */}
        <div className="mb-5">
          <label className="block text-sm font-semibold mb-1 flex items-center gap-2 text-gray-700">
            <FaImage /> Upload Logo (Optional)
          </label>
          <input
            type="file"
            accept="image/*"
            className="w-full text-black"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
          />

          {/* ✅ Preview */}
          {logoFile && (
            <img
              src={URL.createObjectURL(logoFile)}
              alt="Preview"
              className="mt-2 w-24 h-24 object-cover rounded border"
            />
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className={`w-full ${
            isLoading ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'
          } text-white font-semibold py-2 rounded-lg mt-2`}
        >
          {isLoading ? '⏳ Registering...' : '✅ Register My Business'}
        </button>
      </div>
    </div>
  );
}






