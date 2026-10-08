import React from 'react';
import { COLLEGE_CONFIG, isConfigured } from '@/config/collegeConfig';
import { MapPin, Mail, Phone, ExternalLink } from 'lucide-react';

export default function Footer() {
  const hasEmail = isConfigured(COLLEGE_CONFIG.tpCell.email);
  const hasPhone = isConfigured(COLLEGE_CONFIG.institution.contactPhone);
  const hasWebsite = isConfigured(COLLEGE_CONFIG.institution.website);
  const hasAnyContact = hasEmail || hasPhone || hasWebsite;

  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-white px-6 py-6 text-xs text-slate-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* College & Department Identity */}
        <div className="space-y-1">
          <p className="font-bold text-slate-800 text-sm">
            {COLLEGE_CONFIG.institution.name}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              {COLLEGE_CONFIG.institution.campus}
            </span>
            <span className="font-semibold text-blue-700">
              {COLLEGE_CONFIG.tpCell.name}
            </span>
          </div>
        </div>

        {/* Contact info & Links (Unverified placeholders are suppressed) */}
        {hasAnyContact && (
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
            {hasEmail && (
              <span className="flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-slate-400" />
                <span>{COLLEGE_CONFIG.tpCell.email}</span>
              </span>
            )}
            {hasPhone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3 w-3 text-slate-400" />
                <span>{COLLEGE_CONFIG.institution.contactPhone}</span>
              </span>
            )}
            {hasWebsite && (
              <a
                href={COLLEGE_CONFIG.institution.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold transition-colors"
              >
                <span>College Portal</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-400">
        <p>© {new Date().getFullYear()} {COLLEGE_CONFIG.institution.shortName} Training & Placement Cell. All rights reserved.</p>
        <p className="font-mono">DYPCET T&P Management System v2.0</p>
      </div>
    </footer>
  );
}
