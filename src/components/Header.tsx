'use client';

import React from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Menu, LogOut } from 'lucide-react';
import { usePathname } from 'next/navigation';

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const getPageTitle = () => {
    if (pathname === '/') return 'Dashboard Overview';
    if (pathname.startsWith('/students/')) return 'Student Profile';
    if (pathname.startsWith('/students')) return 'Student Directory';
    if (pathname.startsWith('/sessions/')) return 'Session Details';
    if (pathname.startsWith('/sessions')) return 'Training Sessions';
    if (pathname.startsWith('/feedback')) return 'Feedback Logs';
    return 'CampusPlace';
  };

  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-slate-100 shadow-sm shadow-slate-100/40">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="p-2 -ml-2 rounded-lg lg:hidden hover:bg-slate-50 text-slate-600"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold tracking-tight text-slate-800">
          {getPageTitle()}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {session && (
          <div className="flex items-center gap-4">
            <span className="hidden text-sm font-medium text-slate-600 sm:inline-block">
              Welcome, <span className="text-slate-800 font-semibold">{session.user?.name || 'Admin'}</span>
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
