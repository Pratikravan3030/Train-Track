'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, 
  Filter, 
  Star, 
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';

interface Session {
  _id: string;
  title: string;
  date: string;
}

interface Feedback {
  _id: string;
  sessionId: Session | null;
  studentId: {
    _id: string;
    name: string;
    rollNumber: string;
  } | null;
  rating: number;
  comment: string;
  createdAt: string;
}

export default function FeedbackPage() {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('all');

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError('');
    const url = selectedSessionId && selectedSessionId !== 'all'
      ? `/api/feedback?sessionId=${selectedSessionId}`
      : '/api/feedback';

    fetch(url)
      .then(async (res) => {
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
          if (res.status >= 500) {
            throw new Error(`Server error (${res.status})${serverError}. Please verify MongoDB Atlas connection and IP whitelist.`);
          }
          throw new Error(errData?.error || `Failed to fetch feedback logs (Status ${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        setFeedbackList(Array.isArray(data) ? data : []);
        setError('');
      })
      .catch((err: unknown) => {
        console.error('[FeedbackPage fetch error]:', err);
        const message = err instanceof Error ? err.message : 'An error occurred while loading feedback logs.';
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedSessionId]);

  useEffect(() => {
    let ignore = false;

    async function loadSessions() {
      try {
        const res = await fetch('/api/sessions');
        if (res.ok && !ignore) {
          const data = await res.json();
          setSessions(data);
        }
      } catch (err) {
        console.error('Failed to load sessions for filtering', err);
      }
    }

    async function loadFeedback() {
      try {
        const url = selectedSessionId && selectedSessionId !== 'all'
          ? `/api/feedback?sessionId=${selectedSessionId}`
          : '/api/feedback';

        const res = await fetch(url);
        if (ignore) return;

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

          if (res.status >= 500) {
            throw new Error(`Server error (${res.status})${serverError}. Please verify MongoDB Atlas connection and IP whitelist.`);
          }
          throw new Error(errData?.error || `Failed to fetch feedback logs (Status ${res.status})`);
        }

        const data = await res.json();
        if (!ignore) {
          setFeedbackList(Array.isArray(data) ? data : []);
          setError('');
        }
      } catch (err: unknown) {
        if (!ignore) {
          console.error('[FeedbackPage fetch error]:', err);
          const message = err instanceof Error ? err.message : 'An error occurred while loading feedback logs.';
          setError(message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadSessions();
    loadFeedback();

    return () => {
      ignore = true;
    };
  }, [selectedSessionId]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Feedback Logs</h2>
          <p className="text-xs text-slate-500 mt-1">Review student feedback, aggregate ratings, and qualitative comments</p>
        </div>

        {/* Filter select */}
        <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm shrink-0">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="text-xs font-semibold text-slate-655 focus:outline-none bg-transparent cursor-pointer"
          >
            <option value="all">All Training Sessions</option>
            {sessions.map((s) => (
              <option key={s._id} value={s._id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Contents */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
          <p className="text-sm font-semibold text-slate-700">Error loading feedback</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md">{error}</p>
          <button
            onClick={handleRetry}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors cursor-pointer shadow-sm"
          >
            Retry Connection
          </button>
        </div>
      ) : feedbackList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-100 shadow-sm rounded-2xl text-center px-4">
          <MessageSquare className="h-12 w-12 text-slate-300 mb-3" />
          <h4 className="text-sm font-bold text-slate-700">No feedback entries yet</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            {selectedSessionId !== 'all'
              ? 'This specific training session has not received any feedback comments yet.'
              : 'There are no feedback submissions recorded in the database yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-none">
          {feedbackList.map((feedback) => (
            <div 
              key={feedback._id} 
              className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4"
            >
              {/* Feedback Body */}
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {feedback.studentId ? (
                      <Link 
                        href={`/students/${feedback.studentId._id}`}
                        className="text-xs font-bold text-slate-800 hover:text-blue-650 hover:underline"
                      >
                        {feedback.studentId.name}
                      </Link>
                    ) : (
                      <span className="text-xs font-bold text-slate-450 italic">Anonymous Student</span>
                    )}
                    {feedback.studentId?.rollNumber && (
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">{feedback.studentId.rollNumber}</p>
                    )}
                  </div>

                  {/* Stars display */}
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, idx) => (
                      <Star
                        key={idx}
                        className={`h-3.5 w-3.5 ${
                          idx < feedback.rating 
                            ? 'text-amber-500 fill-amber-500' 
                            : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {feedback.comment ? (
                  <p className="text-xs text-slate-650 bg-slate-50 border border-slate-100/70 p-3 rounded-xl leading-relaxed italic">
                    &ldquo;{feedback.comment}&rdquo;
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">No comment provided.</p>
                )}
              </div>

              {/* Feedback Session Footer */}
              {feedback.sessionId && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-[10px]">
                  <Link 
                    href={`/sessions/${feedback.sessionId._id}`}
                    className="font-bold text-blue-600 hover:underline hover:text-blue-700 truncate max-w-[70%]"
                  >
                    {feedback.sessionId.title}
                  </Link>
                  <span className="text-slate-450 font-medium">
                    {new Date(feedback.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
