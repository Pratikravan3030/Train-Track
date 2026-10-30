'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Calendar, 
  Star, 
  ArrowRight,
  AlertCircle,
  Plus,
  Sparkles,
  Award,
  CheckCircle2,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import {
  COLLEGE_CONFIG,
  VALID_PASSOUT_YEARS,
  DEFAULT_PASSOUT_YEAR,
  CURRENT_ACADEMIC_YEAR,
} from '@/config/collegeConfig';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonMetric, Skeleton } from '@/components/ui/Skeleton';
import { DepartmentChart, YearDistributionChart, RatingTrendChart } from '@/components/DashboardCharts';

interface UpcomingSession {
  _id: string;
  title: string;
  date: string;
  trainer: string;
}

interface RatingData {
  title: string;
  averageRating: number;
}

interface DeptData {
  department: string;
  students: number;
}

interface YearData {
  year: string;
  students: number;
}

interface StatsData {
  totalStudents: number;
  placedStudents?: number;
  placementRate?: number;
  placementDistribution?: { status: string; count: number }[];
  avgPackageLPA?: number;
  highestPackageLPA?: number;
  selectedBatch?: number | string;
  totalSessions: number;
  totalAttendanceRecords: number;
  overallAttendanceRate: number;
  totalFeedbacks: number;
  averageRating: number;
  departmentDistribution: DeptData[];
  yearDistribution: YearData[];
  sessionRatings: RatingData[];
  upcomingSessions: UpcomingSession[];
  userRole?: string;
  department?: string;
}

