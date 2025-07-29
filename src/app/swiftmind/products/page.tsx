'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { db, storage } from '@/lib/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { useRouter } from 'next/navigation';

export default function ProductUploadPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    price: '',
    stock: '',
    sizes: '',
    isVisible: true,
  });

  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'products'),
      (snap) => {
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setProducts(list);
      }
    );
    return () => unsub();
  }, [user]);

  const handleImageChange = (e: any) => {
    const file = e.target.files[0];
    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!user || !form.name || !form.price || !image) return;

    const storageRef = ref(storage, `products/${user.uid}/${image.name}`);
    await uploadBytes(storageRef, image);
    const imageUrl = await getDownloadURL(storageRef);

    const productData = {
      ...form,
      price: Number(form.price),
      stock: Number(form.stock),
      createdAt: serverTimestamp(),
      imageUrl,
    };

    // Upload to private user products
    const docRef = await addDoc(
      collection(db, 'users', user.uid, 'products'),
      productData
    );

    // Upload to public products
    await setDoc(doc(db, 'public_products', docRef.id), {
      ...productData,
      ownerId: user.uid,
      isVisible: form.isVisible,
    });

    // Sync public store if not present
    const userDocRef = doc(db, 'public_users', user.uid);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      const userDataDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDataDoc.exists() ? userDataDoc.data() : {};

      await setDoc(userDocRef, {
        businessName: userData?.businessName || 'My Store',
        businessType: userData?.businessType || 'Other',
        logoUrl: userData?.logoUrl || '',
        primaryColor: userData?.primaryColor || '#000000',
        bio: userData?.bio || '',
        isFeatured: false,
        createdAt: serverTimestamp(),
      });
    }

    setForm({ name: '', price: '', stock: '', sizes: '', isVisible: true });
    setImage(null);
    setPreviewUrl('');
    alert('✅ Product uploaded and made public!');
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'products', id));
    await deleteDoc(doc(db, 'public_products', id));
  };

  const handleToggleVisibility = async (id: string, current: boolean) => {
    if (!user) return;
    await updateDoc(doc(db, 'public_products', id), {
      isVisible: !current,
    });
  };

  const handleEdit = async (id: string, field: string, value: any) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'products', id), {
      [field]: value,
    });
    await updateDoc(doc(db, 'public_products', id), {
      [field]: value,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#1e2a44] to-[#0f172a] p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-white">📦 Upload New Product</h1>

        <form onSubmit={handleSubmit} className="space-y-4 text-white">
          <input
            type="text"
            placeholder="Product name"
            className="w-full border px-4 py-2 rounded bg-black text-white"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            type="number"
            placeholder="Price"
            className="w-full border px-4 py-2 rounded bg-black text-white"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <input
            type="number"
            placeholder="Stock"
            className="w-full border px-4 py-2 rounded bg-black text-white"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
          />
          <input
            type="text"
            placeholder="Sizes (optional)"
            className="w-full border px-4 py-2 rounded bg-black text-white"
            value={form.sizes}
            onChange={(e) => setForm({ ...form, sizes: e.target.value })}
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isVisible}
              onChange={(e) => setForm({ ...form, isVisible: e.target.checked })}
            />
            Make product public on SwiftFlow
          </label>

          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="text-white"
          />

          {previewUrl && (
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-48 object-contain mt-2 rounded border"
            />
          )}

          <button
            type="submit"
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
          >
            Upload Product
          </button>
        </form>

        {products.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-semibold mb-4 text-white">🧾 Your Products</h2>
            <div className="space-y-4">
              {products.map((prod) => {
                const isLowStock = prod.stock <= 3;

                return (
                  <div
                    key={prod.id}
                    className={`flex gap-4 items-start p-4 rounded-2xl shadow-md hover:shadow-lg transition ${
                      isLowStock
                        ? 'bg-[#2a1e1e] border border-red-600'
                        : 'bg-[#1e1e1e] border border-gray-700'
                    }`}
                  >
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className="w-24 h-24 object-cover rounded-xl border border-gray-600"
                    />
                    <div className="flex-1 text-white">
                      <input
                        type="text"
                        className="font-medium text-sm bg-transparent border border-gray-600 px-3 py-2 w-full mb-1 rounded placeholder-gray-400 text-white"
                        value={prod.name}
                        onChange={(e) =>
                          handleEdit(prod.id, 'name', e.target.value)
                        }
                      />
                      <div className="flex gap-3 mb-2">
                        <input
                          type="number"
                          className="text-sm bg-transparent border border-gray-600 px-3 py-2 rounded placeholder-gray-400 text-white"
                          value={prod.price}
                          onChange={(e) =>
                            handleEdit(prod.id, 'price', Number(e.target.value))
                          }
                        />
                        <input
                          type="number"
                          className="text-sm bg-transparent border border-gray-600 px-3 py-2 rounded placeholder-gray-400 text-white"
                          value={prod.stock}
                          onChange={(e) =>
                            handleEdit(prod.id, 'stock', Number(e.target.value))
                          }
                        />
                      </div>

                      {prod.sizes && (
                        <p className="text-sm text-gray-400 italic">
                          Sizes: {prod.sizes}
                        </p>
                      )}

                      {isLowStock && (
                        <p className="text-sm text-red-500 mt-1">⚠️ Low stock</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => handleDelete(prod.id)}
                        className="text-red-500 hover:underline text-sm"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() =>
                          handleToggleVisibility(prod.id, prod.isVisible)
                        }
                        className="text-blue-400 hover:underline text-sm"
                      >
                        {prod.isVisible ? 'Hide from SwiftFlow' : 'Make Public'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}




