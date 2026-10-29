import Link from 'next/link';
import { Home, AlertTriangle, ArrowLeft } from 'lucide-react';
import { COLLEGE_CONFIG } from '@/config/collegeConfig';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-12 text-center select-none">
      <div className="h-16 w-16 bg-amber-50 rounded-2xl flex items-center justify-center border border-amber-200 text-amber-600 mb-6 shadow-xs">
        <AlertTriangle className="h-8 w-8" />
      </div>

      <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
        404 - Page Not Found
      </h1>
      <p className="mt-3 text-sm text-slate-500 max-w-md leading-relaxed">
        The requested resource, campus drive, or roster could not be found on the{' '}
        <span className="font-semibold text-slate-700">{COLLEGE_CONFIG.institution.shortName}</span> portal. It may have been relocated, archived, or restricted.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          <Home className="h-4 w-4" />
          Dashboard Home
        </Link>
        <Link
          href="/students"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Student Directory
        </Link>
      </div>
    </div>
  );
}
