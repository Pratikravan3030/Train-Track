'use client';

import React, { useEffect } from 'react';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App Runtime Error]:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-12 text-center select-none">
      <div className="h-16 w-16 bg-red-50 rounded-2xl flex items-center justify-center border border-red-200 text-red-600 mb-6 shadow-xs">
        <AlertOctagon className="h-8 w-8" />
      </div>

      <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
        Something Went Wrong
      </h1>
      <p className="mt-3 text-sm text-slate-500 max-w-md leading-relaxed">
        An unexpected application error was caught by the institutional error boundary. Your session data remains safe.
      </p>

      {error.message && (
        <div className="mt-4 p-3 max-w-lg bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 text-left overflow-x-auto">
          {error.message}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary" size="md" onClick={() => reset()} className="text-xs font-bold">
          <RotateCcw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors"
        >
          <Home className="h-4 w-4" />
          Dashboard Home
        </Link>
      </div>
    </div>
  );
}
