// app/products/page.tsx
'use client';

import { useEffect, useMemo, useState, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '@/app/context/AuthContext';
import { db, storage } from '@/lib/firebase.client';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

type TabKey = 'products' | 'orders';

type Product = {
  id: string;
  productId: string;
  name: string;
  price: number;
  stock: number;
  category?: string;
  imageUrl?: string;
  isVisible?: boolean;
  createdAt?: any;
};

type Order = {
  id: string;
  customerName: string;
  phone?: string;
  total: number;
  status?: string;
  proofUrl?: string;
  createdAt?: any;
};

const gradientBox =
  'rounded-2xl p-6 md:p-8 shadow-xl bg-gradient-to-br from-[#2d5bff] via-[#6a5ae0] to-[#a855f7] text-white';
const glassCard =
  'rounded-xl bg-white/10 backdrop-blur-md border border-white/15';

export default function ProductsManagerPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [active, setActive] = useState<TabKey>('products');

  // PRODUCTS
  const [products, setProducts] = useState<Product[]>([]);
  const [pLoading, setPLoading] = useState(true);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    stock: '',
    category: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // ORDERS
  const [orders, setOrders] = useState<Order[]>([]);
  const [oLoading, setOLoading] = useState(true);

  const uid = user?.uid;

  useEffect(() => {
    if (!authLoading && !uid) router.push('/swiftflow');
  }, [authLoading, uid, router]);

  const productsCol = useMemo(
    () => (uid ? collection(db, 'users', uid, 'products') : null),
    [uid]
  );
  const ordersCol = useMemo(
    () => (uid ? collection(db, 'users', uid, 'orders') : null),
    [uid]
  );

  // Load products
  useEffect(() => {
    if (!productsCol) return;
    const unsub = onSnapshot(productsCol, (snap) => {
      const list: Product[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: d.id,
          productId: data.productId ?? d.id,
          name: data.name,
          price: Number(data.price) || 0,
          stock: Number(data.stock) || 0,
          category: data.category ?? '',
          imageUrl: data.imageUrl ?? '',
          isVisible: data.isVisible ?? true,
          createdAt: data.createdAt,
        });
      });
      list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setProducts(list);
      setPLoading(false);
    });
    return () => unsub();
  }, [productsCol]);

  // Load orders
  useEffect(() => {
    if (!ordersCol) return;
    const unsub = onSnapshot(ordersCol, (snap) => {
      const list: Order[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: d.id,
          customerName: data.customerName ?? '',
          phone: data.phone ?? '',
          total: Number(data.total) || Number(data.totalPrice || 0),
          status: data.status,
          proofUrl: data.proofUrl ?? '',
          createdAt: data.createdAt || data.timestamp,
        });
      });
      list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setOrders(list);
      setOLoading(false);
    });
    return () => unsub();
  }, [ordersCol]);

  // Actions: PRODUCTS
  const handlePChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewProduct((s) => ({ ...s, [name]: value }));
  };

  const addProduct = async () => {
    if (!productsCol || !uid) return;
    if (!newProduct.name || !newProduct.price || !newProduct.stock) {
      toast.error('Please fill name, price and stock');
      return;
    }

    setUploading(true);
    let imageUrl = '';

    if (imageFile) {
      try {
        const storageRef = ref(storage, `products/${uid}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      } catch (err) {
        console.error(err);
        toast.error('Image upload failed. Try a smaller JPG/PNG.');
        setUploading(false);
        return;
      }
    }

    try {
      // private
      const privRef = await addDoc(productsCol, {
        name: newProduct.name.trim(),
        price: Number(newProduct.price),
        stock: Number(newProduct.stock),
        category: newProduct.category.trim(),
        imageUrl,
        isVisible: true,
        ownerId: uid,
        createdAt: serverTimestamp(),
      });

      // write productId + mirror to public
      await setDoc(doc(db, 'users', uid, 'products', privRef.id), { productId: privRef.id }, { merge: true });

      await setDoc(doc(db, 'public_products', privRef.id), {
        productId: privRef.id,
        ownerId: uid,
        name: newProduct.name.trim(),
        price: Number(newProduct.price),
        stock: Number(newProduct.stock),
        category: newProduct.category.trim(),
        imageUrl,
        isVisible: true,
        createdAt: serverTimestamp(),
      });

      setNewProduct({ name: '', price: '', stock: '', category: '' });
      setImageFile(null);
      toast.success('Product added');
    } catch (e) {
      console.error(e);
      toast.error('Failed to add product');
    } finally {
      setUploading(false);
    }
  };

  const updateStock = async (id: string, delta: number) => {
    if (!uid) return;
    try {
      const refDoc = doc(db, 'users', uid, 'products', id);
      const snap = await getDoc(refDoc);
      const cur = Number(snap.data()?.stock ?? 0);
      const next = Math.max(0, cur + delta);

      await updateDoc(refDoc, { stock: next });

      const productId = (snap.data() as any)?.productId || id;
      await updateDoc(doc(db, 'public_products', productId), {
        stock: next,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      toast.error('Could not update stock');
    }
  };

  const removeProduct = async (id: string) => {
    if (!uid) return;
    try {
      const privSnap = await getDoc(doc(db, 'users', uid, 'products', id));
      const productId = (privSnap.data() as any)?.productId || id;

      await deleteDoc(doc(db, 'users', uid, 'products', id));
      await deleteDoc(doc(db, 'public_products', productId));
      toast.success('Removed');
    } catch (e) {
      console.error(e);
      toast.error('Delete failed');
    }
  };

  // Actions: ORDERS
  const markPaid = async (id: string, paid: boolean) => {
    if (!uid) return;
    try {
      await updateDoc(doc(db, 'users', uid, 'orders', id), {
        status: paid ? 'Paid' : 'Waiting for Payment',
      });
      toast.success(paid ? 'Marked as Paid' : 'Marked as Waiting');
    } catch (e) {
      console.error(e);
      toast.error('Update failed');
    }
  };

  const normalizeStatus = (s?: string) => {
    if (!s) return '—';
    if (s.toLowerCase() === 'paid') return 'Paid';
    if (s.toLowerCase().startsWith('waiting')) return 'Waiting for Payment';
    return s;
  };
  const pillClass = (s?: string) =>
    normalizeStatus(s) === 'Paid'
      ? 'bg-emerald-500/90 text-white'
      : 'bg-yellow-400/90 text-black';

  return (
    <div className="min-h-screen w-full px-4 md:px-8 py-8 bg-gradient-to-br from-pink-200 via-blue-200 to-pink-200">
      <Toaster />
      <div className={`${gradientBox} mx-auto max-w-6xl`}>
        {/* Header: back button + tabs */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/swiftflow/dashboard')}
              className="px-3 py-2 rounded-md border border-white/30 bg-white/10 hover:bg-white/20"
            >
              ← Back to Entrepreneur Dashboard
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold">Manage Stock & Orders</h1>
              <p className="text-white/80 mt-1">Keep everything consistent inside one clean gradient container.</p>
            </div>
          </div>

          <div className="flex gap-2">
            {(['products', 'orders'] as TabKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setActive(k)}
                className={`px-4 py-2 rounded-full border transition ${
                  active === k
                    ? 'bg-white text-[#2d2d2d] font-semibold border-white'
                    : 'bg-white/10 text-white hover:bg-white/20 border-white/20'
                }`}
              >
                {k === 'products' ? 'Products' : 'Orders'}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* PRODUCTS TAB */}
          {active === 'products' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Add Product */}
              <div className={`${glassCard} p-5 lg:col-span-1`}>
                <h2 className="text-lg font-semibold mb-4">Add Product</h2>
                <div className="grid grid-cols-1 gap-3">
                  <input className="rounded-md px-3 py-2 bg-white/90 text-black outline-none" placeholder="Name" name="name" value={newProduct.name} onChange={handlePChange} />
                  <input className="rounded-md px-3 py-2 bg-white/90 text-black outline-none" placeholder="Price" name="price" type="number" min="0" value={newProduct.price} onChange={handlePChange} />
                  <input className="rounded-md px-3 py-2 bg-white/90 text-black outline-none" placeholder="Stock" name="stock" type="number" min="0" value={newProduct.stock} onChange={handlePChange} />
                  <input className="rounded-md px-3 py-2 bg-white/90 text-black outline-none" placeholder="Category (optional)" name="category" value={newProduct.category} onChange={handlePChange} />
                  <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="rounded-md px-3 py-2 bg-white/90 text-black outline-none" />
                  <button onClick={addProduct} disabled={uploading} className="mt-2 rounded-lg bg-white text-[#2d2d2d] font-semibold py-2 disabled:opacity-70">
                    {uploading ? 'Uploading…' : 'Add'}
                  </button>
                </div>
              </div>

              {/* List */}
              <div className={`${glassCard} p-5 lg:col-span-2`}>
                <h2 className="text-lg font-semibold mb-4">All Products</h2>

                {pLoading ? (
                  <p className="text-white/80">Loading…</p>
                ) : products.length === 0 ? (
                  <p className="text-white/80">No products yet.</p>
                ) : (
                  <div className="space-y-3">
                    {products.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 border border-white/10 p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="h-12 w-12 rounded-md object-cover border border-white/20" />
                          ) : (
                            <div className="h-12 w-12 rounded-md bg-white/10 border border-white/20 grid place-items-center text-xs text-white/70">No img</div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{p.name}</div>
                            <div className="text-sm text-white/80">
                              R{p.price.toFixed(2)} • Stock: {p.stock}
                              {p.category ? ` • ${p.category}` : ''}
                            </div>
                            <div className="text-xs text-white/60 truncate">ID: {p.productId || p.id}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => updateStock(p.id, 1)} className="px-3 py-1 rounded-md bg-white text-[#2d2d2d] font-medium">
                            +1
                          </button>
                          <button onClick={() => updateStock(p.id, -1)} className="px-3 py-1 rounded-md bg-white/20 border border-white/30">
                            −1
                          </button>
                          <button onClick={() => removeProduct(p.id)} className="px-3 py-1 rounded-md bg-red-500/90 hover:bg-red-500 text-white">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ORDERS TAB */}
          {active === 'orders' && (
            <div className={`${glassCard} p-5`}>
              <h2 className="text-lg font-semibold mb-4">Orders</h2>

              {oLoading ? (
                <p className="text-white/80">Loading…</p>
              ) : orders.length === 0 ? (
                <p className="text-white/80">No orders yet.</p>
              ) : (
                <div className="space-y-3">
                  {orders.map((o) => {
                    const isPaid = normalizeStatus(o.status) === 'Paid';
                    return (
                      <div key={o.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-lg bg-white/5 border border-white/10 p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {o.proofUrl ? (
                            <a href={o.proofUrl} target="_blank" rel="noreferrer">
                              <img src={o.proofUrl} alt="Proof" className="h-12 w-12 rounded object-cover border border-white/20" />
                            </a>
                          ) : (
                            <div className="h-12 w-12 rounded bg-white/10 border border-white/20 grid place-items-center text-xs text-white/70">—</div>
                          )}

                          <div className="min-w-0">
                            <div className="font-semibold truncate">{o.customerName || 'Customer'}</div>
                            <div className="text-sm text-white/80">
                              Total: R{Number(o.total).toFixed(2)} • Status:{' '}
                              <span className={`px-2 py-0.5 rounded ${pillClass(o.status)}`}>{normalizeStatus(o.status)}</span>
                              {o.proofUrl ? ' • Proof uploaded' : ''}
                            </div>
                            {o.proofUrl && (
                              <a href={o.proofUrl} target="_blank" rel="noreferrer" className="text-sm underline text-white">
                                View proof
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {!isPaid ? (
                            <button onClick={() => markPaid(o.id, true)} className="px-3 py-1 rounded-md bg-white text-[#2d2d2d] font-medium">
                              Mark Paid
                            </button>
                          ) : (
                            <button onClick={() => markPaid(o.id, false)} className="px-3 py-1 rounded-md bg-white/20 border border-white/30">
                              Mark Waiting
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}









