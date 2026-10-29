'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Star,
  AlertCircle,
  Save,
  Send,
  Building2,
  Filter,
  Search,
  MapPin,
  QrCode,
  Copy,
  CheckCircle2,
  Upload,
  GraduationCap
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastContext';

interface Student {
  _id: string;
  name: string;
  rollNumber: string;
  branch: string;
  year?: string;
  passoutYear?: number;
}

interface FeedbackRecord {
  _id: string;
  studentId: {
    name: string;
    rollNumber: string;
  } | null;
  rating: number;
  comment: string;
  createdAt: string;
}

interface AttendanceRecord {
  studentId: string;
  present: boolean;
  status?: 'Present' | 'Absent' | 'Late' | 'Excused';
  remarks?: string;
}

interface AssessmentSummary {
  _id: string;
  title: string;
  maxMarks: number;
  passingMarks: number;
  studentCount: number;
  averageScore: number;
  passPercentage: number;
  scores: Array<{
    student: {
      _id: string;
      name: string;
      rollNumber: string;
      department?: string;
    };
    marksObtained: number;
    percentage: number;
    passed: boolean;
  }>;
}

interface SessionDetailData {
  session: {
    _id: string;
    title: string;
    date: string;
    trainer?: string;
    description?: string;
    category?: string;
    targetDepartments?: string[];
    venue?: string;
    checkInCode?: string;
    checkInCodeExpiresAt?: string;
  };
  students: Student[];
  attendance: AttendanceRecord[];
  feedback: FeedbackRecord[];
}

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

