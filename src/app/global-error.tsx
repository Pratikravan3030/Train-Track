'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Fatal Error]:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 font-sans p-6 text-center">
        <div className="h-16 w-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mb-6">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">Fatal Portal Error</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-md">
          A critical error occurred while rendering the portal layout. Please reload or contact the D.Y. Patil T&P cell.
        </p>
        <button
          onClick={() => reset()}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" />
          Reload Application
        </button>
      </body>
    </html>
  );
}
