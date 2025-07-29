'use client';

import { ReactNode } from 'react';
import Link from 'next/link';

export default function SwiftMindLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 p-4 flex flex-col space-y-4">
        <h2 className="text-2xl font-bold mb-6">SwiftMind 🧠</h2>
        <Link href="/swiftmind/dashboard" className="hover:underline">Dashboard</Link>
        <Link href="/swiftmind/orders" className="hover:underline">Orders</Link>
        <Link href="/swiftmind/products" className="hover:underline">Products</Link>
        <Link href="/swiftmind/insights" className="hover:underline">Insights</Link>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top navbar */}
        <header className="h-16 bg-gray-950 shadow-md px-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Welcome, CEO</h1>
          <div className="text-sm text-gray-400">v1.0 Beta</div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
