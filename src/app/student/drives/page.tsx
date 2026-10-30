'use client';

import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface StudentDriveItem {
  _id: string;
  title: string;
  company?: { name: string };
  role: string;
  type?: string;
  packageLPA?: number;
  driveDate?: string;
  deadlineDate?: string;
  status: string;
  isEligible: boolean;
  reasonsIneligible?: string[];
  isPastDeadline: boolean;
  applicationStatus: string;
  canApply: boolean;
  canWithdraw: boolean;
}

export default function StudentDrivesPage() {
  const [loading, setLoading] = useState(true);
  const [portalDisabled, setPortalDisabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [drives, setDrives] = useState<StudentDriveItem[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchDrives = async () => {
    try {
      const res = await fetch('/api/student/drives');
      if (res.status === 403) {
        setPortalDisabled(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load drives');
      }
      const data = await res.json();
      setDrives(data.drives || []);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error loading drives');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrives();
  }, []);

  const handleApply = async (driveId: string) => {
    setActionLoadingId(driveId);
    setActionSuccess(null);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/student/drives/${driveId}/apply`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply');
      }
      setActionSuccess('Application submitted successfully!');
      await fetchDrives();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to apply');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleWithdraw = async (driveId: string) => {
    if (!window.confirm('Are you sure you want to withdraw your application?')) {
      return;
    }

    setActionLoadingId(driveId);
    setActionSuccess(null);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/student/drives/${driveId}/withdraw`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to withdraw');
      }
      setActionSuccess('Application withdrawn successfully.');
      await fetchDrives();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to withdraw');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">Loading placement drives...</p>
      </div>
    );
  }

  if (portalDisabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white rounded-3xl border border-amber-200 shadow-xs max-w-2xl mx-auto my-8">
        <div className="h-16 w-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-800">Student Portal Disabled</h1>
        <p className="text-sm text-slate-600 mt-2 max-w-md leading-relaxed">
          The student self-service portal is currently disabled. Please contact the Training & Placement Cell for assistance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Placement Drives</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Explore active recruitment drives, check your eligibility, and register before the deadline.
          </p>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2 text-xs font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Drives Grid */}
      {drives.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center">
          <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Briefcase className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Placement Drives Available</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            There are currently no active drives open for registration. Check back regularly or view recent notices.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {drives.map((drive) => {
            const isProcessing = actionLoadingId === drive._id;
            return (
              <div
                key={drive._id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Company, Role, Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                        <h2 className="text-base font-bold text-slate-900 truncate">
                          {drive.company?.name || drive.title}
                        </h2>
                      </div>
                      <p className="text-xs font-semibold text-slate-600 mt-0.5">{drive.role}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={drive.isEligible ? 'success' : 'neutral'} size="sm">
                        {drive.isEligible ? 'Eligible' : 'Ineligible'}
                      </Badge>
                      {drive.applicationStatus !== 'Not Applied' && (
                        <Badge
                          variant={
                            drive.applicationStatus === 'Applied'
                              ? 'info'
                              : drive.applicationStatus === 'Selected'
                              ? 'success'
                              : drive.applicationStatus === 'Withdrawn'
                              ? 'neutral'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {drive.applicationStatus}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Details List */}
                  <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-slate-600 bg-slate-50 p-3 rounded-xl">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Package (CTC)</span>
                      <span className="font-bold text-slate-800">
                        {drive.packageLPA ? `${drive.packageLPA} LPA` : 'Best in Industry'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Drive Type</span>
                      <span className="font-semibold">{drive.type || 'Full-time'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Drive Date</span>
                      <span className="font-semibold">
                        {drive.driveDate ? new Date(drive.driveDate).toLocaleDateString() : 'To be announced'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Registration Deadline</span>
                      <span className={`font-semibold ${drive.isPastDeadline ? 'text-red-600' : 'text-slate-700'}`}>
                        {drive.deadlineDate ? new Date(drive.deadlineDate).toLocaleDateString() : 'Rolling'}
                      </span>
                    </div>
                  </div>

                  {/* Ineligibility Reasons Banner */}
                  {!drive.isEligible && drive.reasonsIneligible && drive.reasonsIneligible.length > 0 && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-[11px] space-y-0.5">
                      <span className="font-bold block">Eligibility Criteria Not Met:</span>
                      {drive.reasonsIneligible.map((reason: string, idx: number) => (
                        <p key={idx} className="flex items-center gap-1.5 text-amber-800">
                          • {reason}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer / Action Button */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-400">
                    {drive.isPastDeadline ? (
                      <span className="text-red-500 font-semibold flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Deadline passed
                      </span>
                    ) : (
                      <span>IST Deadline applies</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {drive.canApply && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => handleApply(drive._id)}
                      >
                        {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply Now'}
                      </Button>
                    )}

                    {drive.canWithdraw && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => handleWithdraw(drive._id)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Withdraw'}
                      </Button>
                    )}

                    {!drive.canApply && !drive.canWithdraw && (
                      <span className="text-xs text-slate-400 font-medium">
                        {drive.applicationStatus === 'Withdrawn'
                          ? 'Withdrawn'
                          : drive.applicationStatus === 'Applied'
                          ? 'Application Registered'
                          : !drive.isEligible
                          ? 'Not Eligible'
                          : drive.isPastDeadline
                          ? 'Closed'
                          : 'In Process'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