export default function Dashboard() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session?.user?.role === 'STUDENT') {
      router.replace('/student/dashboard');
    }
  }, [session?.user?.role, router]);

  const [selectedBatch, setSelectedBatch] = useState<number>(DEFAULT_PASSOUT_YEAR);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async (batchToLoad: number) => {
    try {
      const res = await fetch(`/api/dashboard-stats?batch=${batchToLoad}`);

      if (!res.ok) {
        if (res.status === 401) {
          setError('Session expired. Redirecting to login...');
          setTimeout(() => {
            window.location.href = '/login';
          }, 1200);
          return;
        }

        const errData = await res.json().catch(() => null);
        const serverError = errData?.error ? `: ${errData.error}` : '';
        throw new Error(
          res.status >= 500
            ? `Server error (${res.status})${serverError}. Please check database connection.`
            : `Failed to load dashboard metrics (Status ${res.status})`
        );
      }

      const data = await res.json();
      setStats(data);
      setError('');
    } catch (err: unknown) {
      console.error('[Dashboard fetch error]:', err);
      const message = err instanceof Error ? err.message : 'An error occurred while loading dashboard statistics.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const res = await fetch(`/api/dashboard-stats?batch=${selectedBatch}`);
        if (!res.ok) {
          if (res.status === 401) {
            if (!ignore) setError('Session expired. Redirecting to login...');
            setTimeout(() => {
              window.location.href = '/login';
            }, 1200);
            return;
          }
          const errData = await res.json().catch(() => null);
          const serverError = errData?.error ? `: ${errData.error}` : '';
          throw new Error(
            res.status >= 500
              ? `Server error (${res.status})${serverError}. Please check database connection.`
              : `Request failed (${res.status})`
          );
        }
        const data = await res.json();
        if (!ignore) {
          setStats(data);
          setError('');
        }
      } catch (err: unknown) {
        console.error('[Dashboard fetch error]:', err);
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'An error occurred while loading dashboard statistics.');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    init();
    return () => {
      ignore = true;
    };
  }, [selectedBatch]);

  const handleRetry = () => {
    setLoading(true);
    loadStats(selectedBatch);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonMetric />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 bg-white border border-red-150 rounded-3xl text-center shadow-xs">
        <div className="h-12 w-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-3 border border-red-100">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800">Failed to Load Dashboard</h3>
        <p className="text-xs text-slate-500 mt-1.5 max-w-md leading-relaxed">{error}</p>
        <Button onClick={handleRetry} variant="primary" size="md" className="mt-5">
          Retry Connection
        </Button>
      </div>
    );
  }

  const {
    totalStudents,
    totalSessions,
    overallAttendanceRate,
    averageRating,
    departmentDistribution,
    yearDistribution,
    sessionRatings,
    upcomingSessions,
  } = stats!;

  const isFreshDatabase = totalStudents === 0 && totalSessions === 0;

  return (
    <div className="space-y-8">
      {/* College T&P Header Banner */}
      <div className="p-6 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-950 text-white rounded-3xl shadow-sm border border-blue-900/40 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="warning" size="sm" className="bg-amber-400/20 text-amber-300 border-amber-300/30">
              {COLLEGE_CONFIG.institution.shortName}
            </Badge>
            <Badge variant="info" size="sm" className="bg-blue-400/20 text-blue-200 border-blue-300/30">
              AY {CURRENT_ACADEMIC_YEAR}
            </Badge>
            <span className="text-xs text-blue-200 font-medium">Kasaba Bawada, Kolhapur</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
            {COLLEGE_CONFIG.tpCell.headerTitle}
          </h2>
          <p className="text-xs text-blue-200/90 max-w-xl">
            Real-time tracking of student eligibility, department distributions, training sessions, and placement metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-2">
            <span className="text-[11px] font-bold text-blue-200">Batch:</span>
            <select
              aria-label="Filter Dashboard by Batch"
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(Number(e.target.value))}
              className="bg-white text-slate-900 text-xs font-bold rounded-lg px-2 py-1 focus:outline-hidden cursor-pointer"
            >
              {VALID_PASSOUT_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y} {y === DEFAULT_PASSOUT_YEAR ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>
          <Link href="/students">
            <Button variant="primary" size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Student
            </Button>
          </Link>
          <Link href="/sessions">
            <Button variant="outline" size="sm" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
              <Calendar className="h-3.5 w-3.5 mr-1" />
              Schedule Session
            </Button>
          </Link>
        </div>
      </div>

      {/* Fresh Database Welcome Onboarding */}
      {isFreshDatabase && (
        <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-800">Fresh T&P Database Connected</h3>
            </div>
            <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
              Your database is clean and authenticated. Begin by adding student records or scheduling your first training module to populate live statistics.
            </p>
          </div>
          <Link href="/students">
            <Button variant="primary" size="sm">
              Register First Student
            </Button>
          </Link>
        </div>
      )}

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Enrolled</span>
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{totalStudents}</span>
            <span className="text-[11px] text-slate-400 font-semibold">Students</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Across all departments</p>
        </div>

        {/* Training Sessions */}
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Training Modules</span>
            <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{totalSessions}</span>
            <span className="text-[11px] text-slate-400 font-semibold">Conducted</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Skill & aptitude workshops</p>
        </div>

        {/* Overall Attendance Rate */}
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance Rate</span>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{overallAttendanceRate}%</span>
            <span className="text-[11px] text-emerald-600 font-bold">Verified</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Across training sessions</p>
        </div>

        {/* Average Session Feedback */}
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average Rating</span>
            <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{averageRating.toFixed(2)}</span>
            <span className="text-[11px] text-slate-400 font-semibold">/ 5.0</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Student evaluation average</p>
        </div>
      </div>

      {/* Placement Drives & Package KPIs */}
      <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Placement Analytics (Batch {stats?.selectedBatch || selectedBatch})
            </h3>
          </div>
          <Link href="/students">
            <Badge variant="info" size="sm" className="cursor-pointer hover:bg-blue-100">
              Manage Placements &rarr;
            </Badge>
          </Link>
        </div>

        {stats?.placedStudents && stats.placedStudents > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
              <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Placed Students</div>
              <div className="mt-1 text-2xl font-black text-emerald-950">
                {stats.placedStudents} <span className="text-xs font-semibold text-emerald-600">/ {totalStudents}</span>
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">Successful campus offers</p>
            </div>

            <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-2xl">
              <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Placement Rate</div>
              <div className="mt-1 text-2xl font-black text-blue-950">
                {stats.placementRate}%
              </div>
              <p className="text-[11px] text-blue-700 mt-0.5">Cohort placement percentage</p>
            </div>

            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl">
              <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Average CTC</div>
              <div className="mt-1 text-2xl font-black text-indigo-950">
                {stats.avgPackageLPA ? `${stats.avgPackageLPA} LPA` : '—'}
              </div>
              <p className="text-[11px] text-indigo-700 mt-0.5">Average salary package</p>
            </div>

            <div className="p-4 bg-purple-50/60 border border-purple-100 rounded-2xl">
              <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Highest Package</div>
              <div className="mt-1 text-2xl font-black text-purple-950">
                {stats.highestPackageLPA ? `${stats.highestPackageLPA} LPA` : '—'}
              </div>
              <p className="text-[11px] text-purple-700 mt-0.5">Peak compensation offer</p>
            </div>
          </div>
        ) : (
          <div className="py-6 px-4 rounded-2xl bg-slate-50/60 border border-dashed border-slate-200 text-center flex flex-col items-center justify-center">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
              <Award className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold text-slate-800">
              No students marked as placed yet for Batch {stats?.selectedBatch || selectedBatch}
            </p>
            <p className="text-[11px] text-slate-500 max-w-md mt-1 leading-relaxed">
              TPO and Administrators can update student placement offers, record CTC packages, and manage status transitions in the Student Directory.
            </p>
            <Link href="/students" className="mt-3">
              <Button variant="outline" size="sm" className="text-xs">
                Open Student Directory
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Distribution Chart */}
        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Department Distribution</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Live student enrollment count per engineering department</p>
            </div>
            <Link href="/students" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <DepartmentChart data={departmentDistribution} />
        </div>

        {/* Academic Year Distribution Chart */}
        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Year-wise Batch Trend</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Students enrolled across 1st, 2nd, 3rd, and 4th years</p>
            </div>
            <Badge variant="purple" size="sm">
              Batch Cohort
            </Badge>
          </div>
          <YearDistributionChart data={yearDistribution} />
        </div>
      </div>

      {/* Rating Analytics & Upcoming Sessions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session Satisfaction Trend */}
        <div className="lg:col-span-2 p-6 bg-white rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Training Session Feedback Trend</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Average qualitative rating received per training module</p>
            </div>
            <Link href="/feedback" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <span>Feedback Logs</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <RatingTrendChart data={sessionRatings} />
        </div>

        {/* Upcoming Sessions Widget */}
        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Upcoming Schedule</h3>
              <Link href="/sessions" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                View All
              </Link>
            </div>

            {upcomingSessions.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No Upcoming Sessions"
                description="No upcoming workshops or aptitude sessions are currently scheduled."
                action={
                  <Link href="/sessions">
                    <Button variant="outline" size="sm">
                      Schedule Now
                    </Button>
                  </Link>
                }
                className="py-8 border-none shadow-none"
              />
            ) : (
              <div className="divide-y divide-slate-100 mt-2">
                {upcomingSessions.map((session) => (
                  <div key={session._id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/sessions/${session._id}`}
                        className="text-xs font-bold text-slate-800 hover:text-blue-600 truncate block"
                      >
                        {session.title}
                      </Link>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        Trainer: {session.trainer || 'T&P Cell'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 shrink-0">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(session.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link href="/sessions" className="block pt-2">
            <Button variant="outline" size="sm" className="w-full">
              Manage Sessions Calendar
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
