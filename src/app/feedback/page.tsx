'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Filter, 
  Star, 
  AlertCircle,
  Calendar
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

  useEffect(() => {
    // Fetch initial sessions for the filter dropdown
    fetchSessions();
  }, []);

  useEffect(() => {
    fetchFeedback();
  }, [selectedSessionId]);

  async function fetchSessions() {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error('Failed to load sessions for filtering', err);
    }
  }

  async function fetchFeedback() {
    try {
      setLoading(true);
      const url = selectedSessionId && selectedSessionId !== 'all'
        ? `/api/feedback?sessionId=${selectedSessionId}`
        : '/api/feedback';
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to fetch feedback logs');
      }
      const data = await res.json();
      setFeedbackList(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading feedback logs.');
    } finally {
      setLoading(false);
    }
  }

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
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
          <p className="text-sm font-semibold text-slate-700">Error loading feedback</p>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
        </div>
      ) : feedbackList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-100 shadow-sm rounded-2xl text-center px-4">
          <MessageSquare className="h-12 w-12 text-slate-300 mb-3" />
          <h4 className="text-sm font-bold text-slate-700">No feedback entries found</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            {selectedSessionId !== 'all'
              ? 'This specific training session has not received any feedback comments yet.'
              : 'There are no feedback submissions recorded in the database.'}
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
                    "{feedback.comment}"
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
