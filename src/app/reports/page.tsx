'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  BarChart3, 
  Download, 
  FileSpreadsheet, 
  RefreshCw, 
  GraduationCap, 
  Award, 
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  COLLEGE_CONFIG, 
  DEPARTMENT_CODES, 
  DEFAULT_PASSOUT_YEAR, 
  VALID_PASSOUT_YEARS 
} from '@/config/collegeConfig';

type ReportTab = 'placement' | 'training';

interface DepartmentStat {
  department: string;
  totalStudents: number;
  placedStudents: number;
  placementRate: number;
  avgPackageLPA: number;
}

interface CompanyStat {
  companyName: string;
  offersCount: number;
  highestPackageLPA: number;
  avgPackageLPA: number;
}

interface PlacementReportData {
  summary: {
    totalStudents: number;
    placedStudentsCount: number;
    excludedStudentsCount: number;
    eligibleStudents: number;
    placementRate: number;
    totalQualifyingOffers: number;
    avgPackageLPA: number;
    highestPackageLPA: number;
    medianPackageLPA: number;
  };
  departmentBreakdown: DepartmentStat[];
  companyBreakdown: CompanyStat[];
}

interface SessionStat {
  sessionId: string;
  title: string;
  date: string;
  trainer: string;
  totalEligible: number;
  presentCount: number;
  attendanceRate: number;
  feedbackCount: number;
  averageRating: number;
}

interface DefaulterStudent {
  rollNumber: string;
  name: string;
  department: string;
  totalSessions: number;
  attendedSessions: number;
  attendanceRate: number;
}

interface TrainingReportData {
  summary: {
    totalSessions: number;
    totalStudentsEnrolled: number;
    totalAttendanceRecords: number;
    presentAttendanceRecords: number;
    overallAttendanceRate: number;
    defaultersCount: number;
    defaulterRate: number;
    totalFeedbacks: number;
    averageFeedbackRating: number;
  };
  sessionBreakdown: SessionStat[];
  defaultersList: DefaulterStudent[];
}

