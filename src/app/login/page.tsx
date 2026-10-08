'use client';

import React, { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Lock, Mail, AlertCircle, Key } from 'lucide-react';

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await signIn('credentials', {
        email: email.trim(),
        password: password,
        redirect: false,
      });

      if (res?.error) {
        setError('Invalid admin email or password.');
        setLoading(false);
      } else {
        router.replace('/');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4">
      <div className="flex items-center gap-3 mb-8">
        <GraduationCap className="h-10 w-10 text-blue-600" />
        <span className="text-3xl font-extrabold tracking-tight text-slate-900">
          Campus<span className="text-blue-600">Place</span>
        </span>
      </div>

      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">Admin Portal</h2>
          <p className="text-sm text-slate-500 mt-1">Sign in to manage sessions and placement logs</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3.5 mb-5 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail className="h-5 w-5" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pratikravan0430@gmail.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-sm transition-all animate-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="h-5 w-5" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-sm transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 hover:shadow-lg disabled:opacity-50 text-sm flex items-center justify-center cursor-pointer"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
            <div className="flex items-center gap-2 mb-2 text-slate-800">
              <Key className="h-4 w-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Demo Access</h3>
            </div>
            <div className="text-sm text-slate-600 space-y-1">
              <p>Email: <span className="font-medium text-slate-800 select-all">pratikravan0430@gmail.com</span></p>
              <p>Password: <span className="font-medium text-slate-800 select-all">Pratik@930</span></p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setEmail('pratikravan0430@gmail.com');
              setPassword('Pratik@930');
            }}
            className="w-full py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 font-bold rounded-xl transition-all text-sm border border-blue-100 cursor-pointer flex items-center justify-center gap-2"
          >
            Autofill Demo Credentials
          </button>
        </div>
      </div>
    </div>
  );
}
