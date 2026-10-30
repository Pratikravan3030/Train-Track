'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  Star,
  KeyRound,
  MessageSquare,
  ShieldAlert,
  Loader2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface StudentSessionItem {
  _id: string;
  title: string;
  date: string;
  trainer?: string;
  description?: string;
  category?: string;
  venue?: string;
  checkInActive: boolean;
  hasAttended: boolean;
  attendanceStatus: string;
  hasSubmittedFeedback: boolean;
  feedback?: {
    rating: number;
    comment?: string;
  };
}

export default function StudentSessionsPage() {
  const [loading, setLoading] = useState(true);
  const [portalDisabled, setPortalDisabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StudentSessionItem[]>([]);

  // Check-In Modal State (ZERO geolocation collection)
  const [checkInModalSession, setCheckInModalSession] = useState<StudentSessionItem | null>(null);
  const [checkInCodeInput, setCheckInCodeInput] = useState('');
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  // Feedback Modal State (strictly 1 feedback per student per attended session)
  const [feedbackModalSession, setFeedbackModalSession] = useState<StudentSessionItem | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/student/sessions');
      if (res.status === 403) {
        setPortalDisabled(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load sessions');
      }
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error loading sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInModalSession || !checkInCodeInput.trim()) return;

    setCheckInSubmitting(true);
    setCheckInError(null);

    try {
      const res = await fetch(`/api/student/sessions/${checkInModalSession._id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: checkInCodeInput.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to check in');
      }
      setActionSuccess(`Check-in confirmed for "${checkInModalSession.title}"!`);
      setCheckInModalSession(null);
      setCheckInCodeInput('');
      await fetchSessions();
    } catch (err: unknown) {
      setCheckInError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setCheckInSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackModalSession) return;

    setFeedbackSubmitting(true);
    setFeedbackError(null);

    try {
      const res = await fetch(`/api/student/sessions/${feedbackModalSession._id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: feedbackRating,
          comment: feedbackComment.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }
      setActionSuccess(`Feedback submitted for "${feedbackModalSession.title}"!`);
      setFeedbackModalSession(null);
      setFeedbackComment('');
      setFeedbackRating(5);
      await fetchSessions();
    } catch (err: unknown) {
      setFeedbackError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">Loading training schedule...</p>
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
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Training Sessions</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          View your training calendar, check-in using the trainer session code, and provide feedback.
        </p>
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

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center">
          <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Calendar className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Training Sessions Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            You are not currently enrolled in any upcoming training sessions.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session._id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info" size="sm">
                    {session.category || 'Technical'}
                  </Badge>
                  <span className="text-xs font-bold text-slate-800">{session.title}</span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  {session.description || 'Training session organized by Training & Placement Cell.'}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-slate-600 font-medium">
                    <Calendar className="h-3 w-3" />
                    {new Date(session.date).toLocaleDateString()}
                  </span>
                  <span>Trainer: {session.trainer || 'Industry Expert'}</span>
                  {session.venue && <span>Venue: {session.venue}</span>}
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto justify-end pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                {/* Attendance Badge */}
                <Badge
                  variant={
                    session.hasAttended
                      ? 'success'
                      : session.attendanceStatus === 'Absent'
                      ? 'danger'
                      : 'neutral'
                  }
                  size="md"
                >
                  {session.attendanceStatus}
                </Badge>

                {/* Check-In Button (Code based, no geolocation) */}
                {session.checkInActive && !session.hasAttended && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setCheckInModalSession(session);
                      setCheckInCodeInput('');
                      setCheckInError(null);
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Check In
                  </Button>
                )}

                {/* Feedback Button: strictly 1 feedback per student per attended session */}
                {session.hasAttended && !session.hasSubmittedFeedback && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFeedbackModalSession(session);
                      setFeedbackRating(5);
                      setFeedbackComment('');
                      setFeedbackError(null);
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Give Feedback
                  </Button>
                )}

                {session.hasSubmittedFeedback && (
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Feedback Given
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Check-In Modal (Time-limited code verification, zero geolocation) */}
      {checkInModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">Session Check-In</h3>
              </div>
              <button
                type="button"
                onClick={() => setCheckInModalSession(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCheckInSubmit} className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-slate-600 font-semibold">{checkInModalSession.title}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Enter the 6-character check-in code displayed on the screen or announced by the trainer.
                </p>
              </div>

              {checkInError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {checkInError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Check-In Code
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={checkInCodeInput}
                  onChange={(e) => setCheckInCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. TRN892"
                  autoFocus
                  required
                  className="w-full text-center tracking-widest font-mono text-xl font-bold uppercase py-2.5 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCheckInModalSession(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={checkInSubmitting || !checkInCodeInput.trim()}
                >
                  {checkInSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm Check-In'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feedback Modal (One per student per attended session) */}
      {feedbackModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">Session Feedback</h3>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackModalSession(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-slate-600 font-semibold">{feedbackModalSession.title}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Your feedback helps the Training & Placement Cell improve future training modules.
                </p>
              </div>

              {feedbackError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {feedbackError}
                </div>
              )}

              {/* Star Rating Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Rating (1 to 5 Stars)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      className="p-1 text-slate-300 hover:text-amber-400 transition-colors focus:outline-none cursor-pointer"
                    >
                      <Star
                        className={`h-7 w-7 ${
                          star <= feedbackRating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-600 ml-2">
                    {feedbackRating} / 5
                  </span>
                </div>
              </div>

              {/* Comment text area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Comments & Suggestions (Optional)
                </label>
                <textarea
                  rows={3}
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  maxLength={1000}
                  placeholder="Share what went well or what could be improved..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFeedbackModalSession(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={feedbackSubmitting}
                >
                  {feedbackSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Submit Feedback'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
