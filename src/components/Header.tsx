'use client';

import React, { useState, useRef, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Menu, 
  LogOut, 
  Search, 
  Bell, 
  ChevronDown, 
  User as UserIcon, 
  ShieldCheck, 
  X,
  Calendar,
  Loader2,
  GraduationCap
} from 'lucide-react';
import { COLLEGE_CONFIG } from '@/config/collegeConfig';
import { CollegeLogo } from './ui/CollegeLogo';
import { Badge } from './ui/Badge';

interface HeaderProps {
  onMenuToggle: () => void;
}

interface SearchStudentResult {
  _id: string;
  name: string;
  rollNumber: string;
  branch: string;
  year: string;
}

interface SearchSessionResult {
  _id: string;
  title: string;
  date: string;
  trainer: string;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    students: SearchStudentResult[];
    sessions: SearchSessionResult[];
    totalMatches: number;
  } | null>(null);

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // 300ms Debounce search request to /api/search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results);
          setIsSearchOpen(true);
        }
      } catch (err) {
        console.error('[Global Search Fetch Error]:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdowns on outside click or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsProfileOpen(false);
        setIsNotificationsOpen(false);
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearchOpen(false);
      router.push(`/students?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const userRole = session?.user?.role || 'TPO';
  const roleConfig = COLLEGE_CONFIG.roles[userRole as keyof typeof COLLEGE_CONFIG.roles] || {
    label: userRole,
    description: '',
  };

  const userInitials = (session?.user?.name || 'T&P')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <header className="h-16 px-4 sm:px-6 bg-white border-b border-slate-200/80 shadow-xs flex items-center justify-between gap-3 sticky top-0 z-30">
      {/* Left: Mobile hamburger + College branding */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Toggle navigation menu"
          className="p-2 -ml-1 rounded-xl lg:hidden text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Brand Crest on Mobile */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <CollegeLogo size="sm" />
          <div className="flex flex-col">
            <span className="font-extrabold text-xs text-slate-900 leading-tight">
              {COLLEGE_CONFIG.institution.shortName}
            </span>
            <span className="text-[9px] font-semibold text-blue-600 leading-tight">
              T&P Cell
            </span>
          </div>
        </div>

        {/* Desktop T&P Header title */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 tracking-tight">
            {COLLEGE_CONFIG.tpCell.headerTitle}
          </span>
          <span className="inline-block h-3.5 w-px bg-slate-200 mx-1" />
          <Badge variant="info" size="sm">
            Kasaba Bawada, Kolhapur
          </Badge>
        </div>
      </div>

      {/* Center: Global Search Bar with Live Debounce & Scoping */}
      <div className="hidden md:block flex-1 max-w-xs lg:max-w-md mx-2 relative" ref={searchRef}>
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            {isSearching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (!val.trim()) {
                setSearchResults(null);
                setIsSearchOpen(false);
              }
            }}
            onFocus={() => {
              if (searchQuery.trim() && searchResults) setIsSearchOpen(true);
            }}
            placeholder="Search students (name, PRN) or sessions..."
            aria-label="Global search students and sessions"
            className="w-full pl-9 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-slate-800"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSearchResults(null);
                setIsSearchOpen(false);
              }}
              aria-label="Clear search"
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </form>

        {/* Live Search Results Dropdown */}
        {isSearchOpen && searchResults && (
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 max-h-96 overflow-y-auto">
            {searchResults.totalMatches === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No students or sessions found matching &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              <>
                {/* Students Section */}
                {searchResults.students.length > 0 && (
                  <div className="py-1">
                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <GraduationCap className="h-3 w-3" />
                      <span>Students ({searchResults.students.length})</span>
                    </div>
                    {searchResults.students.map((student) => (
                      <Link
                        key={student._id}
                        href={`/students?search=${encodeURIComponent(student.rollNumber)}`}
                        onClick={() => setIsSearchOpen(false)}
                        className="px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-xs transition-colors block"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{student.name}</p>
                          <p className="text-[10px] text-slate-500">
                            PRN: {student.rollNumber} • {student.branch} ({student.year})
                          </p>
                        </div>
                        <Badge variant="neutral" size="sm">
                          {student.branch}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Sessions Section */}
                {searchResults.sessions.length > 0 && (
                  <div className="py-1 border-t border-slate-100 mt-1">
                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      <span>Training Sessions ({searchResults.sessions.length})</span>
                    </div>
                    {searchResults.sessions.map((sess) => (
                      <Link
                        key={sess._id}
                        href={`/sessions/${sess._id}`}
                        onClick={() => setIsSearchOpen(false)}
                        className="px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-xs transition-colors block"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{sess.title}</p>
                          <p className="text-[10px] text-slate-500">
                            Trainer: {sess.trainer} • {new Date(sess.date).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="info" size="sm">
                          Session
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Right Actions: Notification bell + User profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notification Bell */}
        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            onClick={() => {
              setIsNotificationsOpen(!isNotificationsOpen);
              setIsProfileOpen(false);
            }}
            aria-label="View notifications"
            aria-expanded={isNotificationsOpen}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
          >
            <Bell className="h-4 w-4" />
          </button>

          {/* Notifications Dropdown: Clean state without fake indicators */}
          {isNotificationsOpen && (
            <div
              className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              role="region"
              aria-label="Notifications list"
            >
              <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Notifications</span>
                <Badge variant="neutral" size="sm">0 active</Badge>
              </div>
              <div className="p-6 text-center">
                <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-slate-700">No notifications yet</p>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  In-app notifications and alerts will be enabled in Phase 6. Real-time updates for drives and deadlines will appear here.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        {session && (
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setIsProfileOpen(!isProfileOpen);
                setIsNotificationsOpen(false);
              }}
              aria-label="Open user profile menu"
              aria-expanded={isProfileOpen}
              className="flex items-center gap-2.5 p-1.5 pl-2 rounded-xl hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer select-none"
            >
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {userInitials}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 leading-tight">
                  {session.user?.name || 'Administrator'}
                </span>
                <span className="text-[10px] text-slate-500 font-medium leading-tight">
                  {roleConfig.label}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {/* Profile Dropdown */}
            {isProfileOpen && (
              <div
                className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                role="menu"
                aria-label="User profile options"
              >
                {/* User info header */}
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {session.user?.name || 'DYPCET Coordinator'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {session.user?.email}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Badge variant="purple" size="sm">
                      <ShieldCheck className="h-3 w-3 mr-0.5 inline" />
                      {roleConfig.label}
                    </Badge>
                    {session.user?.department && (
                      <Badge variant="neutral" size="sm">
                        {session.user.department}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      router.push('/students');
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    role="menuitem"
                  >
                    <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                    <span>Students Directory</span>
                  </button>
                </div>

                {/* Sign Out */}
                <div className="pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
                    role="menuitem"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
