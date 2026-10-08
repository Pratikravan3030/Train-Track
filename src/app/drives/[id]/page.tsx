'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  Clock,
  Download,
  Upload,
  Award,
  FileText,
  AlertTriangle,
  RotateCcw,
  Calendar,
  MapPin,
  ChevronRight,
  Info,
  Plus
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastContext';
import { OFFER_TYPES } from '@/config/collegeConfig';

interface EligibleRosterStats {
  totalEvaluated: number;
  eligibleCount: number;
  ineligibleCount: number;
  incompleteDataCount: number;
  registeredCount: number;
}

interface ShortlistCandidate {
  rollNumber: string;
  fullName: string;
  department: string;
  applicationId: string;
}

interface ShortlistPreviewState {
  counts: {
    matchedCount: number;
    omittedCount: number;
    unrecognizedCount: number;
  };
  matched: ShortlistCandidate[];
  omitted: ShortlistCandidate[];
  unrecognized: string[];
}

interface DriveDetail {
  _id: string;
  company: {
    _id: string;
    name: string;
    sector: string;
    website?: string;
  };
  role: string;
  type: string;
  jd: string;
  ctcLpa?: number | null;
  stipendMonthly?: number | null;
  tier: string;
  location: string;
  mode: string;
  driveDate: string;
  registrationDeadline: string;
  selectionRounds: string[];
  status: string;
  displayStatus: string;
  isRegistrationClosed: boolean;
  applicantCount: number;
}

interface EligibleStudent {
  _id: string;
  name: string;
  rollNumber: string;
  prn?: string;
  department: string;
  passoutYear: number;
  cgpa?: number | null;
  backlogs?: number | null;
  tenthPercentage?: number | null;
  twelfthOrDiplomaPercentage?: number | null;
  isEligible: boolean;
  reasons: string[];
  isDataIncomplete: boolean;
  missingFields: string[];
  isRegistered: boolean;
  applicationStatus?: string | null;
}

interface ApplicationItem {
  _id: string;
  student: {
    _id: string;
    name: string;
    rollNumber: string;
    prn?: string;
    department: string;
    cgpa?: number | null;
    resumeStorageKey?: string;
    resumeUrl?: string;
  };
  status: string;
  currentRoundIndex: number;
  roundResults: Array<{
    roundIndex: number;
    roundName: string;
    status: string;
  }>;
  isLateRegistration?: boolean;
}

interface DriveOffer {
  _id: string;
  student: {
    _id: string;
    name: string;
    rollNumber: string;
    department: string;
  };
  role: string;
  type: string;
  ctcLpa?: number | null;
  status: string;
  offerLetterUrl?: string;
  offerDate: string;
}

