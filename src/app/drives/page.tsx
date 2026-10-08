'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { 
  Briefcase, 
  Search, 
  Plus, 
  Calendar, 
  MapPin, 
  Clock, 
  Users, 
  ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastContext';
import { 
  COLLEGE_CONFIG, 
  DEFAULT_PASSOUT_YEAR, 
  DRIVE_TYPES, 
  DRIVE_MODES, 
  DRIVE_STATUSES,
  DEPARTMENT_CODES
} from '@/config/collegeConfig';

interface Drive {
  _id: string;
  company: {
    _id: string;
    name: string;
    sector: string;
  };
  role: string;
  type: string;
  jd: string;
  ctcLpa?: number | null;
  stipendMonthly?: number | null;
  tier: string;
  location: string;
  mode: string;
  driveDate: string;
  registrationDeadline: string;
  status: string;
  displayStatus: string;
  isRegistrationClosed: boolean;
  applicantCount: number;
  selectionRounds: string[];
}

export default function DrivesPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();

  const isStaff = session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'TPO';

  const [drives, setDrives] = useState<Drive[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [batch, setBatch] = useState<number>(DEFAULT_PASSOUT_YEAR);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Companies for creation dropdown
  const [companiesList, setCompaniesList] = useState<Array<{ _id: string; name: string }>>([]);

  // Create Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    company: '',
    role: '',
    type: 'Full-time',
    jd: '',
    ctcLpa: '',
    stipendMonthly: '',
    location: '',
    mode: 'On-Campus',
    driveDate: '',
    registrationDeadline: '',
    selectionRounds: ['Online Assessment', 'Technical Interview', 'HR Interview'],
    minCgpa: '',
    maxBacklogs: '',
    allowedDepartments: [] as string[],
    allowedBatches: [DEFAULT_PASSOUT_YEAR],
    minTenthPercentage: '',
    minTwelfthOrDiplomaPercentage: '',
  });

  const fetchDrives = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (batch) params.set('batch', String(batch));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);

      const res = await fetch(`/api/drives?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load placement drives');
      const data = await res.json();
      setDrives(data.data || []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error fetching placement drives', 'error');
    } finally {
      setLoading(false);
    }
  }, [batch, search, statusFilter, typeFilter, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDrives();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchDrives]);

  // Load companies for select dropdown
  useEffect(() => {
    if (isStaff) {
      fetch('/api/companies?limit=100')
        .then((res) => res.json())
        .then((data) => {
          if (data.data) {
            setCompaniesList(data.data.map((c: { _id: string; name: string }) => ({ _id: c._id, name: c.name })));
          }
        })
        .catch((err) => console.error('Error fetching companies for dropdown:', err));
    }
  }, [isStaff]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);

    // Validate deadline before drive date
    if (new Date(formData.registrationDeadline).getTime() >= new Date(formData.driveDate).getTime()) {
      setModalError('Registration deadline must be strictly before the drive date.');
      setSubmitting(false);
      return;
    }

    const payload = {
      company: formData.company,
      role: formData.role.trim(),
      type: formData.type,
      jd: formData.jd.trim(),
      ctcLpa: formData.ctcLpa !== '' ? parseFloat(formData.ctcLpa) : null,
      stipendMonthly: formData.stipendMonthly !== '' ? parseFloat(formData.stipendMonthly) : null,
      location: formData.location.trim(),
      mode: formData.mode,
      driveDate: new Date(formData.driveDate).toISOString(),
      registrationDeadline: new Date(formData.registrationDeadline).toISOString(),
      selectionRounds: formData.selectionRounds.filter((r) => r.trim() !== ''),
      status: 'Open',
      eligibilityRules: {
        minCgpa: formData.minCgpa !== '' ? parseFloat(formData.minCgpa) : null,
        maxBacklogs: formData.maxBacklogs !== '' ? parseInt(formData.maxBacklogs, 10) : null,
        allowedDepartments: formData.allowedDepartments,
        allowedBatches: formData.allowedBatches,
        minTenthPercentage: formData.minTenthPercentage !== '' ? parseFloat(formData.minTenthPercentage) : null,
        minTwelfthOrDiplomaPercentage:
          formData.minTwelfthOrDiplomaPercentage !== '' ? parseFloat(formData.minTwelfthOrDiplomaPercentage) : null,
      },
    };

    try {
      const res = await fetch('/api/drives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create placement drive');
      }

      showToast('Placement drive created successfully', 'success');
      setIsCreateOpen(false);
      fetchDrives();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Open':
        return 'success';
      case 'Registration Closed':
        return 'warning';
      case 'In Progress':
        return 'info';
      case 'Completed':
        return 'neutral';
      case 'Draft':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Placement Drives</h1>
          <p className="text-sm text-slate-500">
            Schedule on-campus drives, eligibility criteria, student registrations, and selection rounds.
          </p>
        </div>
        {isStaff && (
          <Button onClick={() => setIsCreateOpen(true)} variant="primary" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Drive
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-1 w-full flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by role, company, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Batch:</span>
            <select
              value={batch}
              onChange={(e) => setBatch(parseInt(e.target.value, 10))}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 font-medium text-slate-700"
            >
              {COLLEGE_CONFIG.academic.passoutYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr} Batch
                </option>
              ))}
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-slate-700"
          >
            <option value="">All Statuses</option>
            {DRIVE_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-slate-700"
          >
            <option value="">All Types</option>
            {DRIVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Drives Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse space-y-4">
              <div className="h-6 bg-slate-100 rounded-sm w-3/4"></div>
              <div className="h-4 bg-slate-100 rounded-sm w-1/2"></div>
              <div className="h-20 bg-slate-50 rounded-sm"></div>
            </div>
          ))}
        </div>
      ) : drives.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800">No placement drives found</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            No placement drives match the chosen batch and status filters.
          </p>
          {isStaff && (
            <Button onClick={() => setIsCreateOpen(true)} variant="primary" size="sm">
              Schedule Placement Drive
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {drives.map((d) => (
            <div
              key={d._id}
              className="bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                      {d.company?.name || 'Company'}
                    </span>
                    <h3 className="font-semibold text-slate-900 text-lg line-clamp-1">{d.role}</h3>
                  </div>
                  <Badge variant={getStatusBadgeVariant(d.displayStatus)}>{d.displayStatus}</Badge>
                </div>

                {/* Compensation & Mode */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {d.ctcLpa ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                      ₹{d.ctcLpa} LPA
                    </span>
                  ) : d.stipendMonthly ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                      ₹{d.stipendMonthly}/mo
                    </span>
                  ) : null}

                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                    {d.tier}
                  </span>

                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">
                    {d.type}
                  </span>

                  <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium">
                    {d.mode}
                  </span>
                </div>

                {/* Meta details */}
                <div className="space-y-1.5 text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Drive Date: {new Date(d.driveDate).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Deadline: {new Date(d.registrationDeadline).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{d.location}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium text-slate-700">{d.applicantCount} Registered Applicants</span>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">{d.selectionRounds.length} Selection Rounds</span>
                <Link
                  href={`/drives/${d._id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Manage Drive <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Drive Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Schedule New Placement Drive"
        description="Configure drive profile, compensation, selection rounds, and eligibility criteria."
        maxWidth="xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {modalError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Visiting Company *</label>
              <select
                required
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select Company</option>
                {companiesList.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Job Role *</label>
              <input
                type="text"
                required
                placeholder="e.g. Associate Software Engineer"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Drive Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {DRIVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">CTC (LPA)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 7.5"
                value={formData.ctcLpa}
                onChange={(e) => setFormData({ ...formData, ctcLpa: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Stipend (Monthly ₹)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 25000"
                value={formData.stipendMonthly}
                onChange={(e) => setFormData({ ...formData, stipendMonthly: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Location *</label>
              <input
                type="text"
                required
                placeholder="e.g. Pune / Bangalore"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Drive Mode</label>
              <select
                value={formData.mode}
                onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {DRIVE_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Registration Deadline *</label>
              <input
                type="datetime-local"
                required
                value={formData.registrationDeadline}
                onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Drive Date *</label>
              <input
                type="date"
                required
                value={formData.driveDate}
                onChange={(e) => setFormData({ ...formData, driveDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Job Description *</label>
            <textarea
              required
              rows={3}
              placeholder="Paste job overview, key requirements, technical stack..."
              value={formData.jd}
              onChange={(e) => setFormData({ ...formData, jd: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Academic Eligibility Criteria */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Academic Eligibility Rules (Empty = No Restriction)
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Min CGPA</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  placeholder="e.g. 7.0"
                  value={formData.minCgpa}
                  onChange={(e) => setFormData({ ...formData, minCgpa: e.target.value })}
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Max Backlogs</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 0"
                  value={formData.maxBacklogs}
                  onChange={(e) => setFormData({ ...formData, maxBacklogs: e.target.value })}
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Min 10th %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 60"
                  value={formData.minTenthPercentage}
                  onChange={(e) => setFormData({ ...formData, minTenthPercentage: e.target.value })}
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Min 12th/Diploma %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 60"
                  value={formData.minTwelfthOrDiplomaPercentage}
                  onChange={(e) => setFormData({ ...formData, minTwelfthOrDiplomaPercentage: e.target.value })}
                  className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Allowed Departments (Select to restrict; leave empty for campus-wide eligibility)
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {DEPARTMENT_CODES.map((code) => {
                  const isChecked = formData.allowedDepartments.includes(code);
                  return (
                    <button
                      type="button"
                      key={code}
                      onClick={() => {
                        const updated = isChecked
                          ? formData.allowedDepartments.filter((c) => c !== code)
                          : [...formData.allowedDepartments, code];
                        setFormData({ ...formData, allowedDepartments: updated });
                      }}
                      className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors ${
                        isChecked
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {code}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Creating Drive...' : 'Schedule Placement Drive'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
