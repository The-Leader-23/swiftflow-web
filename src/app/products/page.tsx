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

type MediaItem = {
  type: 'image' | 'video';
  url: string;
  posterUrl?: string; // for videos
};

type Product = {
  id: string;
  productId: string;
  name: string;
  price: number;
  stock: number;
  category?: string;
  // NEW: canonical media; we still keep imageUrls for backward-compat in UI
  media?: MediaItem[];
  imageUrls?: string[]; // derived from media images or legacy
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

  // Allow up to 3 media items total (images and/or video)
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
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
        const media: MediaItem[] = Array.isArray(data.media) ? data.media : [];

        // Back-compat normalize: compute imageUrls from media (images only) or legacy fields
        const legacyImageUrls = Array.isArray(data.imageUrls)
          ? data.imageUrls
          : (data.imageUrl ? [data.imageUrl] : []);

        const derivedImageUrls =
          media.length > 0
            ? media.filter((m: MediaItem) => m.type === 'image').map((m) => m.url)
            : legacyImageUrls;

        list.push({
          id: d.id,
          productId: data.productId ?? d.id,
          name: data.name,
          price: Number(data.price) || 0,
          stock: Number(data.stock) || 0,
          category: data.category ?? '',
          media,
          imageUrls: derivedImageUrls,
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

  // Helpers for media
  const isVideo = (file: File) => file.type.startsWith('video/');
  const isImage = (file: File) => file.type.startsWith('image/');

  const getVideoDuration = (file: File) =>
    new Promise<number>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        const d = v.duration || 0;
        URL.revokeObjectURL(url);
        resolve(d);
      };
      v.onerror = reject;
      v.src = url;
    });

  // very small client-side poster capture for video
  const makeVideoPoster = async (file: File): Promise<Blob | null> => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      await new Promise<void>((res, rej) => {
        video.onloadeddata = () => res();
        video.onerror = () => rej(new Error('video load error'));
      });
      // grab a frame near the start
      video.currentTime = Math.min(0.15, (video.duration || 0) / 2);

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), 'image/jpeg', 0.82)
      );
      URL.revokeObjectURL(url);
      return blob;
    } catch {
      return null;
    }
  };

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

    if (mediaFiles.length === 0) {
      toast('Tip: add photos or a 5‑sec clip to boost sales 📈', { icon: '🎥' });
    }

    // Cap to 3 items total
    const chosen = mediaFiles.slice(0, 3);

    // Validate: allow only images and at most ONE video (optional)
    const videos = chosen.filter(isVideo);
    if (videos.length > 1) {
      toast.error('Only 1 video allowed per product (max 5 seconds).');
      return;
    }

    // Check duration if there is a video
    if (videos.length === 1) {
      try {
        const dur = await getVideoDuration(videos[0]);
        if (dur > 5.1) {
          toast.error('Video must be 5 seconds or less.');
          return;
        }
      } catch {
        toast.error('Could not read the video file.');
        return;
      }
    }

    setUploading(true);

    // Upload all media, build `media[]` and `imageUrls[]` (images only)
    const media: MediaItem[] = [];
    const imageUrls: string[] = [];

    try {
      for (const f of chosen) {
        const path = `products/${uid}/${Date.now()}_${f.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, f);
        const url = await getDownloadURL(storageRef);

        if (isImage(f)) {
          media.push({ type: 'image', url });
          imageUrls.push(url);
        } else if (isVideo(f)) {
          // optional poster
          let posterUrl: string | undefined = undefined;
          const posterBlob = await makeVideoPoster(f);
          if (posterBlob) {
            const posterRef = ref(storage, `products/${uid}/posters/${Date.now()}_${f.name}.jpg`);
            await uploadBytes(posterRef, posterBlob, { contentType: 'image/jpeg' });
            posterUrl = await getDownloadURL(posterRef);
          }
          media.push({ type: 'video', url, ...(posterUrl ? { posterUrl } : {}) });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Media upload failed. Try smaller files.');
      setUploading(false);
      return;
    }

    try {
      // private
      const privRef = await addDoc(productsCol, {
        name: newProduct.name.trim(),
        price: Number(newProduct.price),
        stock: Number(newProduct.stock),
        category: newProduct.category.trim(),
        media,                 // ✅ canonical
        imageUrls,             // ✅ back-compat (images only)
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
        media,                 // ✅ public mirror
        imageUrls,             // ✅ still mirroring (images only) for legacy
        isVisible: true,
        createdAt: serverTimestamp(),
      });

      setNewProduct({ name: '', price: '', stock: '', category: '' });
      setMediaFiles([]);
      toast.success('Product added with media 🎉');
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

  // Primary thumbnail chooser: image first, else video poster, else nothing
  const primaryThumb = (p: Product): string => {
    const m = p.media || [];
    const img = m.find((x) => x.type === 'image')?.url;
    if (img) return img;
    const vidPoster = m.find((x) => x.type === 'video')?.posterUrl;
    if (vidPoster) return vidPoster;
    // fallback to legacy
    return p.imageUrls?.[0] || '';
  };

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

                  {/* NEW: up to 3 files (images and/or ONE short video) */}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(e) => setMediaFiles(Array.from(e.target.files || []).slice(0, 3))}
                    className="rounded-md px-3 py-2 bg-white/90 text-black outline-none"
                  />

                  {/* Small previews (static) */}
                  {mediaFiles.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {mediaFiles.map((f, i) =>
                        f.type.startsWith('image/') ? (
                          <img key={i} src={URL.createObjectURL(f)} className="h-12 w-12 object-cover rounded border border-white/30" />
                        ) : (
                          <video key={i} src={URL.createObjectURL(f)} className="h-12 w-12 rounded border border-white/30" muted playsInline />
                        )
                      )}
                    </div>
                  )}

                  <button onClick={addProduct} disabled={uploading} className="mt-2 rounded-lg bg-white text-[#2d2d2d] font-semibold py-2 disabled:opacity-70">
                    {uploading ? 'Uploading…' : 'Add'}
                  </button>
                  <p className="text-xs text-white/80">
                    Tip: Add up to 3 items (images and/or one 5‑sec video). We’ll auto‑generate a thumbnail for videos.
                  </p>
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
                    {products.map((p) => {
                      const primaryImg = primaryThumb(p);
                      const hasVideo = (p.media || []).some((m) => m.type === 'video');
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 border border-white/10 p-4">
                          <div className="flex items-center gap-3 min-w-0">
                            {primaryImg ? (
                              <img src={primaryImg} alt={p.name} className="h-12 w-12 rounded-md object-cover border border-white/20" />
                            ) : (
                              <div className="h-12 w-12 rounded-md bg-white/10 border border-white/20 grid place-items-center text-xs text-white/70">No media</div>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{p.name}</div>
                              <div className="text-sm text-white/80">
                                R{p.price.toFixed(2)} • Stock: {p.stock}
                                {p.category ? ` • ${p.category}` : ''}
                                {hasVideo && <span className="ml-2 px-2 py-0.5 text-xs rounded bg-white/20 border border-white/30">🎥</span>}
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
                      );
                    })}
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












