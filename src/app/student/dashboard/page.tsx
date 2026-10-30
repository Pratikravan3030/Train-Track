'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Calendar,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Bell,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface StudentProfileData {
  student: {
    _id: string;
    name: string;
    rollNumber: string;
    department: string;
    passoutYear: number;
    cgpa?: number;
    backlogs?: number;
    placementStatus?: string;
    tier?: string;
    email?: string;
  };
  completeness?: {
    percentage: number;
    recommendations?: string[];
  };
  offers?: Array<{
    _id: string;
    status: string;
  }>;
  attendanceSummary?: {
    totalSessions: number;
    attendedSessions: number;
    attendancePercentage: number;
  };
}

interface StudentDriveSummary {
  _id: string;
  title: string;
  company?: { name: string };
  role: string;
  packageLPA?: number;
  deadlineDate?: string;
  isEligible: boolean;
}

interface StudentSessionSummary {
  _id: string;
  title: string;
  date: string;
  trainer?: string;
  venue?: string;
  hasAttended: boolean;
}

interface NoticeItem {
  _id: string;
  title: string;
  content: string;
  createdAt: string;
}

export default function StudentDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [portalDisabled, setPortalDisabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [profileData, setProfileData] = useState<StudentProfileData | null>(null);
  const [drives, setDrives] = useState<StudentDriveSummary[]>([]);
  const [sessions, setSessions] = useState<StudentSessionSummary[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const [profileRes, drivesRes, sessionsRes, noticesRes] = await Promise.all([
          fetch('/api/student/profile'),
          fetch('/api/student/drives'),
          fetch('/api/student/sessions'),
          fetch('/api/student/notices'),
        ]);

        if (profileRes.status === 403 || drivesRes.status === 403) {
          if (mounted) {
            setPortalDisabled(true);
            setLoading(false);
          }
          return;
        }

        if (!profileRes.ok) {
          const err = await profileRes.json();
          throw new Error(err.error || 'Failed to load profile data');
        }

        const [pData, dData, sData, nData] = await Promise.all([
          profileRes.json(),
          drivesRes.ok ? drivesRes.json() : { drives: [] },
          sessionsRes.ok ? sessionsRes.json() : { sessions: [] },
          noticesRes.ok ? noticesRes.json() : { notices: [] },
        ]);

        if (mounted) {
          setProfileData(pData);
          setDrives(dData.drives || []);
          setSessions(sData.sessions || []);
          setNotices(nData.notices || []);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (mounted) {
          setErrorMessage(err instanceof Error ? err.message : 'Error loading dashboard');
          setLoading(false);
        }
      }
    }

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">Loading student dashboard...</p>
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

  if (errorMessage || !profileData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 bg-white border border-red-200 rounded-3xl text-center shadow-xs">
        <AlertCircle className="h-10 w-10 text-red-600 mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Unable to Load Dashboard</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-md">{errorMessage || 'Student data not available'}</p>
      </div>
    );
  }

  const { student, completeness, offers, attendanceSummary } = profileData;
  const upcomingDrives = drives.slice(0, 3);
  const upcomingSessions = sessions.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-600/60 border border-blue-400/30">
              {student.department} • Batch {student.passoutYear}
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-600/60 border border-blue-400/30">
              PRN: {student.rollNumber}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome, {student.name}
          </h1>
          <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
            Track your placement drives, verify attendance in training sessions, and keep your career profile up-to-date.
          </p>
        </div>
      </div>

      {/* Profile Completeness Bar */}
      {completeness && completeness.percentage < 100 && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-800">Profile Completeness: {completeness.percentage}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${completeness.percentage}%` }}
              />
            </div>
            {completeness.recommendations && completeness.recommendations.length > 0 && (
              <p className="text-[11px] text-slate-500 truncate">
                Missing: {completeness.recommendations.slice(0, 2).join(', ')}
              </p>
            )}
          </div>
          <Link href="/student/profile">
            <Button variant="outline" size="sm" className="whitespace-nowrap shrink-0">
              Update Profile <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Quick Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500">CGPA</span>
          <p className="text-2xl font-black text-slate-800 mt-1">{student.cgpa ? student.cgpa.toFixed(2) : 'N/A'}</p>
          <span className="text-[10px] text-slate-400">Backlogs: {student.backlogs ?? 0}</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500">Attendance Rate</span>
          <p className="text-2xl font-black text-slate-800 mt-1">
            {attendanceSummary?.attendancePercentage ?? 0}%
          </p>
          <span className="text-[10px] text-slate-400">
            {attendanceSummary?.attendedSessions ?? 0} / {attendanceSummary?.totalSessions ?? 0} sessions
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500">Placement Status</span>
          <div className="mt-1">
            <Badge
              variant={student.placementStatus === 'Placed' ? 'success' : 'neutral'}
              size="md"
            >
              {student.placementStatus || 'Not Placed'}
            </Badge>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Tier: {student.tier || 'None'}</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500">Offers Received</span>
          <p className="text-2xl font-black text-slate-800 mt-1">{offers?.length ?? 0}</p>
          <span className="text-[10px] text-slate-400">
            {offers?.filter((o) => o.status === 'Accepted').length ?? 0} accepted
          </span>
        </div>
      </div>

      {/* Two Column Layout: Placement Drives & Training Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Placement Drives Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-800">Active Placement Drives</h2>
              </div>
              <Link href="/student/drives" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                View All ({drives.length})
              </Link>
            </div>

            {upcomingDrives.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No active placement drives at this time.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 mt-2">
                {upcomingDrives.map((d) => (
                  <div key={d._id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{d.company?.name || d.title}</p>
                      <p className="text-[11px] text-slate-500">{d.role} • {d.packageLPA ? `${d.packageLPA} LPA` : 'Best in Industry'}</p>
                      {d.deadlineDate && (
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" /> Deadline: {new Date(d.deadlineDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Badge variant={d.isEligible ? 'success' : 'neutral'} size="sm">
                      {d.isEligible ? 'Eligible' : 'Not Eligible'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Link href="/student/drives" className="mt-4">
            <Button variant="outline" size="sm" className="w-full">
              Explore All Drives <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        {/* Training Sessions Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-800">Training & Skill Schedule</h2>
              </div>
              <Link href="/student/sessions" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                View All ({sessions.length})
              </Link>
            </div>

            {upcomingSessions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No training sessions scheduled.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 mt-2">
                {upcomingSessions.map((s) => (
                  <div key={s._id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{s.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {s.trainer || 'T&P Trainer'} • {new Date(s.date).toLocaleDateString()}
                      </p>
                      {s.venue && <p className="text-[10px] text-slate-400">Venue: {s.venue}</p>}
                    </div>
                    <Badge variant={s.hasAttended ? 'success' : 'neutral'} size="sm">
                      {s.hasAttended ? 'Attended' : 'Upcoming'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Link href="/student/sessions" className="mt-4">
            <Button variant="outline" size="sm" className="w-full">
              View Training Calendar <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Announcements / Notices Section */}
      {notices.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-3">
            <Bell className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-800">Notices & Circulars</h2>
          </div>
          <div className="space-y-3">
            {notices.map((notice) => (
              <div
                key={notice._id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-slate-800">{notice.title}</h3>
                  <span className="text-[10px] text-slate-400">
                    {new Date(notice.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                  {notice.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
