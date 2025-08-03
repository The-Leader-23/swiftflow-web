'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createUserProfile } from '@/lib/createUserProfile';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'entrepreneur'>('customer');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signup' | 'login'>('signup');

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (mode === 'signup') {
        // Try to sign up
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCred.user;
        await createUserProfile(user.uid, user.email || '', role);
        router.push('/role-redirect');
      } else {
        // Try to log in
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        console.log('Logged in:', userCred.user.email);
        router.push('/role-redirect');
      }
    } catch (err: any) {
      if (mode === 'signup' && err.code === 'auth/email-already-in-use') {
        alert('Account already exists. Switch to login mode.');
        setMode('login');
      } else {
        alert(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fbc2eb] via-[#a6c1ee] to-[#fbc2eb] text-gray-800 px-4">
      <div className="w-full max-w-sm bg-white/80 backdrop-blur-md rounded-2xl p-8 shadow-lg border border-white space-y-6">
        <h1 className="text-3xl font-bold text-center text-gray-900">
          {mode === 'signup' ? '✨ Create Account' : '🔐 Login'}
        </h1>

        <input
          type="email"
          placeholder="Email"
          className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {mode === 'signup' && (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'customer' | 'entrepreneur')}
            className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="customer">🛍️ Customer</option>
            <option value="entrepreneur">📈 Entrepreneur</option>
          </select>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold hover:opacity-90 transition"
        >
          {loading ? (mode === 'signup' ? 'Creating Account...' : 'Logging In...') : (mode === 'signup' ? 'Sign Up' : 'Log In')}
        </button>

        <div className="text-center text-sm">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <button className="text-blue-600 underline" onClick={() => setMode('login')}>
                Log in
              </button>
            </>
          ) : (
            <>
              Don’t have an account?{' '}
              <button className="text-purple-600 underline" onClick={() => setMode('signup')}>
                Sign up
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


{/* SwiftFlow is live 🚀 */}