function getDeptName(code: string): string {
  const found = COLLEGE_CONFIG.academic.departments.find((d) => d.code === code);
  return found?.name || code;
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role || 'TPO';
  const isCoordinator = userRole === 'DEPT_COORDINATOR';
  const coordinatorDept = session?.user?.department;

  const [activeTab, setActiveTab] = useState<ReportTab>('placement');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [batch, setBatch] = useState<string>(DEFAULT_PASSOUT_YEAR.toString());
  const [department, setDepartment] = useState<string>(coordinatorDept || 'all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Report Data
  const [placementData, setPlacementData] = useState<PlacementReportData | null>(null);
  const [trainingData, setTrainingData] = useState<TrainingReportData | null>(null);

  // Sync coordinator department
  useEffect(() => {
    if (isCoordinator && coordinatorDept) {
      setDepartment(coordinatorDept);
    }
  }, [isCoordinator, coordinatorDept]);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (batch) params.set('batch', batch);
      if (department && department !== 'all') params.set('department', department);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const endpoint = activeTab === 'placement' ? '/api/reports/placement' : '/api/reports/training';
      const res = await fetch(`${endpoint}?${params.toString()}`);

      if (!res.ok) {
        throw new Error(`Failed to load report data: ${res.statusText}`);
      }

      const data = await res.json();
      if (activeTab === 'placement') {
        setPlacementData(data);
      } else {
        setTrainingData(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading reports');
    } finally {
      setLoading(false);
    }
  }, [activeTab, batch, department, startDate, endDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleExport = (format: 'csv' | 'excel') => {
    const params = new URLSearchParams();
    if (batch) params.set('batch', batch);
    if (department && department !== 'all') params.set('department', department);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    params.set('format', format);

    const endpoint = activeTab === 'placement' ? '/api/reports/placement' : '/api/reports/training';
    window.open(`${endpoint}?${params.toString()}`, '_blank');
  };

  const handleResetFilters = () => {
    setBatch(DEFAULT_PASSOUT_YEAR.toString());
    setDepartment(isCoordinator && coordinatorDept ? coordinatorDept : 'all');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Institutional Reports & Analytics</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Verified metrics, formula-transparent calculations, and exportable cohorts for DYPCET Training & Placement.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1.5 text-xs text-slate-700"
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('excel')}
              className="flex items-center gap-1.5 text-xs text-blue-700 border-blue-200 bg-blue-50/50 hover:bg-blue-100/50"
            >
              <FileSpreadsheet className="h-4 w-4 text-blue-600" /> Export Excel (.xlsx)
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('placement')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'placement'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Award className="h-4 w-4" /> Placement Analytics & Outcomes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('training')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'training'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <GraduationCap className="h-4 w-4" /> Training & Attendance Analytics
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Batch Selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Graduating Batch
              </label>
              <select
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">All Batches</option>
                {VALID_PASSOUT_YEARS.map((y) => (
                  <option key={y} value={y.toString()}>
                    Class of {y} {y === DEFAULT_PASSOUT_YEAR ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Department
              </label>
              <select
                value={department}
                disabled={isCoordinator}
                onChange={(e) => setDepartment(e.target.value)}
                className={`w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                  isCoordinator ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                }`}
              >
                {!isCoordinator && <option value="all">All Departments (Campus-Wide)</option>}
                {DEPARTMENT_CODES.map((code) => (
                  <option key={code} value={code}>
                    {getDeptName(code)} ({code})
                  </option>
                ))}
              </select>
            </div>

            {/* From Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Refresh & Reset */}
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchReports()}
                disabled={loading}
                className="flex-1 text-xs h-[32px]"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Apply
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs h-[32px] text-slate-500"
              >
                Reset
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* TAB 1: PLACEMENT REPORTS */}
        {activeTab === 'placement' && (
          <div className="space-y-6">
            {/* KPI Cards with On-Screen Definitions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Placement Percentage */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Placement Rate</span>
                    <Badge variant="info" size="sm">Official Formula</Badge>
                  </div>
                  <div className="mt-2 text-2xl font-black text-slate-900">
                    {placementData?.summary?.placementRate ?? '—'}%
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {placementData?.summary?.placedStudentsCount ?? 0} placed of {placementData?.summary?.eligibleStudents ?? 0} eligible
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-start gap-1 text-[10px] text-slate-400">
                  <HelpCircle className="h-3 w-3 shrink-0 mt-0.5 text-blue-500" />
                  <span>Formula: (Placed Students ÷ Eligible Students) × 100 [Excludes Opted Out / Higher Studies]</span>
                </div>
              </div>

              {/* Highest Package */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Highest Package</span>
                    <Badge variant="success" size="sm">LPA</Badge>
                  </div>
                  <div className="mt-2 text-2xl font-black text-emerald-600">
                    ₹{placementData?.summary?.highestPackageLPA ?? '0.00'} LPA
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Top CTC recorded for cohort
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-start gap-1 text-[10px] text-slate-400">
                  <HelpCircle className="h-3 w-3 shrink-0 mt-0.5 text-emerald-500" />
                  <span>Formula: Maximum accepted CTC among Full-time and PPO offers in cohort</span>
                </div>
              </div>

              {/* Average Package */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average Package</span>
                    <Badge variant="purple" size="sm">LPA</Badge>
                  </div>
                  <div className="mt-2 text-2xl font-black text-purple-600">
                    ₹{placementData?.summary?.avgPackageLPA ?? '0.00'} LPA
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Across {placementData?.summary?.totalQualifyingOffers ?? 0} accepted offers
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-start gap-1 text-[10px] text-slate-400">
                  <HelpCircle className="h-3 w-3 shrink-0 mt-0.5 text-purple-500" />
                  <span>Formula: Arithmetic mean of all accepted qualifying offer CTCs (excluding unpaid)</span>
                </div>
              </div>

              {/* Median Package */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Median Package</span>
                    <Badge variant="warning" size="sm">LPA</Badge>
                  </div>
                  <div className="mt-2 text-2xl font-black text-amber-600">
                    ₹{placementData?.summary?.medianPackageLPA ?? '0.00'} LPA
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    50th percentile of cohort
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-start gap-1 text-[10px] text-slate-400">
                  <HelpCircle className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
                  <span>Formula: Middle value of sorted qualifying offers (unaffected by salary outliers)</span>
                </div>
              </div>
            </div>

            {/* Department Breakdown Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Department-Wise Placement Distribution</h3>
                <span className="text-[11px] text-slate-500">
                  {placementData?.departmentBreakdown?.length || 0} Departments Evaluated
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Department</th>
                      <th className="py-2.5 px-4 text-center">Total Students</th>
                      <th className="py-2.5 px-4 text-center">Placed Count</th>
                      <th className="py-2.5 px-4 text-center">Placement Rate</th>
                      <th className="py-2.5 px-4 text-right">Avg Package</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {placementData?.departmentBreakdown?.map((d: DepartmentStat) => (
                      <tr key={d.department} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">
                          {getDeptName(d.department)} ({d.department})
                        </td>
                        <td className="py-2.5 px-4 text-center text-slate-600">{d.totalStudents}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-emerald-600">{d.placedStudents}</td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700">
                            {d.placementRate}%
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium text-slate-900">
                          {d.avgPackageLPA > 0 ? `₹${d.avgPackageLPA} LPA` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Hiring Companies */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Hiring Company Breakdown</h3>
                <span className="text-[11px] text-slate-500">
                  {placementData?.companyBreakdown?.length || 0} Recruiting Partners
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Company Name</th>
                      <th className="py-2.5 px-4 text-center">Accepted Offers</th>
                      <th className="py-2.5 px-4 text-right">Highest Package</th>
                      <th className="py-2.5 px-4 text-right">Average Package</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {placementData?.companyBreakdown?.map((c: CompanyStat) => (
                      <tr key={c.companyName} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{c.companyName}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-blue-600">{c.offersCount}</td>
                        <td className="py-2.5 px-4 text-right text-emerald-600 font-medium">
                          {c.highestPackageLPA > 0 ? `₹${c.highestPackageLPA} LPA` : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-700 font-medium">
                          {c.avgPackageLPA > 0 ? `₹${c.avgPackageLPA} LPA` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TRAINING & ATTENDANCE REPORTS */}
        {activeTab === 'training' && (
          <div className="space-y-6">
            {/* KPI Cards with On-Screen Definitions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Overall Attendance Rate */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overall Attendance</span>
                    <Badge variant="info" size="sm">Institutional %</Badge>
                  </div>
                  <div className="mt-2 text-2xl font-black text-slate-900">
                    {trainingData?.summary?.overallAttendanceRate ?? '—'}%
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {trainingData?.summary?.presentAttendanceRecords ?? 0} present of {trainingData?.summary?.totalAttendanceRecords ?? 0} logs
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-start gap-1 text-[10px] text-slate-400">
                  <HelpCircle className="h-3 w-3 shrink-0 mt-0.5 text-blue-500" />
                  <span>Formula: (Present Attendances ÷ Total Attendance Records Logged) × 100</span>
                </div>
              </div>

              {/* Defaulter Count */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Defaulters</span>
                    <Badge variant="danger" size="sm">&lt; 75% Cutoff</Badge>
                  </div>
                  <div className="mt-2 text-2xl font-black text-rose-600">
                    {trainingData?.summary?.defaultersCount ?? 0} Students
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Defaulter Rate: {trainingData?.summary?.defaulterRate ?? '0'}% of cohort
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-start gap-1 text-[10px] text-slate-400">
                  <HelpCircle className="h-3 w-3 shrink-0 mt-0.5 text-rose-500" />
                  <span>Formula: Students with cumulative attendance below institutional threshold (75%)</span>
                </div>
              </div>

              {/* Total Sessions Conducted */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sessions Conducted</span>
                    <Badge variant="success" size="sm">Completed</Badge>
                  </div>
                  <div className="mt-2 text-2xl font-black text-emerald-600">
                    {trainingData?.summary?.totalSessions ?? 0} Modules
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Technical, Aptitude & Soft Skills
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-start gap-1 text-[10px] text-slate-400">
                  <HelpCircle className="h-3 w-3 shrink-0 mt-0.5 text-emerald-500" />
                  <span>Count of non-deleted training sessions conducted within selected date range</span>
                </div>
              </div>

              {/* Average Student Rating */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Session Rating</span>
                    <Badge variant="warning" size="sm">1-5 Scale</Badge>
                  </div>
                  <div className="mt-2 text-2xl font-black text-amber-600">
                    {trainingData?.summary?.averageFeedbackRating ?? '—'} / 5.0
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Based on {trainingData?.summary?.totalFeedbacks ?? 0} student feedback reviews
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-start gap-1 text-[10px] text-slate-400">
                  <HelpCircle className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
                  <span>Formula: Arithmetic mean of student rating submitted after training completion</span>
                </div>
              </div>
            </div>

            {/* Session Performance Breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Session Delivery & Attendance Summary</h3>
                <span className="text-[11px] text-slate-500">
                  {trainingData?.sessionBreakdown?.length || 0} Sessions Evaluated
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Session Title</th>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Trainer</th>
                      <th className="py-2.5 px-4 text-center">Attendance %</th>
                      <th className="py-2.5 px-4 text-right">Avg Feedback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trainingData?.sessionBreakdown?.map((s: SessionStat) => (
                      <tr key={s.sessionId} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{s.title}</td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">{s.date}</td>
                        <td className="py-2.5 px-4 text-slate-600">{s.trainer}</td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              s.attendanceRate >= 75
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {s.attendanceRate}% ({s.presentCount}/{s.totalEligible})
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium text-amber-600">
                          {s.averageRating > 0 ? `★ ${s.averageRating} / 5` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Defaulter List Table */}
            {trainingData?.defaultersList && trainingData.defaultersList.length > 0 && (
              <div className="bg-white rounded-xl border border-rose-200 shadow-xs overflow-hidden">
                <div className="px-5 py-3 border-b border-rose-100 bg-rose-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                      Attendance Defaulters List (&lt; 75%)
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-rose-700">
                    {trainingData.defaultersList.length} Students At Risk
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-rose-50/20 border-b border-rose-100 text-[10px] font-bold text-rose-800 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Roll Number</th>
                        <th className="py-2.5 px-4">Student Name</th>
                        <th className="py-2.5 px-4">Department</th>
                        <th className="py-2.5 px-4 text-center">Attended / Total</th>
                        <th className="py-2.5 px-4 text-right">Attendance %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-50">
                      {trainingData.defaultersList.map((st: DefaulterStudent) => (
                        <tr key={st.rollNumber} className="hover:bg-rose-50/30">
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{st.rollNumber}</td>
                          <td className="py-2.5 px-4 font-medium text-slate-900">{st.name}</td>
                          <td className="py-2.5 px-4 text-slate-600">{st.department}</td>
                          <td className="py-2.5 px-4 text-center font-mono text-slate-700">
                            {st.attendedSessions} / {st.totalSessions}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-700">
                              {st.attendanceRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
