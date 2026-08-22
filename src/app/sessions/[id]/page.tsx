'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  MessageSquare,
  CheckCircle2,
  XCircle,
  Star,
  AlertCircle,
  Save,
  Send,
  Building2,
  Filter,
  Search,
  CheckCheck
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Student {
  _id: string;
  name: string;
  rollNumber: string;
  branch: string;
  year?: string;
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
}

interface SessionDetailData {
  session: {
    _id: string;
    title: string;
    date: string;
    trainer: string;
    description: string;
  };
  students: Student[];
  attendance: AttendanceRecord[];
  feedback: FeedbackRecord[];
}

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

export default function SessionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<SessionDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Attendance marking states
  const [localAttendance, setLocalAttendance] = useState<Record<string, boolean>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState({ text: '', type: '' });
  const [attendanceDeptFilter, setAttendanceDeptFilter] = useState('all');
  const [attendanceYearFilter, setAttendanceYearFilter] = useState('all');
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');

  // Memoized list of branches for filtering
  const branches = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.students.forEach((s) => {
      if (s.branch) set.add(s.branch);
    });
    return Array.from(set);
  }, [data]);

  // Filtered students for attendance sheet
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

  const markAllVisible = (present: boolean) => {
    setLocalAttendance((prev) => {
      const next = { ...prev };
      filteredStudents.forEach((s) => {
        next[s._id] = present;
      });
      return next;
    });
  };

  // Feedback form states
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [feedbackStudentId, setFeedbackStudentId] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  useEffect(() => {
    if (id) {
      fetchSessionDetails();
    }
  }, [id]);

  async function fetchSessionDetails() {
    try {
      setLoading(true);
      const res = await fetch(`/api/sessions/${id}`);
      if (!res.ok) {
        throw new Error('Failed to load session details');
      }
      const result: SessionDetailData = await res.json();
      setData(result);

      // Initialize local attendance map
      const attendanceMap: Record<string, boolean> = {};
      // 1. Set all students to absent by default
      result.students.forEach((student) => {
        attendanceMap[student._id] = false;
      });
      // 2. Override with existing marked records
      result.attendance.forEach((record) => {
        attendanceMap[record.studentId] = record.present;
      });
      setLocalAttendance(attendanceMap);
      setError('');
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading session details.');
    } finally {
      setLoading(false);
    }
  }

  const toggleAttendance = (studentId: string, isPresent: boolean) => {
    setLocalAttendance((prev) => ({
      ...prev,
      [studentId]: isPresent,
    }));
  };

  const handleSaveAttendance = async () => {
    setSavingAttendance(true);
    setAttendanceMessage({ text: '', type: '' });

    // Format records payload
    const records = Object.entries(localAttendance).map(([studentId, present]) => ({
      studentId,
      present,
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
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save attendance logs');
      }

      setAttendanceMessage({ text: 'Attendance sheet saved successfully!', type: 'success' });
      // Clear message after 3 seconds
      setTimeout(() => setAttendanceMessage({ text: '', type: '' }), 3000);
    } catch (err: any) {
      setAttendanceMessage({ text: err.message || 'An error occurred.', type: 'error' });
    } finally {
      setSavingAttendance(false);
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

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to submit feedback');
      }

      // Reset feedback form
      setComment('');
      setRating(5);
      setFeedbackStudentId('');
      setIsAnonymous(true);

      // Refresh data
      fetchSessionDetails();
    } catch (err: any) {
      setFeedbackError(err.message || 'Server error occurred.');
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
        <p className="text-sm text-slate-500 mt-2 max-w-md">{error || 'Training session details not found.'}</p>
        <Link
          href="/sessions"
          className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sessions
        </Link>
      </div>
    );
  }

  const { session, students, feedback } = data;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link 
          href="/sessions" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Training Sessions
        </Link>
      </div>

      {/* Session Details Header Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-800 leading-snug">{session.title}</h2>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-2">
              <User className="h-4 w-4 text-slate-400" />
              Trainer: <span className="font-semibold text-slate-700">{session.trainer || 'Unassigned'}</span>
            </p>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-slate-400" />
              Scheduled: <span className="font-semibold text-slate-700">
                {new Date(session.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </p>
          </div>
          {session.description && (
            <div className="max-w-md text-xs text-slate-650 bg-slate-50 border border-slate-100 p-4 rounded-xl">
              <span className="font-bold text-slate-800 block mb-1">Session Syllabus / Description:</span>
              {session.description}
            </div>
          )}
        </div>
      </div>

      {/* Attendance & Feedback split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Attendance checklist panel */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 p-6 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Attendance Sheet</h3>
              <p className="text-[11px] text-slate-450 mt-0.5">Toggle student presence status and click Save</p>
            </div>
            <button
              onClick={handleSaveAttendance}
              disabled={savingAttendance}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-sm shadow-blue-500/20"
            >
              <Save className="h-3.5 w-3.5" />
              {savingAttendance ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>

          {/* Filter Toolbar for Attendance */}
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
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs">
              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={attendanceDeptFilter}
                onChange={(e) => setAttendanceDeptFilter(e.target.value)}
                className="bg-transparent text-slate-700 font-medium focus:outline-none text-xs cursor-pointer max-w-[140px] truncate"
              >
                <option value="all">All Depts</option>
                {branches.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 text-xs">
              <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={attendanceYearFilter}
                onChange={(e) => setAttendanceYearFilter(e.target.value)}
                className="bg-transparent text-slate-700 font-medium focus:outline-none text-xs cursor-pointer max-w-[110px] truncate"
              >
                <option value="all">All Years</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Bulk quick actions */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 text-[11px] text-slate-500">
            <span>Showing <strong className="text-slate-700">{filteredStudents.length}</strong> students</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => markAllVisible(true)}
                className="text-emerald-700 hover:text-emerald-800 font-semibold hover:underline cursor-pointer"
              >
                Mark visible Present
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => markAllVisible(false)}
                className="text-red-650 hover:text-red-800 font-semibold hover:underline cursor-pointer"
              >
                Mark visible Absent
              </button>
            </div>
          </div>

          {/* Feedback messages for saving */}
          {attendanceMessage.text && (
            <div className={`p-3 text-xs font-semibold rounded-xl mb-4 ${
              attendanceMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                : 'bg-red-50 text-red-700 border border-red-150'
            }`}>
              {attendanceMessage.text}
            </div>
          )}

          {/* Students list */}
          <div className="flex-1 overflow-y-auto max-h-[460px] pr-1 space-y-2">
            {filteredStudents.length > 0 ? (
              filteredStudents.map((student) => {
                const isPresent = localAttendance[student._id] ?? false;
                return (
                  <div 
                    key={student._id} 
                    className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50/30 transition-colors"
                  >
                    <div className="space-y-0.5 pr-2">
                      <p className="text-xs font-bold text-slate-800">{student.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {student.rollNumber} {student.branch && `• ${student.branch}`}
                      </p>
                    </div>

                    {/* Present/Absent side-by-side toggles */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/50">
                      <button
                        type="button"
                        onClick={() => toggleAttendance(student._id, true)}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                          isPresent 
                            ? 'bg-emerald-600 text-white shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Present
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAttendance(student._id, false)}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                          !isPresent 
                            ? 'bg-red-650 text-white shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Absent
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-200 rounded-xl text-center px-4">
                <p className="text-xs font-semibold text-slate-650">
                  {students.length === 0
                    ? 'No students registered in directory'
                    : 'No matching students found in this department filter'}
                </p>
                {students.length === 0 ? (
                  <Link href="/students" className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700">
                    Register students first
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      setAttendanceDeptFilter('all');
                      setAttendanceSearchQuery('');
                    }}
                    className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    Show all students
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Feedback logs & submission panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Submit Feedback Form */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Log Session Feedback</h3>
            
            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              {feedbackError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs font-medium rounded-lg flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {feedbackError}
                </div>
              )}

              {/* Rating selection (stars) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Rating</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= rating 
                            ? 'text-amber-500 fill-amber-500' 
                            : 'text-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Anonymous check */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="h-4.5 w-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-650">Submit anonymously</span>
                </label>
              </div>

              {/* Student selector if NOT anonymous */}
              {!isAnonymous && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Associate Student</label>
                  <select
                    value={feedbackStudentId}
                    required
                    onChange={(e) => setFeedbackStudentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white"
                  >
                    <option value="">Select student...</option>
                    {students.map((student) => (
                      <option key={student._id} value={student._id}>
                        {student.name} ({student.rollNumber})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Comment text */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Comments</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Share student comments or trainer feedback..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              <button
                type="submit"
                disabled={submittingFeedback}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <Send className="h-3.5 w-3.5" />
                {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </form>
          </div>

          {/* Feedback logs list */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 p-6 flex flex-col">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Feedback History ({feedback.length})</h3>

            <div className="space-y-4 overflow-y-auto max-h-[300px] pr-1">
              {feedback.length > 0 ? (
                feedback.map((f) => (
                  <div key={f._id} className="p-3.5 border border-slate-100 rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-700">
                        {f.studentId ? f.studentId.name : 'Anonymous Student'}
                      </p>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, idx) => (
                          <Star
                            key={idx}
                            className={`h-3 w-3 ${
                              idx < f.rating 
                                ? 'text-amber-500 fill-amber-500' 
                                : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {f.comment && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed italic">
                        "{f.comment}"
                      </p>
                    )}
                    <p className="text-[9px] text-slate-400">
                      Logged on {new Date(f.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 border border-dashed border-slate-200 rounded-xl text-center">
                  <MessageSquare className="h-6 w-6 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No feedback submitted yet</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Be the first to submit a review above.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
