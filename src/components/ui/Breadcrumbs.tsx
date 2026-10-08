'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbsProps {
  customSegments?: Array<{ label: string; href?: string }>;
}

export function Breadcrumbs({ customSegments }: BreadcrumbsProps) {
  const pathname = usePathname();

  // If custom segments are provided, use them
  if (customSegments) {
    return (
      <nav aria-label="Breadcrumb" className="flex items-center text-xs text-slate-500 mb-3">
        <ol className="flex items-center gap-1.5 flex-wrap">
          <li>
            <Link
              href="/"
              className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1"
            >
              <Home className="h-3.5 w-3.5" />
            </Link>
          </li>
          {customSegments.map((seg, idx) => {
            const isLast = idx === customSegments.length - 1;
            return (
              <li key={idx} className="flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
                {seg.href && !isLast ? (
                  <Link
                    href={seg.href}
                    className="hover:text-blue-600 transition-colors capitalize font-medium text-slate-600"
                  >
                    {seg.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className="font-bold text-slate-800 capitalize truncate max-w-[180px]"
                  >
                    {seg.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  // Generate automatically from pathname
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const segmentLabels: Record<string, string> = {
    students: 'Students Directory',
    sessions: 'Training Sessions',
    feedback: 'Feedback Logs',
    admin: 'Administration',
    users: 'User Accounts',
  };

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-xs text-slate-500 mb-2">
      <ol className="flex items-center gap-1.5 flex-wrap">
        <li>
          <Link
            href="/"
            className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1"
          >
            <Home className="h-3.5 w-3.5" />
          </Link>
        </li>
        {segments.map((seg, idx) => {
          const href = `/${segments.slice(0, idx + 1).join('/')}`;
          const isLast = idx === segments.length - 1;
          const label = segmentLabels[seg] || seg;

          return (
            <li key={href} className="flex items-center gap-1.5">
              <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
              {isLast ? (
                <span
                  aria-current="page"
                  className="font-bold text-slate-800 capitalize truncate max-w-[180px]"
                >
                  {label}
                </span>
              ) : (
                <Link
                  href={href}
                  className="hover:text-blue-600 transition-colors capitalize font-medium text-slate-600"
                >
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