export default function SessionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'attendance' | 'assessments'>('attendance');
  const [data, setData] = useState<SessionDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Check-in code states
  const [checkInCode, setCheckInCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Attendance states
  const [localStatuses, setLocalStatuses] = useState<Record<string, 'Present' | 'Absent' | 'Late' | 'Excused'>>({});
  const [localRemarks, setLocalRemarks] = useState<Record<string, string>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState({ text: '', type: '' });
  const [attendanceDeptFilter, setAttendanceDeptFilter] = useState('all');
  const [attendanceYearFilter, setAttendanceYearFilter] = useState('all');
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');

  // Assessment states
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTitle, setImportTitle] = useState('');
  const [importMaxMarks, setImportMaxMarks] = useState(100);
  const [importPassingMarks, setImportPassingMarks] = useState(40);
  const [importCsv, setImportCsv] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentSummary | null>(null);

  // Feedback states
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [feedbackStudentId, setFeedbackStudentId] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  const branches = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.students.forEach((s) => {
      if (s.branch) set.add(s.branch);
    });
    return Array.from(set);
  }, [data]);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    return data.students.filter((student) => {
      const matchDept = attendanceDeptFilter === 'all' || student.branch === attendanceDeptFilter;
      const matchYear = attendanceYearFilter === 'all' || student.year === attendanceYearFilter;
      const q = attendanceSearchQuery.toLowerCase().trim();
      const matchQuery = !q || student.name.toLowerCase().includes(q) || student.rollNumber.toLowerCase().includes(q);
      return matchDept && matchYear && matchQuery;
    });
  }, [data, attendanceDeptFilter, attendanceYearFilter, attendanceSearchQuery]);

  const loadSessionDetails = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/sessions/${id}`);

      if (!res.ok) {
        if (res.status === 401) {
          setError('Session expired. Redirecting to login...');
          setTimeout(() => {
            window.location.href = '/login';
          }, 1200);
          return;
        }
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Failed to load session details (${res.status})`);
      }

      const result: SessionDetailData = await res.json();
      setData(result);

      if (result.session.checkInCode && result.session.checkInCodeExpiresAt) {
        const expires = new Date(result.session.checkInCodeExpiresAt).getTime();
        if (expires > Date.now()) {
          setCheckInCode(result.session.checkInCode);
          setCodeExpiresAt(result.session.checkInCodeExpiresAt);
        }
      }

      const statusMap: Record<string, 'Present' | 'Absent' | 'Late' | 'Excused'> = {};
      const remarksMap: Record<string, string> = {};

      result.students.forEach((student) => {
        statusMap[student._id] = 'Absent';
      });

      result.attendance.forEach((record) => {
        statusMap[record.studentId] = record.status || (record.present ? 'Present' : 'Absent');
        if (record.remarks) remarksMap[record.studentId] = record.remarks;
      });

      setLocalStatuses(statusMap);
      setLocalRemarks(remarksMap);
      setError('');
    } catch (err: unknown) {
      console.error('[SessionDetailPage fetch error]:', err);
      const message = err instanceof Error ? err.message : 'An error occurred while loading session details.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadAssessments = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingAssessments(true);
      const res = await fetch(`/api/sessions/${id}/assessments`);
      if (res.ok) {
        const data = await res.json();
        setAssessments(data.assessments || []);
        if (data.assessments && data.assessments.length > 0 && !selectedAssessment) {
          setSelectedAssessment(data.assessments[0]);
        }
      }
    } catch (err) {
      console.error('[Assessments fetch error]:', err);
    } finally {
      setLoadingAssessments(false);
    }
  }, [id, selectedAssessment]);

  useEffect(() => {
    loadSessionDetails();
  }, [loadSessionDetails]);

  useEffect(() => {
    if (activeTab === 'assessments') {
      loadAssessments();
    }
  }, [activeTab, loadAssessments]);

  // Attendance metrics
  const attendanceStats = useMemo(() => {
    if (!data) return { present: 0, late: 0, excused: 0, absent: 0, total: 0, percentage: 0 };
    const values = Object.values(localStatuses);
    const present = values.filter((v) => v === 'Present').length;
    const late = values.filter((v) => v === 'Late').length;
    const excused = values.filter((v) => v === 'Excused').length;
    const absent = values.filter((v) => v === 'Absent').length;
    const total = data.students.length;
    const effectivePresent = present + late;
    const percentage = total > 0 ? Math.round((effectivePresent / total) * 100) : 0;
    return { present, late, excused, absent, total, percentage };
  }, [data, localStatuses]);

  const handleGenerateCode = async () => {
    try {
      setGeneratingCode(true);
      const res = await fetch(`/api/sessions/${id}/check-in-code`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate check-in code');

      setCheckInCode(data.code);
      setCodeExpiresAt(data.expiresAt);
      toast.success(`Check-in code generated: ${data.code} (Valid for 15 minutes)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error generating code';
      toast.error(msg);
    } finally {
      setGeneratingCode(false);
    }
  };

  const copyToClipboard = () => {
    if (!checkInCode) return;
    navigator.clipboard.writeText(checkInCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const setStudentStatus = (studentId: string, status: 'Present' | 'Absent' | 'Late' | 'Excused') => {
    setLocalStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const setStudentRemark = (studentId: string, remark: string) => {
    setLocalRemarks((prev) => ({ ...prev, [studentId]: remark }));
  };

  const markAllVisible = (status: 'Present' | 'Absent') => {
    setLocalStatuses((prev) => {
      const next = { ...prev };
      filteredStudents.forEach((s) => {
        next[s._id] = status;
      });
      return next;
    });
  };

  const handleSaveAttendance = async () => {
    setSavingAttendance(true);
    setAttendanceMessage({ text: '', type: '' });

    const records = Object.entries(localStatuses).map(([studentId, status]) => ({
      studentId,
      status,
      remarks: localRemarks[studentId] || undefined,
    }));

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: id,
          records,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to save attendance logs');
      }

      setAttendanceMessage({ text: 'Attendance saved successfully!', type: 'success' });
      toast.success('Attendance records synced.');
      setTimeout(() => setAttendanceMessage({ text: '', type: '' }), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred.';
      setAttendanceMessage({ text: message, type: 'error' });
      toast.error(message);
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleImportAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importTitle.trim() || !importCsv.trim()) {
      setImportError('Please provide title and CSV content');
      return;
    }
    setImporting(true);
    setImportError('');

    try {
      const res = await fetch(`/api/sessions/${id}/assessments/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: importTitle,
          maxMarks: Number(importMaxMarks),
          passingMarks: Number(importPassingMarks),
          csvContent: importCsv,
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to import assessment');

      toast.success(`Imported ${resData.createdCount} student scores!`);
      setIsImportModalOpen(false);
      setImportTitle('');
      setImportCsv('');
      loadAssessments();
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError('');
    setSubmittingFeedback(true);

    const payload = {
      sessionId: id,
      studentId: isAnonymous ? null : feedbackStudentId || null,
      rating,
      comment: comment.trim(),
    };

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => null);
      if (!res.ok) throw new Error(resData?.error || 'Failed to submit feedback');

      setComment('');
      setRating(5);
      setFeedbackStudentId('');
      setIsAnonymous(true);
      toast.success('Feedback logged.');
      loadSessionDetails();
    } catch (err: unknown) {
      setFeedbackError(err instanceof Error ? err.message : 'Server error');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 bg-white border border-red-100 rounded-2xl text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-slate-800">Failed to Load Session</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-md">{error || 'Session details not found.'}</p>
        <Link
          href="/sessions"
          className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition"
        >
          Back to Sessions
        </Link>
      </div>
    );
  }

  const { session, feedback } = data;

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link 
          href="/sessions" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Training Sessions
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'attendance'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Attendance & Feedback
          </button>
          <button
            onClick={() => setActiveTab('assessments')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'assessments'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Assessments & Scores ({assessments.length})
          </button>
        </div>
      </div>

      {/* Session Details Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-800">{session.title}</h2>
              {session.category && (
                <Badge variant="purple" size="sm">
                  {session.category}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {new Date(session.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-400" />
                Trainer: <strong className="text-slate-700">{session.trainer || 'Unassigned'}</strong>
              </span>
              {session.venue && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  Venue: <strong className="text-slate-700">{session.venue}</strong>
                </span>
              )}
            </div>

            {session.targetDepartments && session.targetDepartments.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1">
                <span>Target Depts:</span>
                {session.targetDepartments.map((d) => (
                  <span key={d} className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-mono text-[11px]">
                    {d}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Time-limited Check-in Code Box */}
          <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/50 border border-indigo-100 p-4 rounded-2xl flex flex-col items-center justify-center min-w-[240px]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
              <QrCode className="h-3.5 w-3.5" />
              Student Check-in Code
            </span>
            {checkInCode ? (
              <div className="mt-2 text-center space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-black font-mono tracking-widest text-indigo-900 bg-white px-3 py-1 rounded-xl border border-indigo-200 shadow-inner">
                    {checkInCode}
                  </span>
                  <button
                    onClick={copyToClipboard}
                    className="p-1.5 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 text-indigo-600 transition"
                    title="Copy code"
                  >
                    {copiedCode ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-indigo-600 font-medium">
                  {codeExpiresAt ? `Expires ${new Date(codeExpiresAt).toLocaleTimeString()}` : 'Active'}
                </p>
              </div>
            ) : (
              <button
                onClick={handleGenerateCode}
                disabled={generatingCode}
                className="mt-2.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {generatingCode ? 'Generating...' : 'Generate 15-Min Code'}
              </button>
            )}
          </div>
        </div>

        {/* Attendance Summary Stat Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-slate-100 text-center">
          <div className="p-2.5 bg-slate-50 rounded-xl">
            <span className="text-[11px] text-slate-500 font-medium block">Total Roster</span>
            <span className="text-base font-bold text-slate-800">{attendanceStats.total}</span>
          </div>
          <div className="p-2.5 bg-emerald-50/60 rounded-xl">
            <span className="text-[11px] text-emerald-700 font-medium block">Present</span>
            <span className="text-base font-bold text-emerald-700">{attendanceStats.present}</span>
          </div>
          <div className="p-2.5 bg-amber-50/60 rounded-xl">
            <span className="text-[11px] text-amber-700 font-medium block">Late</span>
            <span className="text-base font-bold text-amber-700">{attendanceStats.late}</span>
          </div>
          <div className="p-2.5 bg-blue-50/60 rounded-xl">
            <span className="text-[11px] text-blue-700 font-medium block">Excused</span>
            <span className="text-base font-bold text-blue-700">{attendanceStats.excused}</span>
          </div>
          <div className="p-2.5 bg-indigo-50 rounded-xl">
            <span className="text-[11px] text-indigo-700 font-medium block">Attendance %</span>
            <span className="text-base font-extrabold text-indigo-700">{attendanceStats.percentage}%</span>
          </div>
        </div>
      </div>

      {activeTab === 'attendance' ? (
        /* Attendance & Feedback Section */
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Attendance Checklist Panel */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Attendance Sheet</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Update candidate status (Present, Late, Excused, Absent) and save changes
                </p>
              </div>
              <button
                onClick={handleSaveAttendance}
                disabled={savingAttendance}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition disabled:opacity-50 cursor-pointer shadow-sm shadow-blue-500/20"
              >
                <Save className="h-3.5 w-3.5" />
                {savingAttendance ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                  <Search className="h-3.5 w-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="Search students..."
                  value={attendanceSearchQuery}
                  onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                />
              </div>
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs">
                <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <select
                  value={attendanceDeptFilter}
                  onChange={(e) => setAttendanceDeptFilter(e.target.value)}
                  className="bg-transparent text-slate-700 font-medium text-xs max-w-[140px] truncate"
                >
                  <option value="all">All Depts</option>
                  {branches.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs">
                <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <select
                  value={attendanceYearFilter}
                  onChange={(e) => setAttendanceYearFilter(e.target.value)}
                  className="bg-transparent text-slate-700 font-medium text-xs max-w-[110px] truncate"
                >
                  <option value="all">All Years</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bulk Actions */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 text-[11px] text-slate-500">
              <span>Showing <strong className="text-slate-700">{filteredStudents.length}</strong> students</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => markAllVisible('Present')}
                  className="text-emerald-700 hover:text-emerald-800 font-semibold hover:underline cursor-pointer"
                >
                  Mark visible Present
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => markAllVisible('Absent')}
                  className="text-red-600 hover:text-red-700 font-semibold hover:underline cursor-pointer"
                >
                  Mark visible Absent
                </button>
              </div>
            </div>

            {attendanceMessage.text && (
              <div className={`p-3 text-xs font-semibold rounded-xl mb-4 ${
                attendanceMessage.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {attendanceMessage.text}
              </div>
            )}

            {/* Student Roster */}
            <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 space-y-2">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => {
                  const currentStatus = localStatuses[student._id] || 'Absent';
                  return (
                    <div 
                      key={student._id} 
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50/50 gap-2"
                    >
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-800">{student.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {student.rollNumber} {student.branch && `• ${student.branch}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={currentStatus}
                          onChange={(e) => setStudentStatus(student._id, e.target.value as 'Present' | 'Absent' | 'Late' | 'Excused')}
                          className={`text-xs font-bold rounded-lg px-2.5 py-1 border transition ${
                            currentStatus === 'Present'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : currentStatus === 'Late'
                              ? 'bg-amber-50 text-amber-700 border-amber-300'
                              : currentStatus === 'Excused'
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          <option value="Present">Present</option>
                          <option value="Late">Late</option>
                          <option value="Excused">Excused</option>
                          <option value="Absent">Absent</option>
                        </select>

                        {(currentStatus === 'Late' || currentStatus === 'Excused') && (
                          <input
                            type="text"
                            placeholder="Reason / remarks..."
                            value={localRemarks[student._id] || ''}
                            onChange={(e) => setStudentRemark(student._id, e.target.value)}
                            className="px-2 py-1 text-xs border border-slate-200 rounded-lg max-w-[130px]"
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-16 text-center text-xs text-slate-500">
                  No students found matching filters.
                </div>
              )}
            </div>
          </div>

          {/* Feedback Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Log Session Feedback</h3>
              <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                {feedbackError && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs font-medium rounded-lg flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {feedbackError}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Rating</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-1 hover:scale-110 transition cursor-pointer"
                      >
                        <Star
                          className={`h-5 w-5 ${
                            star <= rating ? 'text-amber-500 fill-amber-500' : 'text-slate-200'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span className="text-xs font-semibold text-slate-600">Submit anonymously</span>
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Comments</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Feedback regarding trainer content, pacing, or student engagement..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </form>
            </div>

            {/* Feedback History */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Feedback History ({feedback.length})</h3>
              <div className="space-y-3 overflow-y-auto max-h-[300px] pr-1">
                {feedback.length > 0 ? (
                  feedback.map((f) => (
                    <div key={f._id} className="p-3 border border-slate-100 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">
                          {f.studentId ? f.studentId.name : 'Anonymous Student'}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, idx) => (
                            <Star
                              key={idx}
                              className={`h-3 w-3 ${
                                idx < f.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {f.comment && (
                        <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg">
                          &ldquo;{f.comment}&rdquo;
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">No feedback submitted yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Assessments Tab */
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Session Assessments & Marks</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Import assessment results from CSV or view student performance benchmarks.
              </p>
            </div>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-sm cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              Import Scores (CSV)
            </button>
          </div>

          {loadingAssessments ? (
            <div className="py-16 text-center text-xs text-slate-500">Loading assessments...</div>
          ) : assessments.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 p-8">
              <GraduationCap className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">No assessments recorded for this session</h4>
              <p className="text-xs text-slate-500 mt-1">
                Click &ldquo;Import Scores (CSV)&rdquo; to upload quiz, coding test, or mock interview scores.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Assessments sidebar list */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2 mb-2">Assessments</h4>
                {assessments.map((a) => (
                  <button
                    key={a._id}
                    onClick={() => setSelectedAssessment(a)}
                    className={`w-full text-left p-3 rounded-xl transition text-xs ${
                      selectedAssessment?._id === a._id
                        ? 'bg-blue-50 border border-blue-200 text-blue-900 font-bold'
                        : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                    }`}
                  >
                    <div className="font-bold">{a.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
                      <span>Max: {a.maxMarks}</span>
                      <span>Pass: {a.passPercentage}%</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Assessment details & scores roster */}
              <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
                {selectedAssessment && (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                      <div>
                        <h4 className="text-base font-bold text-slate-800">{selectedAssessment.title}</h4>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span>Max Marks: <strong>{selectedAssessment.maxMarks}</strong></span>
                          <span>Passing Marks: <strong>{selectedAssessment.passingMarks}</strong></span>
                          <span>Students Tested: <strong>{selectedAssessment.studentCount}</strong></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div className="p-2 bg-emerald-50 rounded-xl px-3">
                          <span className="text-[10px] text-emerald-700 font-bold block">Pass Rate</span>
                          <span className="text-sm font-black text-emerald-700">{selectedAssessment.passPercentage}%</span>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-xl px-3">
                          <span className="text-[10px] text-blue-700 font-bold block">Average Score</span>
                          <span className="text-sm font-black text-blue-700">{selectedAssessment.averageScore}</span>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[460px] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                          <tr>
                            <th className="p-2.5">Roll Number</th>
                            <th className="p-2.5">Student Name</th>
                            <th className="p-2.5">Department</th>
                            <th className="p-2.5 text-center">Score</th>
                            <th className="p-2.5 text-center">%</th>
                            <th className="p-2.5 text-center">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {selectedAssessment.scores.map((sc, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2.5 font-mono text-[11px] font-semibold">
                                {sc.student?.rollNumber || 'N/A'}
                              </td>
                              <td className="p-2.5 font-medium">{sc.student?.name || 'Unknown'}</td>
                              <td className="p-2.5">{sc.student?.department || '-'}</td>
                              <td className="p-2.5 text-center font-bold">
                                {sc.marksObtained} / {selectedAssessment.maxMarks}
                              </td>
                              <td className="p-2.5 text-center">{sc.percentage}%</td>
                              <td className="p-2.5 text-center">
                                <Badge variant={sc.passed ? 'success' : 'danger'} size="sm">
                                  {sc.passed ? 'PASS' : 'FAIL'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Assessment Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Assessment Scores (CSV)"
      >
        <form onSubmit={handleImportAssessment} className="space-y-4">
          {importError && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-medium rounded-lg flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {importError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Assessment Title *</label>
            <input
              type="text"
              required
              value={importTitle}
              onChange={(e) => setImportTitle(e.target.value)}
              placeholder="e.g. DSA Quiz 1 / Mock Technical Assessment"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Max Marks *</label>
              <input
                type="number"
                required
                min={1}
                value={importMaxMarks}
                onChange={(e) => setImportMaxMarks(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Passing Marks *</label>
              <input
                type="number"
                required
                min={0}
                value={importPassingMarks}
                onChange={(e) => setImportPassingMarks(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-600">CSV Data *</label>
              <span className="text-[10px] text-slate-400 font-mono">Format: rollNumber,marks</span>
            </div>
            <textarea
              required
              rows={6}
              value={importCsv}
              onChange={(e) => setImportCsv(e.target.value)}
              placeholder={`rollNumber,marks\n21CS001,85\n21CS002,72\n21CS003,38`}
              className="w-full font-mono text-xs px-3.5 py-2 rounded-xl border border-slate-200"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={importing}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition disabled:opacity-50"
            >
              {importing ? 'Importing Scores...' : 'Import Scores'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
