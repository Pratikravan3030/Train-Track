'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ArrowRight, 
  AlertCircle,
  Calendar,
  User,
  MapPin,
  BarChart3,
  Users2,
  Download
} from 'lucide-react';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/ToastContext';
import { Badge } from '@/components/ui/Badge';
import { TRAINING_CATEGORIES, DEPARTMENT_CODES } from '@/config/collegeConfig';

interface TrainingSession {
  _id: string;
  title: string;
  date: string;
  trainer?: string;
  description?: string;
  category?: string;
  targetDepartments?: string[];
  targetBatches?: string[];
  venue?: string;
}

interface TrainerStat {
  trainer: string;
  sessionsCount: number;
  studentsAttended: number;
  averageAttendancePct: number;
  averageRating: number | null;
  categories: string[];
}

interface DefaulterStudent {
  studentId: string;
  name: string;
  rollNumber: string;
  department: string;
  passoutYear: number;
  attended: number;
  totalEligible: number;
  attendancePercentage: number;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState<TrainingSession | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrainingSession | null>(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  // Analytics & Defaulters Modals
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [trainerStats, setTrainerStats] = useState<TrainerStat[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [isDefaultersOpen, setIsDefaultersOpen] = useState(false);
  const [defaulters, setDefaulters] = useState<DefaulterStudent[]>([]);
  const [loadingDefaulters, setLoadingDefaulters] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    trainer: '',
    description: '',
    category: 'Technical',
    venue: '',
    targetDepartments: [] as string[],
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (selectedCategory !== 'ALL') {
        params.append('category', selectedCategory);
      }
      const res = await fetch(`/api/sessions?${params.toString()}`);

      if (!res.ok) {
        if (res.status === 401) {
          setError('Session expired. Redirecting to login...');
          setTimeout(() => {
            window.location.href = '/login';
          }, 1200);
          return;
        }

        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Failed to fetch sessions (Status ${res.status})`);
      }

      const result = await res.json();
      const sessionList = Array.isArray(result) ? result : (result.data || []);
      setSessions(sessionList);
      setError('');
    } catch (err: unknown) {
      console.error('[SessionsPage fetch error]:', err);
      const message = err instanceof Error ? err.message : 'An error occurred while loading training sessions.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  async function openAnalyticsModal() {
    setIsAnalyticsOpen(true);
    setLoadingAnalytics(true);
    try {
      const res = await fetch('/api/sessions/analytics');
      if (!res.ok) throw new Error('Failed to load trainer analytics');
      const data = await res.json();
      setTrainerStats(data.trainers || []);
    } catch {
      toast.error('Failed to load trainer performance metrics');
    } finally {
      setLoadingAnalytics(false);
    }
  }

  async function openDefaultersModal() {
    setIsDefaultersOpen(true);
    setLoadingDefaulters(true);
    try {
      const res = await fetch('/api/sessions/defaulters?threshold=75');
      if (!res.ok) throw new Error('Failed to load defaulters');
      const data = await res.json();
      setDefaulters(data.defaulters || []);
    } catch {
      toast.error('Failed to load defaulters list');
    } finally {
      setLoadingDefaulters(false);
    }
  }

  const handleOpenAdd = () => {
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      title: '',
      date: today,
      trainer: '',
      description: '',
      category: 'Technical',
      venue: '',
      targetDepartments: [],
    });
    setFormError('');
    setIsAddOpen(true);
  };

  const handleOpenEdit = (session: TrainingSession) => {
    setCurrentSession(session);
    const formattedDate = new Date(session.date).toISOString().split('T')[0];
    setFormData({
      title: session.title,
      date: formattedDate,
      trainer: session.trainer || '',
      description: session.description || '',
      category: session.category || 'Technical',
      venue: session.venue || '',
      targetDepartments: session.targetDepartments || [],
    });
    setFormError('');
    setIsEditOpen(true);
  };

  const handleDeptToggle = (dept: string) => {
    setFormData((prev) => {
      const exists = prev.targetDepartments.includes(dept);
      return {
        ...prev,
        targetDepartments: exists 
          ? prev.targetDepartments.filter((d) => d !== dept)
          : [...prev.targetDepartments, dept]
      };
    });
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('Title is required');
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
      if (!res.ok) throw new Error(data.error || 'Failed to create training session');

      setIsAddOpen(false);
      toast.success('Training session scheduled successfully!');
      fetchSessions();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Server error occurred.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;
    if (!formData.title.trim()) {
      setFormError('Title is required');
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
      if (!res.ok) throw new Error(data.error || 'Failed to update session');

      setIsEditOpen(false);
      toast.success('Training session updated successfully!');
      fetchSessions();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Server error occurred.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/sessions/${deleteTarget._id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to delete session');
      }

      toast.success(`Session "${deleteTarget.title}" deleted.`);
      setDeleteTarget(null);
      fetchSessions();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete session';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredSessions = sessions.filter((session) => {
    const query = searchQuery.toLowerCase();
    return (
      session.title.toLowerCase().includes(query) ||
      (session.trainer && session.trainer.toLowerCase().includes(query)) ||
      (session.venue && session.venue.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Training Sessions</h2>
          <p className="text-xs text-slate-500 mt-1">
            Schedule lectures, tracks, workshops, monitor trainer analytics and defaulters
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={openAnalyticsModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
          >
            <BarChart3 className="h-4 w-4 text-indigo-600" />
            Trainer Analytics
          </button>
          <button
            onClick={openDefaultersModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
          >
            <Users2 className="h-4 w-4 text-amber-600" />
            Defaulters (&lt;75%)
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 text-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Schedule Session
          </button>
        </div>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              selectedCategory === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Categories
          </button>
          {TRAINING_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search title, trainer, venue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-xs transition-all bg-white"
          />
        </div>
      </div>

      {/* Contents */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4 bg-white rounded-2xl border border-red-100">
          <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
          <p className="text-sm font-semibold text-slate-700">Error loading sessions</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md">{error}</p>
          <button
            onClick={() => fetchSessions()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-100 shadow-sm rounded-2xl text-center px-4">
          <Calendar className="h-12 w-12 text-slate-300 mb-3" />
          <h4 className="text-sm font-bold text-slate-700">No training sessions found</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            {searchQuery 
              ? 'Try modifying your filter keyword.' 
              : 'Add your first training program to begin tracking attendance and assessments.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSessions.map((session) => {
            const isUpcoming = new Date(session.date) >= new Date(new Date().setHours(0,0,0,0));
            return (
              <div 
                key={session._id} 
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isUpcoming 
                          ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {isUpcoming ? 'Upcoming' : 'Completed'}
                      </span>
                      {session.category && (
                        <Badge variant="purple" size="sm">
                          {session.category}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 font-medium">
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
                      Trainer: <span className="font-semibold text-slate-700">{session.trainer || 'Unassigned'}</span>
                    </p>
                    {session.venue && (
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        Venue: <span className="font-medium text-slate-600">{session.venue}</span>
                      </p>
                    )}
                  </div>

                  {session.targetDepartments && session.targetDepartments.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap text-[10px] text-slate-500">
                      <span className="font-semibold text-slate-600">Depts:</span>
                      {session.targetDepartments.map((d) => (
                        <span key={d} className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 font-mono">
                          {d}
                        </span>
                      ))}
                    </div>
                  )}

                  {session.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {session.description}
                    </p>
                  )}
                </div>

                <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenEdit(session)}
                      className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition"
                      title="Edit session"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(session)}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg transition"
                      title="Delete session"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <Link
                    href={`/sessions/${session._id}`}
                    className="inline-flex items-center gap-1.5 font-bold text-blue-600 hover:text-blue-700 transition"
                  >
                    Details, Code & Attendance
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trainer Analytics Modal */}
      <Modal 
        isOpen={isAnalyticsOpen} 
        onClose={() => setIsAnalyticsOpen(false)} 
        title="Trainer Performance & Analytics"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Overview of session volume, candidate attendance rates, and feedback metrics across instructors.
          </p>
          {loadingAnalytics ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading trainer metrics...</div>
          ) : trainerStats.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">No trainer records found yet.</div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-3">Trainer</th>
                    <th className="p-3 text-center">Sessions</th>
                    <th className="p-3 text-center">Avg Attendance</th>
                    <th className="p-3 text-center">Avg Rating</th>
                    <th className="p-3">Categories</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {trainerStats.map((t) => (
                    <tr key={t.trainer} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-800">{t.trainer}</td>
                      <td className="p-3 text-center">{t.sessionsCount}</td>
                      <td className="p-3 text-center">
                        <span className={`font-semibold ${
                          t.averageAttendancePct >= 75 ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {t.averageAttendancePct}%
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {t.averageRating ? `${t.averageRating} / 5.0` : 'N/A'}
                      </td>
                      <td className="p-3 text-[11px] text-slate-500">
                        {t.categories.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Defaulters Modal */}
      <Modal 
        isOpen={isDefaultersOpen} 
        onClose={() => setIsDefaultersOpen(false)} 
        title="Training Defaulters (< 75% Attendance)"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Students falling below the mandatory 75% attendance threshold across eligible training programs.
            </p>
            <a
              href="/api/sessions/defaulters?threshold=75&format=csv"
              download="training-defaulters.csv"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition"
            >
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </a>
          </div>

          {loadingDefaulters ? (
            <div className="py-8 text-center text-xs text-slate-500">Calculating defaulters...</div>
          ) : defaulters.length === 0 ? (
            <div className="py-8 text-center text-xs text-emerald-600 font-medium">
              Zero defaulters found! All active candidates satisfy the 75% threshold.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                  <tr>
                    <th className="p-2.5">Roll No</th>
                    <th className="p-2.5">Student</th>
                    <th className="p-2.5">Dept</th>
                    <th className="p-2.5 text-center">Attended</th>
                    <th className="p-2.5 text-center">Attendance %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {defaulters.map((d) => (
                    <tr key={d.studentId} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono text-[11px] font-semibold">{d.rollNumber}</td>
                      <td className="p-2.5 font-medium">{d.name}</td>
                      <td className="p-2.5">{d.department}</td>
                      <td className="p-2.5 text-center">{d.attended} / {d.totalEligible}</td>
                      <td className="p-2.5 text-center font-bold text-red-600">
                        {d.attendancePercentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

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
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Session Title *</label>
            <input
              type="text"
              name="title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Data Structures & Algorithms Workshop"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white"
              >
                {TRAINING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Trainer Name</label>
              <input
                type="text"
                value={formData.trainer}
                onChange={(e) => setFormData({ ...formData, trainer: e.target.value })}
                placeholder="e.g. Prof. A. B. Patil"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Venue</label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                placeholder="e.g. Seminar Hall 2 / Lab 4"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Target Departments (empty = open to all)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DEPARTMENT_CODES.map((dept) => {
                const checked = formData.targetDepartments.includes(dept);
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => handleDeptToggle(dept)}
                    className={`px-2.5 py-1 text-xs rounded-lg border font-mono transition ${
                      checked 
                        ? 'bg-blue-600 text-white border-blue-600 font-bold' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {dept}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description / Syllabus</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Topics covered, prerequisites, or session links..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition disabled:opacity-50"
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
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Session Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white"
              >
                {TRAINING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Trainer Name</label>
              <input
                type="text"
                value={formData.trainer}
                onChange={(e) => setFormData({ ...formData, trainer: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Venue</label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Target Departments (empty = open to all)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DEPARTMENT_CODES.map((dept) => {
                const checked = formData.targetDepartments.includes(dept);
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => handleDeptToggle(dept)}
                    className={`px-2.5 py-1 text-xs rounded-lg border font-mono transition ${
                      checked 
                        ? 'bg-blue-600 text-white border-blue-600 font-bold' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {dept}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description / Syllabus</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={executeDelete}
        loading={deleting}
        title="Delete Training Session"
        description={`Are you sure you want to delete "${deleteTarget?.title}"?`}
        confirmText="Delete Session"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
