'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  MessageSquare, 
  X,
  ShieldCheck,
  Building2,
  Briefcase,
  Award
} from 'lucide-react';
import { COLLEGE_CONFIG } from '@/config/collegeConfig';
import { CollegeLogo } from './ui/CollegeLogo';
import { Badge } from './ui/Badge';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isStudent = session?.user?.role === 'STUDENT';

  const navItems = isStudent
    ? [
        { name: 'Training Sessions', href: '/sessions', icon: Calendar },
      ]
    : [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Students Directory', href: '/students', icon: Users },
        { name: 'Placement Drives', href: '/drives', icon: Briefcase },
        { name: 'Company Directory', href: '/companies', icon: Building2 },
        { name: 'Offers & Outcomes', href: '/offers', icon: Award },
        { name: 'Training Sessions', href: '/sessions', icon: Calendar },
        { name: 'Feedback Logs', href: '/feedback', icon: MessageSquare },
        ...(session?.user?.role === 'SUPER_ADMIN'
          ? [{ name: 'User Accounts', href: '/admin/users', icon: ShieldCheck }]
          : []),
      ];

  const userRole = session?.user?.role || 'TPO';
  const roleConfig = COLLEGE_CONFIG.roles[userRole as keyof typeof COLLEGE_CONFIG.roles] || {
    label: userRole,
    description: '',
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-slate-900 text-slate-100 border-r border-slate-800 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Main Navigation"
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-800/80 bg-slate-950/60">
          <Link href="/" className="flex items-center gap-3 min-w-0" onClick={onClose}>
            <CollegeLogo size="sm" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-black tracking-tight text-white leading-tight truncate">
                {COLLEGE_CONFIG.institution.shortName}
              </span>
              <span className="text-[10px] font-semibold text-blue-400 tracking-tight leading-tight truncate">
                {COLLEGE_CONFIG.tpCell.name}
              </span>
            </div>
          </Link>

          <button 
            type="button"
            onClick={onClose} 
            aria-label="Close navigation sidebar"
            className="p-1.5 rounded-lg lg:hidden hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* College Tagline Banner */}
        <div className="px-5 py-3 border-b border-slate-800/60 bg-slate-900/40">
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed truncate">
            {COLLEGE_CONFIG.institution.name}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-[9px] text-slate-400">
            <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
            <span className="truncate">Kasaba Bawada, Kolhapur</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Navigation
          </div>

          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Role & User Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-blue-600/20 text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-500/20 shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-xs font-bold text-slate-200 truncate">
                {session?.user?.name || 'T&P Officer'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge variant="purple" size="sm" className="text-[9px] px-1.5 py-0">
                  {roleConfig.label.split(' ')[0]}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
