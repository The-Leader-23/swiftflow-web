'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase.client';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';

type PublicProduct = {
  id: string;
  name: string;
  price: number | string;
  stock?: number;
  // ✅ New multi-image support
  imageUrls?: string[];
  // legacy fallback if old docs still have this
  imageUrl?: string;
  ownerId: string;
  isVisible?: boolean;
};

export default function StorefrontPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSizeFor, setSelectedSizeFor] = useState<Record<string, string>>({});
  const [cartCount, setCartCount] = useState<number>(0);

  // track current image index per product
  const [imgIndexFor, setImgIndexFor] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        // store header
        const userRef = doc(db, 'public_users', id);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) setStoreInfo(userSnap.data());

        // products for this store
        const productQuery = query(collection(db, 'public_products'), where('ownerId', '==', id));
        const productSnap = await getDocs(productQuery);
        const items = productSnap.docs.map((d) => {
          const data = d.data() as any;
          // ✅ Normalize images: prefer imageUrls, else wrap legacy imageUrl
          const imageUrls: string[] =
            Array.isArray(data.imageUrls) && data.imageUrls.length > 0
              ? data.imageUrls.slice(0, 2) // we only ever show up to 2
              : (data.imageUrl ? [data.imageUrl] : []);
          return {
            id: d.id,
            name: data.name,
            price: data.price,
            stock: data.stock,
            imageUrls,
            ownerId: data.ownerId,
            isVisible: data.isVisible,
          } as PublicProduct;
        }) as any[];

        setProducts(items.filter((p) => p.isVisible !== false));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // persistent cart bar
  const recomputeCartCount = () => {
    try {
      const cart: any[] = JSON.parse(localStorage.getItem('swiftflow_cart') || '[]');
      setCartCount(cart.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0));
    } catch {
      setCartCount(0);
    }
  };
  useEffect(() => {
    recomputeCartCount();
    const onStorage = (e: StorageEvent) => e.key === 'swiftflow_cart' && recomputeCartCount();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const currentImg = (p: PublicProduct) => {
    const idx = imgIndexFor[p.id] ?? 0;
    const arr = p.imageUrls && p.imageUrls.length > 0 ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : []);
    return arr[Math.min(idx, Math.max(0, arr.length - 1))] || '';
  };

  const cycleImage = (p: PublicProduct) => {
    const arr = p.imageUrls && p.imageUrls.length > 0 ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : []);
    if (arr.length <= 1) return;
    setImgIndexFor((m) => {
      const next = ((m[p.id] ?? 0) + 1) % arr.length;
      return { ...m, [p.id]: next };
    });
  };

  const setImageAt = (p: PublicProduct, index: number) => {
    const arr = p.imageUrls && p.imageUrls.length > 0 ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : []);
    if (index < 0 || index >= arr.length) return;
    setImgIndexFor((m) => ({ ...m, [p.id]: index }));
  };

  const addToCart = (product: PublicProduct) => {
    const size = selectedSizeFor[product.id] || '';
    if (!size) return toast.error('Please select a size first.');
    if ((Number(product.stock ?? 0)) <= 0) return toast.error('⛔ Out of stock.');

    const imageForCart =
      (product.imageUrls && product.imageUrls[0]) ||
      product.imageUrl ||
      '';

    const existing: any[] = JSON.parse(localStorage.getItem('swiftflow_cart') || '[]');
    const item = {
      id: product.id,
      productId: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      quantity: 1,
      imageUrl: imageForCart,
      size,
      storeId: id,
    };

    if (existing.length > 0 && existing[0].storeId !== id) {
      toast('Cart had another store. Starting a fresh cart for this store.', { icon: '🧹' });
      localStorage.setItem('swiftflow_cart', JSON.stringify([item]));
      recomputeCartCount();
      toast.success('🛒 Added to cart');
      return;
    }

    const already = existing.find((it) => it.id === product.id && (it.size || '') === size);
    const updated = already
      ? existing.map((it) =>
          it.id === product.id && (it.size || '') === size
            ? { ...it, quantity: (Number(it.quantity) || 1) + 1 }
            : it
        )
      : [...existing, item];

    localStorage.setItem('swiftflow_cart', JSON.stringify(updated));
    recomputeCartCount();
    toast.success('🛒 Added to cart');
  };

  return (
    // ✅ Same soft gradient background, applied to root
    <div className="min-h-screen relative overflow-hidden text-gray-900 bg-gradient-to-br from-[#fbc2eb] via-[#a6c1ee] to-[#fbc2eb]">
      <Toaster />

      {/* Persistent Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur border-b border-white/50 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between">
            <p className="text-sm font-medium">
              ✅ You have <span className="font-bold">{cartCount}</span> item{cartCount > 1 ? 's' : ''} in your cart
            </p>
            <button
              onClick={() => router.push('/swiftflow/cart')}
              className="text-sm font-semibold underline underline-offset-4 hover:no-underline"
            >
              🛒 Go to Cart
            </button>
          </div>
        </div>
      )}

      <div className={`max-w-7xl mx-auto px-6 ${cartCount > 0 ? 'pt-16' : 'pt-10'} pb-10`}>
        <button
          onClick={() => router.back()}
          className="mb-6 text-sm text-white/90 underline hover:text-white transition"
        >
          ← Back to SwiftFlow
        </button>

        {/* Store Header */}
        <div className="rounded-2xl p-6 mb-10 flex flex-col md:flex-row items-center md:items-start gap-6 bg-white/85 backdrop-blur border border-white/60 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white bg-gray-100 shadow-inner">
            {storeInfo?.logoUrl ? (
              <img src={storeInfo.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No Logo</div>
            )}
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-1">{storeInfo?.businessName}</h1>
            <p className="text-sm text-blue-700">{storeInfo?.businessType}</p>
            <p className="text-sm text-gray-700 mt-2 max-w-xl">
              {storeInfo?.bio || 'This store has no description yet.'}
            </p>
          </div>
        </div>

        {/* Products */}
        {loading ? (
          <p className="text-white font-medium">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="text-white/90">No public products yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => {
              const outOfStock = Number(product.stock ?? 0) <= 0;
              const size = (selectedSizeFor as any)[product.id] || '';
              const images = product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls : (product.imageUrl ? [product.imageUrl] : []);
              const idx = imgIndexFor[product.id] ?? 0;

              return (
                <motion.div
                  key={product.id}
                  whileHover={{ scale: 1.03 }}
                  className="bg-white/90 backdrop-blur border border-white/70 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
                >
                  <div className="relative">
                    {images.length > 0 ? (
                      <img
                        src={currentImg(product)}
                        alt={product.name}
                        className="w-full h-64 object-contain bg-white p-4 cursor-pointer"
                        onClick={() => cycleImage(product)}
                        title={images.length > 1 ? 'Click to view next image' : undefined}
                      />
                    ) : (
                      <div className="w-full h-64 bg-gray-100" />
                    )}

                    {/* badges */}
                    {outOfStock ? (
                      <div className="absolute top-2 right-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                        Out of stock
                      </div>
                    ) : (
                      <div className="absolute top-2 right-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        🛒 Tap to add
                      </div>
                    )}

                    {/* thumbnails */}
                    {images.length > 1 && (
                      <div className="absolute bottom-2 right-2 flex gap-2">
                        {images.slice(0, 2).map((url, i) => (
                          <button
                            key={i}
                            onClick={(e) => {
                              e.stopPropagation();
                              setImageAt(product, i);
                            }}
                            className={`h-12 w-12 rounded border ${
                              i === idx ? 'border-blue-500' : 'border-gray-200'
                            } overflow-hidden bg-white`}
                            title={`View image ${i + 1}`}
                          >
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <h2 className="text-lg font-semibold mb-1">{product.name}</h2>
                    <p className="text-sm text-blue-700">Price: R{Number(product.price || 0).toFixed(2)}</p>
                    <p className="text-sm text-gray-700">
                      Stock: {product.stock ?? 0}
                      {Number(product.stock) > 0 && Number(product.stock) <= 5 && (
                        <span className="ml-2 text-xs text-amber-700 font-medium">Low</span>
                      )}
                    </p>

                    <select
                      className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm bg-white"
                      onChange={(e) => setSelectedSizeFor((m) => ({ ...m, [product.id]: e.target.value }))}
                      value={size}
                    >
                      <option value="" disabled>Select Size</option>
                      <option value="S">Small</option>
                      <option value="M">Medium</option>
                      <option value="L">Large</option>
                      <option value="XL">Extra Large</option>
                    </select>

                    <button
                      onClick={() => addToCart(product)}
                      disabled={outOfStock || !size}
                      className={`mt-3 w-full text-white py-2 rounded-lg transition shadow-md ${
                        outOfStock || !size
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
                      }`}
                    >
                      {outOfStock ? 'Unavailable' : '➕ Add to Cart'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

