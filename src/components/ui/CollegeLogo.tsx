'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { COLLEGE_CONFIG } from '@/config/collegeConfig';

interface CollegeLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function CollegeLogo({ size = 'md', showText = false, className = '' }: CollegeLogoProps) {
  const [imageError, setImageError] = useState(false);
  const logoUrl = COLLEGE_CONFIG.institution.logoUrl;
  const isPlaceholderPath = logoUrl.includes('[PLACEHOLDER:');

  const dimensions = {
    sm: { box: 'h-8 w-8', icon: 18, text: 'text-xs', sub: 'text-[9px]' },
    md: { box: 'h-10 w-10', icon: 22, text: 'text-sm', sub: 'text-[10px]' },
    lg: { box: 'h-14 w-14', icon: 30, text: 'text-base', sub: 'text-xs' },
  }[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className={`${dimensions.box} rounded-xl bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 text-white flex items-center justify-center font-extrabold shadow-sm shrink-0 overflow-hidden border border-blue-600/30 relative select-none`}
        title={COLLEGE_CONFIG.institution.name}
        aria-label={`${COLLEGE_CONFIG.institution.shortName} Logo`}
      >
        {!isPlaceholderPath && !imageError ? (
          <Image
            src={logoUrl}
            alt={COLLEGE_CONFIG.institution.name}
            fill
            className="object-contain p-1"
            onError={() => setImageError(true)}
          />
        ) : (
          /* High-resolution SVG Crest Placeholder */
          <div className="flex flex-col items-center justify-center text-center">
            <svg
              className="text-amber-400 drop-shadow-sm"
              width={dimensions.icon}
              height={dimensions.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
              <path d="M22 10v6" />
              <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
            </svg>
            <span className="text-[7px] font-black tracking-tighter text-blue-200 mt-[-2px] uppercase">
              DYP
            </span>
          </div>
        )}
      </div>

      {showText && (
        <div className="flex flex-col min-w-0">
          <span className={`${dimensions.text} font-bold text-slate-900 tracking-tight leading-tight truncate`}>
            {COLLEGE_CONFIG.institution.shortName}
          </span>
          <span className={`${dimensions.sub} font-semibold text-blue-600 tracking-tight truncate`}>
            {COLLEGE_CONFIG.tpCell.name}
          </span>
        </div>
      )}
    </div>
  );
}