export default function DriveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const { showToast } = useToast();

  const isStaff = session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'TPO';

  const [drive, setDrive] = useState<DriveDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'eligible' | 'applicants' | 'offers'>('overview');
  const [loading, setLoading] = useState(true);

  // Eligible students state
  const [eligibleList, setEligibleList] = useState<EligibleStudent[]>([]);
  const [eligibleStats, setEligibleStats] = useState<EligibleRosterStats | null>(null);
  const [eligibleFilter, setEligibleFilter] = useState<'all' | 'eligible' | 'ineligible'>('all');
  const [eligibleSearch, setEligibleSearch] = useState('');
  const [eligibleLoading, setEligibleLoading] = useState(false);

  // Applicants state
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);

  // Offers state
  const [offers, setOffers] = useState<DriveOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);

  // Registration Override Modal
  const [overrideModal, setOverrideModal] = useState<{
    isOpen: boolean;
    student: EligibleStudent | null;
    reason: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    student: null,
    reason: '',
    isSubmitting: false,
  });

  // Shortlist Modal State
  const [shortlistModal, setShortlistModal] = useState<{
    isOpen: boolean;
    targetRoundIndex: number;
    rawInput: string;
    preview: ShortlistPreviewState | null;
    eliminateOmitted: boolean;
    rejectionReason: string;
    isProcessing: boolean;
  }>({
    isOpen: false,
    targetRoundIndex: 1,
    rawInput: '',
    preview: null,
    eliminateOmitted: false,
    rejectionReason: '',
    isProcessing: false,
  });

  // Issue Offer Modal
  const [offerModal, setOfferModal] = useState<{
    isOpen: boolean;
    studentId: string;
    type: string;
    ctcLpa: string;
    status: string;
    overrideReason: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    studentId: '',
    type: 'Full-time',
    ctcLpa: '',
    status: 'Accepted',
    overrideReason: '',
    isSubmitting: false,
  });

  // Offer Reversal Modal
  const [reversalModal, setReversalModal] = useState<{
    isOpen: boolean;
    offer: DriveOffer | null;
    status: 'Declined' | 'Revoked';
    reason: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    offer: null,
    status: 'Declined',
    reason: '',
    isSubmitting: false,
  });

  // Fetch Drive Overview
  const fetchDrive = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/drives/${id}`);
      if (!res.ok) throw new Error('Drive not found');
      const data = await res.json();
      setDrive(data);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error fetching drive details', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDrive();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchDrive]);

  // Fetch Eligible Roster
  const fetchEligibleStudents = useCallback(async () => {
    try {
      setEligibleLoading(true);
      const params = new URLSearchParams();
      if (eligibleFilter !== 'all') params.set('status', eligibleFilter);
      if (eligibleSearch) params.set('search', eligibleSearch);

      const res = await fetch(`/api/drives/${id}/eligible?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to evaluate eligible students');
      const data = await res.json();
      setEligibleList(data.data || []);
      setEligibleStats(data.stats);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error fetching eligibility roster', 'error');
    } finally {
      setEligibleLoading(false);
    }
  }, [id, eligibleFilter, eligibleSearch, showToast]);

  // Fetch Applications
  const fetchApplications = useCallback(async () => {
    try {
      setAppsLoading(true);
      const res = await fetch(`/api/drives/${id}/applications?limit=200`);
      if (!res.ok) throw new Error('Failed to load applications');
      const data = await res.json();
      setApplications(data.data || []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error fetching applications', 'error');
    } finally {
      setAppsLoading(false);
    }
  }, [id, showToast]);

  // Fetch Offers
  const fetchOffers = useCallback(async () => {
    try {
      setOffersLoading(true);
      const res = await fetch(`/api/drives/${id}/offers`);
      if (!res.ok) throw new Error('Failed to load offers');
      const data = await res.json();
      setOffers(data.data || []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error fetching drive offers', 'error');
    } finally {
      setOffersLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'eligible') fetchEligibleStudents();
      if (activeTab === 'applicants') fetchApplications();
      if (activeTab === 'offers') fetchOffers();
    }, 0);
    return () => clearTimeout(timer);
  }, [activeTab, fetchEligibleStudents, fetchApplications, fetchOffers]);

  // Register Student handler
  const handleRegisterStudent = async (student: EligibleStudent, overrideReason?: string) => {
    try {
      const isLate = drive?.isRegistrationClosed;
      const needsOverride = !student.isEligible || isLate;

      if (needsOverride && !overrideReason) {
        setOverrideModal({
          isOpen: true,
          student,
          reason: '',
          isSubmitting: false,
        });
        return;
      }

      const res = await fetch(`/api/drives/${id}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student._id,
          overrideReason: !student.isEligible ? overrideReason : undefined,
          lateRegistrationReason: isLate ? overrideReason : undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to register student');
      }

      showToast(`Successfully registered ${student.name}`, 'success');
      setOverrideModal({ isOpen: false, student: null, reason: '', isSubmitting: false });
      fetchEligibleStudents();
      fetchDrive();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Registration error', 'error');
    }
  };

  // Shortlist Preview
  const handleShortlistPreview = async () => {
    const rolls = shortlistModal.rawInput
      .split(/[\n,]+/)
      .map((r) => r.trim())
      .filter(Boolean);

    if (rolls.length === 0) {
      showToast('Please enter at least one roll number or PRN', 'error');
      return;
    }

    try {
      setShortlistModal((prev) => ({ ...prev, isProcessing: true }));
      const res = await fetch(`/api/drives/${id}/shortlist/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRoundIndex: shortlistModal.targetRoundIndex,
          rollNumbers: rolls,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Shortlist preview failed');

      setShortlistModal((prev) => ({ ...prev, preview: data }));
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Preview error', 'error');
    } finally {
      setShortlistModal((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  // Shortlist Confirm
  const handleShortlistConfirm = async () => {
    if (!shortlistModal.preview) return;

    try {
      setShortlistModal((prev) => ({ ...prev, isProcessing: true }));
      const res = await fetch(`/api/drives/${id}/shortlist/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRoundIndex: shortlistModal.targetRoundIndex,
          shortlistedRollNumbers: shortlistModal.preview.matched.map((m) => m.rollNumber),
          eliminateOmitted: shortlistModal.eliminateOmitted,
          rejectionReason: shortlistModal.rejectionReason || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Shortlist confirm failed');

      showToast(data.message, 'success');
      setShortlistModal({
        isOpen: false,
        targetRoundIndex: 1,
        rawInput: '',
        preview: null,
        eliminateOmitted: false,
        rejectionReason: '',
        isProcessing: false,
      });
      fetchApplications();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Confirmation error', 'error');
    } finally {
      setShortlistModal((prev) => ({ ...prev, isProcessing: false }));
    }
  };

  // Issue Offer
  const handleIssueOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setOfferModal((prev) => ({ ...prev, isSubmitting: true }));
      const res = await fetch(`/api/drives/${id}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: offerModal.studentId,
          type: offerModal.type,
          ctcLpa: offerModal.ctcLpa ? parseFloat(offerModal.ctcLpa) : undefined,
          status: offerModal.status,
          overrideReason: offerModal.overrideReason || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to issue offer');

      showToast('Offer created successfully and student placement status updated', 'success');
      setOfferModal({
        isOpen: false,
        studentId: '',
        type: 'Full-time',
        ctcLpa: '',
        status: 'Accepted',
        overrideReason: '',
        isSubmitting: false,
      });
      fetchOffers();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Offer error', 'error');
    } finally {
      setOfferModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // Reverse Offer
  const handleReverseOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalModal.offer) return;

    try {
      setReversalModal((prev) => ({ ...prev, isSubmitting: true }));
      const res = await fetch(`/api/offers/${reversalModal.offer._id}/reversal`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: reversalModal.status,
          reason: reversalModal.reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reversal failed');

      showToast(data.message, 'success');
      setReversalModal({ isOpen: false, offer: null, status: 'Declined', reason: '', isSubmitting: false });
      fetchOffers();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error reversing offer', 'error');
    } finally {
      setReversalModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm text-slate-500">Loading placement drive details...</p>
      </div>
    );
  }

  if (!drive) {
    return (
      <div className="p-12 text-center space-y-3">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">Placement Drive Not Found</h2>
        <Link href="/drives" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Placement Drives
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/drives" className="hover:text-blue-600 flex items-center gap-1 font-medium">
          <ArrowLeft className="w-4 h-4" /> Drives
        </Link>
        <ChevronRight className="w-4 h-4 text-slate-300" />
        <span className="text-slate-900 font-semibold truncate">{drive.company?.name} — {drive.role}</span>
      </div>

      {/* Main Drive Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                {drive.company?.name}
              </span>
              <Badge variant={drive.status === 'Open' ? 'success' : 'neutral'}>
                {drive.displayStatus}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{drive.role}</h1>
            <div className="flex items-center gap-4 text-xs text-slate-500 mt-2 flex-wrap">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> {drive.location} ({drive.mode})
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Drive Date: {new Date(drive.driveDate).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Deadline: {new Date(drive.registrationDeadline).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isStaff && (
              <a
                href={`/api/drives/${drive._id}/export?preset=company`}
                download
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <Download className="w-3.5 h-3.5" />
                Export for Company
              </a>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-3 overflow-x-auto">
          {[
            { key: 'overview', label: 'Drive Overview', icon: Info },
            { key: 'eligible', label: 'Eligible Roster & Register', icon: CheckCircle2 },
            { key: 'applicants', label: `Applicants (${drive.applicantCount})`, icon: Users },
            { key: 'offers', label: 'Offers & Results', icon: Award },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'overview' | 'eligible' | 'applicants' | 'offers')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900">Job Description</h2>
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {drive.jd}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900">Selection Pipeline</h2>
              <div className="flex flex-col gap-3">
                {drive.selectionRounds.map((rnd, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{rnd}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900">Compensation & Tier</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Tier:</span>
                  <span className="font-semibold text-slate-800">{drive.tier}</span>
                </div>
                {drive.ctcLpa && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">CTC:</span>
                    <span className="font-semibold text-emerald-600">₹{drive.ctcLpa} LPA</span>
                  </div>
                )}
                {drive.stipendMonthly && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Stipend:</span>
                    <span className="font-semibold text-slate-800">₹{drive.stipendMonthly}/month</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Type:</span>
                  <span className="font-semibold text-slate-800">{drive.type}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Eligible Roster & Register */}
      {activeTab === 'eligible' && (
        <div className="space-y-4">
          {/* Stats Bar */}
          {eligibleStats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-500">Evaluated:</span>
                <p className="text-lg font-bold text-slate-900">{eligibleStats.totalEvaluated}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-xs text-emerald-600">Eligible:</span>
                <p className="text-lg font-bold text-emerald-700">{eligibleStats.eligibleCount}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-xs text-red-600">Ineligible:</span>
                <p className="text-lg font-bold text-red-700">{eligibleStats.ineligibleCount}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-xs text-amber-600">Data Missing:</span>
                <p className="text-lg font-bold text-amber-700">{eligibleStats.incompleteDataCount}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-xs text-blue-600">Registered:</span>
                <p className="text-lg font-bold text-blue-700">{eligibleStats.registeredCount}</p>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-600">Filter:</span>
              {(['all', 'eligible', 'ineligible'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setEligibleFilter(mode)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md border capitalize ${
                    eligibleFilter === mode
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search name, roll number, PRN..."
                value={eligibleSearch}
                onChange={(e) => setEligibleSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Eligible Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {eligibleLoading ? (
              <div className="p-8 text-center text-xs text-slate-500">Evaluating eligibility engine...</div>
            ) : eligibleList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No students matched criteria.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Roll / Name</th>
                      <th className="px-4 py-3">Dept</th>
                      <th className="px-4 py-3">CGPA</th>
                      <th className="px-4 py-3">Backlogs</th>
                      <th className="px-4 py-3">10th / 12th %</th>
                      <th className="px-4 py-3">Eligibility Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eligibleList.map((stu) => (
                      <tr key={stu._id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{stu.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{stu.rollNumber}</div>
                        </td>
                        <td className="px-4 py-3 font-medium">{stu.department}</td>
                        <td className="px-4 py-3">{stu.cgpa != null ? stu.cgpa.toFixed(2) : <span className="text-amber-600 font-semibold">Missing</span>}</td>
                        <td className="px-4 py-3">{stu.backlogs != null ? stu.backlogs : <span className="text-amber-600 font-semibold">Missing</span>}</td>
                        <td className="px-4 py-3">
                          {stu.tenthPercentage != null ? `${stu.tenthPercentage}%` : '—'} / {stu.twelfthOrDiplomaPercentage != null ? `${stu.twelfthOrDiplomaPercentage}%` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {stu.isEligible ? (
                            <Badge variant="success">Eligible</Badge>
                          ) : (
                            <div>
                              <Badge variant="danger">Ineligible</Badge>
                              <div className="text-[10px] text-red-600 mt-1 line-clamp-1" title={stu.reasons.join('; ')}>
                                {stu.reasons.join('; ')}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {stu.isRegistered ? (
                            <Badge variant="neutral">Already Registered</Badge>
                          ) : isStaff ? (
                            <Button
                              onClick={() => handleRegisterStudent(stu)}
                              variant={stu.isEligible ? 'primary' : 'outline'}
                              size="sm"
                              className="text-xs"
                            >
                              {stu.isEligible ? 'Register' : 'Register (Override)'}
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Applicants & Shortlists */}
      {activeTab === 'applicants' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">
              Registered Candidates ({applications.length})
            </h2>

            {isStaff && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() =>
                    setShortlistModal({
                      isOpen: true,
                      targetRoundIndex: 1,
                      rawInput: '',
                      preview: null,
                      eliminateOmitted: false,
                      rejectionReason: '',
                      isProcessing: false,
                    })
                  }
                  variant="primary"
                  size="sm"
                  className="flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Shortlist Candidates (CSV)
                </Button>
              </div>
            )}
          </div>

          {/* Applicants Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {appsLoading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading candidate roster...</div>
            ) : applications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No applicants registered for this drive yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Candidate</th>
                      <th className="px-4 py-3">Dept</th>
                      <th className="px-4 py-3">Current Round</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Resume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {applications.map((app) => (
                      <tr key={app._id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{app.student.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{app.student.rollNumber}</div>
                        </td>
                        <td className="px-4 py-3 font-medium">{app.student.department}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {drive.selectionRounds[app.currentRoundIndex] || `Round ${app.currentRoundIndex + 1}`}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              app.status === 'Selected'
                                ? 'success'
                                : app.status === 'Rejected'
                                ? 'danger'
                                : 'info'
                            }
                          >
                            {app.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {app.student.resumeStorageKey || app.student.resumeUrl ? (
                            <a
                              href={`/api/students/${app.student._id}/resume`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5" /> View Resume
                            </a>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Offers */}
      {activeTab === 'offers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900">
              Placement Offers Issued ({offers.length})
            </h2>

            {isStaff && (
              <Button
                onClick={() =>
                  setOfferModal({
                    isOpen: true,
                    studentId: '',
                    type: drive.type === 'Internship' ? 'Internship' : 'Full-time',
                    ctcLpa: drive.ctcLpa ? String(drive.ctcLpa) : '',
                    status: 'Accepted',
                    overrideReason: '',
                    isSubmitting: false,
                  })
                }
                variant="primary"
                size="sm"
                className="flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Issue Drive Offer
              </Button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {offersLoading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading drive offers...</div>
            ) : offers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No offers issued for this placement drive yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Package CTC</th>
                      <th className="px-4 py-3">Offer Status</th>
                      <th className="px-4 py-3">Offer Letter</th>
                      <th className="px-4 py-3 text-right">Reversal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {offers.map((off) => (
                      <tr key={off._id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{off.student.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{off.student.rollNumber}</div>
                        </td>
                        <td className="px-4 py-3 font-medium">{off.type}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-600">
                          {off.ctcLpa ? `₹${off.ctcLpa} LPA` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={off.status === 'Accepted' ? 'success' : off.status === 'Declined' ? 'danger' : 'neutral'}>
                            {off.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {off.offerLetterUrl ? (
                            <a
                              href={off.offerLetterUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5" /> PDF
                            </a>
                          ) : (
                            <span className="text-slate-400">Not Uploaded</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isStaff && off.status === 'Accepted' && (
                            <Button
                              onClick={() =>
                                setReversalModal({
                                  isOpen: true,
                                  offer: off,
                                  status: 'Declined',
                                  reason: '',
                                  isSubmitting: false,
                                })
                              }
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-800 flex items-center gap-1 ml-auto"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Revert
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 1: Override Reason Dialog */}
      <Modal
        isOpen={overrideModal.isOpen}
        onClose={() => setOverrideModal({ isOpen: false, student: null, reason: '', isSubmitting: false })}
        title="Staff Override Reason Required"
        description={`Student ${overrideModal.student?.name} is ineligible or the drive deadline has passed. A mandatory audit reason is required to proceed.`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
            {overrideModal.student?.reasons.join('; ') || 'Drive registration deadline has passed.'}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Override Reason *</label>
            <textarea
              required
              rows={3}
              value={overrideModal.reason}
              onChange={(e) => setOverrideModal({ ...overrideModal, reason: e.target.value })}
              placeholder="e.g. Approved by TPO Chair for special company shortlist waiver"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setOverrideModal({ isOpen: false, student: null, reason: '', isSubmitting: false })}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={overrideModal.reason.trim().length < 5}
              onClick={() => handleRegisterStudent(overrideModal.student!, overrideModal.reason)}
            >
              Confirm Override & Register
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Shortlist CSV Import & Two-Step Decision */}
      <Modal
        isOpen={shortlistModal.isOpen}
        onClose={() => setShortlistModal((prev) => ({ ...prev, isOpen: false }))}
        title="Shortlist Candidates (Round Advancement)"
        description="Paste candidate roll numbers / PRNs to advance them to the next selection round."
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Selection Round *</label>
            <select
              value={shortlistModal.targetRoundIndex}
              onChange={(e) =>
                setShortlistModal({
                  ...shortlistModal,
                  targetRoundIndex: parseInt(e.target.value, 10),
                  preview: null,
                })
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {drive.selectionRounds.map((rnd, idx) => (
                <option key={idx} value={idx}>
                  Round {idx + 1}: {rnd}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Shortlisted Roll Numbers / PRNs (one per line or comma-separated) *
            </label>
            <textarea
              rows={4}
              value={shortlistModal.rawInput}
              onChange={(e) =>
                setShortlistModal({ ...shortlistModal, rawInput: e.target.value, preview: null })
              }
              placeholder="e.g.&#10;CSE-2025-01&#10;CSE-2025-02&#10;PRN20250005"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
          </div>

          {!shortlistModal.preview && (
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="outline" onClick={() => setShortlistModal((prev) => ({ ...prev, isOpen: false }))}>
                Cancel
              </Button>
              <Button variant="primary" disabled={shortlistModal.isProcessing} onClick={handleShortlistPreview}>
                {shortlistModal.isProcessing ? 'Analyzing...' : 'Preview Shortlist'}
              </Button>
            </div>
          )}

          {/* Step 2: Confirmation Decision */}
          {shortlistModal.preview && (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold uppercase text-slate-700">Preview Match Summary</h4>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-emerald-50 text-emerald-800 p-2 rounded-md font-semibold">
                  Matched: {shortlistModal.preview.counts.matchedCount}
                </div>
                <div className="bg-amber-50 text-amber-800 p-2 rounded-md font-semibold">
                  Omitted: {shortlistModal.preview.counts.omittedCount}
                </div>
                <div className="bg-slate-100 text-slate-600 p-2 rounded-md font-semibold">
                  Unrecognized: {shortlistModal.preview.counts.unrecognizedCount}
                </div>
              </div>

              {/* Explicit Elimination Decision */}
              <div className="p-3 bg-white rounded-md border border-slate-200 space-y-2">
                <label className="flex items-start gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shortlistModal.eliminateOmitted}
                    onChange={(e) =>
                      setShortlistModal({ ...shortlistModal, eliminateOmitted: e.target.checked })
                    }
                    className="mt-0.5 rounded-sm border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <span>
                    Eliminate {shortlistModal.preview.counts.omittedCount} omitted candidate(s) (Mark status as &quot;Rejected&quot; for this drive)
                  </span>
                </label>

                {shortlistModal.eliminateOmitted && (
                  <input
                    type="text"
                    placeholder="Elimination reason (e.g. Did not clear technical cutoff)"
                    value={shortlistModal.rejectionReason}
                    onChange={(e) =>
                      setShortlistModal({ ...shortlistModal, rejectionReason: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                  />
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setShortlistModal((prev) => ({ ...prev, preview: null }))}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  disabled={shortlistModal.isProcessing}
                  onClick={handleShortlistConfirm}
                >
                  {shortlistModal.isProcessing ? 'Confirming...' : 'Confirm Round Advancement'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal 3: Issue Offer Dialog */}
      <Modal
        isOpen={offerModal.isOpen}
        onClose={() => setOfferModal((prev) => ({ ...prev, isOpen: false }))}
        title="Issue Placement Offer"
        description="Record an official placement offer. An accepted Full-time/PPO offer will update student placement status."
      >
        <form onSubmit={handleIssueOffer} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Candidate *</label>
            <select
              required
              value={offerModal.studentId}
              onChange={(e) => setOfferModal({ ...offerModal, studentId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="">Select Candidate</option>
              {applications.map((app) => (
                <option key={app.student._id} value={app.student._id}>
                  {app.student.name} ({app.student.rollNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Offer Type</label>
              <select
                value={offerModal.type}
                onChange={(e) => setOfferModal({ ...offerModal, type: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {OFFER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">CTC (LPA)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={offerModal.ctcLpa}
                onChange={(e) => setOfferModal({ ...offerModal, ctcLpa: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Policy Override Reason (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Dual-offer policy waiver granted by TPO"
              value={offerModal.overrideReason}
              onChange={(e) => setOfferModal({ ...offerModal, overrideReason: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setOfferModal((prev) => ({ ...prev, isOpen: false }))}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={offerModal.isSubmitting}>
              {offerModal.isSubmitting ? 'Recording...' : 'Issue Offer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 4: Reversal Reason Modal */}
      <Modal
        isOpen={reversalModal.isOpen}
        onClose={() => setReversalModal((prev) => ({ ...prev, isOpen: false }))}
        title="Revert / Cancel Placement Offer"
        description="Declining or revoking an accepted offer will automatically re-evaluate the student's placement status."
      >
        <form onSubmit={handleReverseOffer} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">New Status *</label>
            <select
              value={reversalModal.status}
              onChange={(e) => setReversalModal({ ...reversalModal, status: e.target.value as 'Declined' | 'Revoked' })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="Declined">Declined (Student declined)</option>
              <option value="Revoked">Revoked (Company rescinded)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mandatory Reversal Reason *</label>
            <textarea
              required
              rows={3}
              placeholder="Enter official reason for declining or revoking this offer..."
              value={reversalModal.reason}
              onChange={(e) => setReversalModal({ ...reversalModal, reason: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setReversalModal((prev) => ({ ...prev, isOpen: false }))}>
              Cancel
            </Button>
            <Button
              variant="danger"
              type="submit"
              disabled={reversalModal.reason.trim().length < 5 || reversalModal.isSubmitting}
            >
              {reversalModal.isSubmitting ? 'Reversing...' : 'Confirm Offer Reversal'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
