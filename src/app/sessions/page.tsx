'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ArrowRight, 
  AlertCircle,
  Calendar,
  User
} from 'lucide-react';
import Link from 'next/link';
import Modal from '@/components/Modal';

interface TrainingSession {
  _id: string;
  title: string;
  date: string;
  trainer: string;
  description: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState<TrainingSession | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    trainer: '',
    description: '',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    try {
      setLoading(true);
      const res = await fetch('/api/sessions');
      if (!res.ok) {
        throw new Error('Failed to fetch training sessions');
      }
      const data = await res.json();
      setSessions(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading training sessions.');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenAdd = () => {
    // Set default date to today in local YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      title: '',
      date: today,
      trainer: '',
      description: '',
    });
    setFormError('');
    setIsAddOpen(true);
  };

  const handleOpenEdit = (session: TrainingSession) => {
    setCurrentSession(session);
    // Format date string to YYYY-MM-DD for input element
    const formattedDate = new Date(session.date).toISOString().split('T')[0];
    setFormData({
      title: session.title,
      date: formattedDate,
      trainer: session.trainer || '',
      description: session.description || '',
    });
    setFormError('');
    setIsEditOpen(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) return 'Title is required.';
    if (!formData.date) return 'Date is required.';
    return '';
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create training session');
      }

      setIsAddOpen(false);
      fetchSessions();
    } catch (err: any) {
      setFormError(err.message || 'Server error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const res = await fetch(`/api/sessions/${currentSession._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update session');
      }

      setIsEditOpen(false);
      fetchSessions();
    } catch (err: any) {
      setFormError(err.message || 'Server error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this session? All associated attendance and feedback logs will be permanently deleted.')) {
      return;
    }

    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete session');
      }

      fetchSessions();
    } catch (err: any) {
      alert(err.message || 'Failed to delete session');
    }
  };

  // Filter sessions by query
  const filteredSessions = sessions.filter((session) => {
    const query = searchQuery.toLowerCase();
    return (
      session.title.toLowerCase().includes(query) ||
      (session.trainer && session.trainer.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Training Sessions</h2>
          <p className="text-xs text-slate-500 mt-1">Schedule lectures, tracks, workshops and log candidate progress</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 text-sm cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          Schedule Session
        </button>
      </div>

      {/* Search Filter Bar */}
      <div className="relative max-w-sm">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="text"
          placeholder="Search by session title or trainer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-xs transition-all bg-white"
        />
      </div>

      {/* Contents */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
          <p className="text-sm font-semibold text-slate-700">Error loading sessions</p>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-100 shadow-sm rounded-2xl text-center px-4">
          <Calendar className="h-12 w-12 text-slate-300 mb-3" />
          <h4 className="text-sm font-bold text-slate-700">
            {searchQuery ? 'No matching sessions found' : 'No training sessions scheduled'}
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            {searchQuery 
              ? 'Try modifying your filter keyword to locate the session.' 
              : 'Add your first training program (e.g. Aptitude Training or Mock Interview Prep) to begin.'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleOpenAdd}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Schedule Session
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSessions.map((session) => {
            const isUpcoming = new Date(session.date) >= new Date(new Date().setHours(0,0,0,0));
            return (
              <div 
                key={session._id} 
                className="bg-white rounded-2xl border border-slate-105 shadow-sm shadow-slate-100/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden"
              >
                {/* Session Body */}
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isUpcoming 
                        ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                        : 'bg-slate-100 text-slate-650 border border-slate-200'
                    }`}>
                      {isUpcoming ? 'Upcoming' : 'Completed'}
                    </span>
                    <p className="text-[10px] font-mono text-slate-450 font-semibold">
                      {new Date(session.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800 leading-snug line-clamp-2">
                      {session.title}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      Trainer: <span className="font-semibold text-slate-600">{session.trainer || 'Unassigned'}</span>
                    </p>
                  </div>

                  {session.description && (
                    <p className="text-xs text-slate-550 line-clamp-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {session.description}
                    </p>
                  )}
                </div>

                {/* Session Actions Footer */}
                <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(session)}
                      className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Edit session"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(session._id)}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Delete session"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <Link
                    href={`/sessions/${session._id}`}
                    className="inline-flex items-center gap-1.5 font-bold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    View Details & Attendance
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Schedule Training Session">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-medium rounded-lg flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Session Title *</label>
            <input
              type="text"
              name="title"
              required
              value={formData.title}
              onChange={handleFormChange}
              placeholder="e.g. Aptitude Preparation - Batch A"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Date *</label>
            <input
              type="date"
              name="date"
              required
              value={formData.date}
              onChange={handleFormChange}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Trainer Name</label>
            <input
              type="text"
              name="trainer"
              value={formData.trainer}
              onChange={handleFormChange}
              placeholder="e.g. Prof. R. K. Sharma"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Description / Syllabus</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              rows={3}
              placeholder="Describe what will be covered in this session..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Scheduling...' : 'Schedule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Modify Session Settings">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-medium rounded-lg flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Session Title *</label>
            <input
              type="text"
              name="title"
              required
              value={formData.title}
              onChange={handleFormChange}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Date *</label>
            <input
              type="date"
              name="date"
              required
              value={formData.date}
              onChange={handleFormChange}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Trainer Name</label>
            <input
              type="text"
              name="trainer"
              value={formData.trainer}
              onChange={handleFormChange}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Description / Syllabus</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              rows={3}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
