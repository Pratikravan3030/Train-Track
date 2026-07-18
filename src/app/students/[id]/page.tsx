'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  MessageSquare,
  CheckCircle2,
  XCircle,
  Star,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface SessionDetails {
  _id: string;
  title: string;
  date: string;
  trainer?: string;
}

interface AttendanceRecord {
  _id: string;
  sessionId: SessionDetails | null;
  present: boolean;
  markedAt: string;
}

interface FeedbackRecord {
  _id: string;
  sessionId: SessionDetails | null;
  rating: number;
  comment: string;
  createdAt: string;
}

interface StudentDetailData {
  student: {
    _id: string;
    name: string;
    rollNumber: string;
    branch: string;
    year: string;
    email: string;
  };
  attendance: AttendanceRecord[];
  feedback: FeedbackRecord[];
}

export default function StudentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<StudentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      fetchStudentDetails();
    }
  }, [id]);

  async function fetchStudentDetails() {
    try {
      setLoading(true);
      const res = await fetch(`/api/students/${id}`);
      if (!res.ok) {
        throw new Error('Failed to load student details');
      }
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading profile.');
    } finally {
      setLoading(false);
    }
  }

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
        <h3 className="text-lg font-bold text-slate-800">Failed to Load Profile</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-md">{error || 'Student profile not found.'}</p>
        <Link
          href="/students"
          className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Students
        </Link>
      </div>
    );
  }

  const { student, attendance, feedback } = data;

  // Calculate statistics
  const totalSessions = attendance.length;
  const sessionsAttended = attendance.filter((a) => a.present).length;
  const attendanceRate = totalSessions > 0 ? ((sessionsAttended / totalSessions) * 105).toFixed(0) : '0'; // Adjusted for UI
  const realRate = totalSessions > 0 ? ((sessionsAttended / totalSessions) * 100).toFixed(0) : '0';

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div>
        <Link 
          href="/students" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Student Directory
        </Link>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
              <User className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{student.name}</h2>
              <p className="text-xs font-mono text-slate-500 mt-0.5">{student.rollNumber}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                  {student.year}
                </span>
                {student.branch && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-700 border border-slate-200">
                    {student.branch}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex gap-4 border-t border-slate-100 pt-4 sm:border-0 sm:pt-0">
            <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-center min-w-[100px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Attendance</p>
              <p className="text-lg font-extrabold text-slate-850 mt-1">{realRate}%</p>
              <p className="text-[9px] text-slate-500 mt-0.5">{sessionsAttended}/{totalSessions} sessions</p>
            </div>
            <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-center min-w-[100px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Feedback Logged</p>
              <p className="text-lg font-extrabold text-slate-850 mt-1">{feedback.length}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">Linked reviews</p>
            </div>
          </div>
        </div>

        {/* Extended Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 mt-6 pt-6 text-xs">
          <div>
            <p className="font-semibold text-slate-450 uppercase tracking-wider text-[10px]">Email Address</p>
            <p className="text-slate-700 mt-1">{student.email || 'No email registered'}</p>
          </div>
          <div>
            <p className="font-semibold text-slate-450 uppercase tracking-wider text-[10px]">Student ID</p>
            <p className="text-slate-700 font-mono mt-1">{student._id}</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Attendance & Feedback logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Timeline */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="h-5 w-5 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-800">Attendance Log</h3>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[400px] pr-1">
            {attendance.length > 0 ? (
              attendance.map((record) => {
                if (!record.sessionId) return null;
                return (
                  <div 
                    key={record._id} 
                    className="flex items-center justify-between p-3.5 border border-slate-100 rounded-xl hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-800">{record.sessionId.title}</h4>
                      <p className="text-[10px] text-slate-400">
                        {new Date(record.sessionId.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                        {record.sessionId.trainer && ` • Trainer: ${record.sessionId.trainer}`}
                      </p>
                    </div>
                    <div>
                      {record.present ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <CheckCircle2 className="h-3 w-3" />
                          Present
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-100">
                          <XCircle className="h-3 w-3" />
                          Absent
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-200 rounded-xl text-center">
                <Calendar className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No attendance history available</p>
                <p className="text-[10px] text-slate-400 mt-0.5">This student has not been marked in any sessions.</p>
              </div>
            )}
          </div>
        </div>

        {/* Feedback History */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <MessageSquare className="h-5 w-5 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-800">Feedback Submitted</h3>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[400px] pr-1">
            {feedback.length > 0 ? (
              feedback.map((record) => {
                if (!record.sessionId) return null;
                return (
                  <div key={record._id} className="p-4 border border-slate-100 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-xs font-bold text-slate-800">{record.sessionId.title}</h4>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i < record.rating
                                ? 'text-amber-500 fill-amber-500'
                                : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {record.comment && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        "{record.comment}"
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">
                      Logged on{' '}
                      {new Date(record.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-200 rounded-xl text-center">
                <MessageSquare className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No feedback submitted</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Reviews submitted anonymously are not linked to student profiles.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
