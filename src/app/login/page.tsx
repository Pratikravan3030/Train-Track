'use client';

import React, { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, AlertCircle, Building2 } from 'lucide-react';
import { COLLEGE_CONFIG } from '@/config/collegeConfig';
import { CollegeLogo } from '@/components/ui/CollegeLogo';
import { Button } from '@/components/ui/Button';

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
        setError(res.error.includes('locked') ? res.error : 'Invalid email or password. Please verify credentials.');
        setLoading(false);
      } else {
        router.replace('/');
      }
    } catch {
      setError('An unexpected network error occurred. Please try again.');
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 px-4 py-12 select-none">
      {/* College Identity Header */}
      <div className="flex flex-col items-center text-center mb-8 max-w-md">
        <div className="mb-3">
          <CollegeLogo size="lg" />
        </div>
        <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 leading-snug">
          {COLLEGE_CONFIG.institution.name}
        </h1>
        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 font-medium">
          <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span>Kasaba Bawada, Kolhapur</span>
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold">
          <span>{COLLEGE_CONFIG.tpCell.name}</span>
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100">
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-slate-900">Sign In to T&P Portal</h2>
          <p className="text-xs text-slate-500 mt-1">
            Access officer, coordinator, or student dashboard
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 mb-5 text-xs text-red-700 bg-red-50 rounded-xl border border-red-100 animate-in fade-in duration-150"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Institutional Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                <Mail className="h-4 w-4" />
              </span>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="coordinator@dypcet.ac.in"
                autoComplete="email"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-xs transition-all text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
                <Lock className="h-4 w-4" />
              </span>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-xs transition-all text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>

          <Button
            type="submit"
            loading={loading}
            variant="primary"
            size="lg"
            className="w-full mt-2 font-bold"
          >
            Sign In to Account
          </Button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-600">
            For access credentials or account unlock, contact the Training & Placement Cell.
          </p>
        </div>
      </div>
    </div>
  );
}
