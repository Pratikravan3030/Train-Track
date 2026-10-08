'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import { Breadcrumbs } from './ui/Breadcrumbs';
import { ForceChangePasswordModal } from './ForceChangePasswordModal';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <main className="flex-1 min-h-screen bg-slate-50">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/60 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Container */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Header Section */}
        <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

        {/* Scrollable Page Body */}
        <div className="flex-1 overflow-y-auto flex flex-col justify-between">
          <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex-1">
            <Breadcrumbs />
            {children}
          </main>

          {/* College Footer */}
          <Footer />
        </div>
      </div>
      <ForceChangePasswordModal />
    </div>
  );
}
