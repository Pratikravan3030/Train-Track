'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Award,
  Plus,
  FileText,
  RotateCcw,
  Upload
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastContext';
import { 
  COLLEGE_CONFIG, 
  DEFAULT_PASSOUT_YEAR, 
  OFFER_TYPES, 
  OFFER_STATUSES 
} from '@/config/collegeConfig';

interface OfferRecord {
  _id: string;
  student: {
    _id: string;
    name: string;
    rollNumber: string;
    department: string;
    passoutYear: number;
    placementStatus: string;
  };
  drive?: {
    _id: string;
    role: string;
  };
  source: string;
  companyName: string;
  role: string;
  type: string;
  ctcLpa?: number | null;
  stipendMonthly?: number | null;
  tier?: string | null;
  status: string;
  offerDate: string;
  offerLetterUrl?: string;
  offerLetterFilename?: string;
}

export default function OffersPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();

  const isStaff = session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'TPO';

  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState<number>(DEFAULT_PASSOUT_YEAR);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Create Manual Offer Modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    studentSearch: '',
    selectedStudentId: '',
    companyName: '',
    role: '',
    type: 'Full-time',
    ctcLpa: '',
    stipendMonthly: '',
    status: 'Accepted',
    overrideReason: '',
  });
  const [studentSearchResults, setStudentSearchResults] = useState<Array<{ _id: string; name: string; rollNumber: string; department: string }>>([]);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Reversal Modal
  const [reversalModal, setReversalModal] = useState<{
    isOpen: boolean;
    offer: OfferRecord | null;
    status: 'Declined' | 'Revoked';
    reason: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    offer: null,
    status: 'Declined',
    reason: '',
    isSubmitting: false,
  });

  // Letter Upload Modal
  const [uploadModal, setUploadModal] = useState<{
    isOpen: boolean;
    offer: OfferRecord | null;
    file: File | null;
    isUploading: boolean;
  }>({
    isOpen: false,
    offer: null,
    file: null,
    isUploading: false,
  });

  const fetchOffers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (batch) params.set('batch', String(batch));
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);

      const res = await fetch(`/api/offers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load offers');
      const data = await res.json();
      setOffers(data.data || []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error fetching offers', 'error');
    } finally {
      setLoading(false);
    }
  }, [batch, statusFilter, typeFilter, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOffers();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchOffers]);

  // Search students for manual offer creation
  useEffect(() => {
    if (manualForm.studentSearch.trim().length >= 2) {
      const timer = setTimeout(() => {
        fetch(`/api/students?search=${encodeURIComponent(manualForm.studentSearch)}&limit=10`)
          .then((res) => res.json())
          .then((data) => {
            if (data.data) {
              setStudentSearchResults(data.data);
            }
          })
          .catch((err) => console.error(err));
      }, 300);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setStudentSearchResults([]);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [manualForm.studentSearch]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.selectedStudentId) {
      showToast('Please search and select a student.', 'error');
      return;
    }

    try {
      setManualSubmitting(true);
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: manualForm.selectedStudentId,
          companyName: manualForm.companyName.trim(),
          role: manualForm.role.trim(),
          type: manualForm.type,
          ctcLpa: manualForm.ctcLpa !== '' ? parseFloat(manualForm.ctcLpa) : null,
          stipendMonthly: manualForm.stipendMonthly !== '' ? parseFloat(manualForm.stipendMonthly) : null,
          status: manualForm.status,
          overrideReason: manualForm.overrideReason || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record manual offer');

      showToast('Manual offer recorded successfully', 'success');
      setIsManualModalOpen(false);
      setManualForm({
        studentSearch: '',
        selectedStudentId: '',
        companyName: '',
        role: '',
        type: 'Full-time',
        ctcLpa: '',
        stipendMonthly: '',
        status: 'Accepted',
        overrideReason: '',
      });
      fetchOffers();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error creating manual offer', 'error');
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleReversalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalModal.offer) return;

    try {
      setReversalModal((prev) => ({ ...prev, isSubmitting: true }));
      const res = await fetch(`/api/offers/${reversalModal.offer._id}/reversal`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: reversalModal.status,
          reason: reversalModal.reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reversal failed');

      showToast(data.message, 'success');
      setReversalModal({ isOpen: false, offer: null, status: 'Declined', reason: '', isSubmitting: false });
      fetchOffers();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Reversal error', 'error');
    } finally {
      setReversalModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleLetterUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadModal.offer || !uploadModal.file) return;

    try {
      setUploadModal((prev) => ({ ...prev, isUploading: true }));
      const formData = new FormData();
      formData.append('file', uploadModal.file);

      const res = await fetch(`/api/offers/${uploadModal.offer._id}/letter`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      showToast('Offer letter uploaded successfully', 'success');
      setUploadModal({ isOpen: false, offer: null, file: null, isUploading: false });
      fetchOffers();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error uploading offer letter', 'error');
    } finally {
      setUploadModal((prev) => ({ ...prev, isUploading: false }));
    }
  };

  // Metrics summary
  const acceptedOffers = offers.filter((o) => o.status === 'Accepted');
  const fullTimeCount = acceptedOffers.filter((o) => o.type === 'Full-time').length;
  const internshipCount = acceptedOffers.filter((o) => o.type === 'Internship').length;
  const ppoCount = acceptedOffers.filter((o) => o.type === 'PPO').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Placement Offers & Outcomes</h1>
          <p className="text-sm text-slate-500">
            Official repository of campus drive offers, off-campus placements, verified offer letters, and policy status.
          </p>
        </div>
        {isStaff && (
          <Button
            onClick={() => setIsManualModalOpen(true)}
            variant="primary"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Record Off-Campus Offer
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Recorded</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{offers.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Full-Time Accepted</span>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{fullTimeCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">PPO Conversions</span>
          <p className="text-2xl font-bold text-blue-700 mt-1">{ppoCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Internships</span>
          <p className="text-2xl font-bold text-purple-700 mt-1">{internshipCount}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Batch:</span>
            <select
              value={batch}
              onChange={(e) => setBatch(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
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
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="">All Statuses</option>
            {OFFER_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="">All Types</option>
            {OFFER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Offers Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading placement offers...</div>
        ) : offers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Award className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-800">No offers found</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              No placement offers match your current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Company / Role</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Package CTC</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Offer Letter</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offers.map((off) => (
                  <tr key={off._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{off.student?.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {off.student?.rollNumber} • {off.student?.department}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{off.companyName}</div>
                      <div className="text-[11px] text-slate-500">{off.role}</div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">
                        {off.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-600">
                      {off.ctcLpa ? `₹${off.ctcLpa} LPA` : off.stipendMonthly ? `₹${off.stipendMonthly}/mo` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {off.source}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          off.status === 'Accepted'
                            ? 'success'
                            : off.status === 'Declined'
                            ? 'danger'
                            : 'neutral'
                        }
                      >
                        {off.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {off.offerLetterUrl ? (
                        <a
                          href={off.offerLetterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
                        >
                          <FileText className="w-3.5 h-3.5" /> PDF Letter
                        </a>
                      ) : isStaff ? (
                        <button
                          onClick={() => setUploadModal({ isOpen: true, offer: off, file: null, isUploading: false })}
                          className="text-slate-400 hover:text-blue-600 flex items-center gap-1"
                        >
                          <Upload className="w-3.5 h-3.5" /> Upload
                        </button>
                      ) : (
                        <span className="text-slate-400">Not Uploaded</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isStaff && off.status === 'Accepted' && (
                        <Button
                          onClick={() =>
                            setReversalModal({
                              isOpen: true,
                              offer: off,
                              status: 'Declined',
                              reason: '',
                              isSubmitting: false,
                            })
                          }
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-800 flex items-center gap-1 ml-auto"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Revert
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Offer Modal */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Record Off-Campus / Manual Offer"
        description="Log verified off-campus recruitment outcome. Placed status will synchronize automatically."
        maxWidth="lg"
      >
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Search Student *</label>
            <input
              type="text"
              placeholder="Type student name or roll number..."
              value={manualForm.studentSearch}
              onChange={(e) => setManualForm({ ...manualForm, studentSearch: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />

            {studentSearchResults.length > 0 && (
              <div className="mt-1 bg-white border border-slate-200 rounded-lg shadow-md max-h-40 overflow-y-auto divide-y divide-slate-100">
                {studentSearchResults.map((stu) => (
                  <button
                    type="button"
                    key={stu._id}
                    onClick={() => {
                      setManualForm({
                        ...manualForm,
                        selectedStudentId: stu._id,
                        studentSearch: `${stu.name} (${stu.rollNumber} - ${stu.department})`,
                      });
                      setStudentSearchResults([]);
                    }}
                    className="w-full p-2 text-left text-xs hover:bg-slate-50 flex justify-between"
                  >
                    <span className="font-semibold text-slate-800">{stu.name}</span>
                    <span className="text-slate-500 font-mono">{stu.rollNumber}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Microsoft"
                value={manualForm.companyName}
                onChange={(e) => setManualForm({ ...manualForm, companyName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Job Role *</label>
              <input
                type="text"
                required
                placeholder="e.g. Software Engineer"
                value={manualForm.role}
                onChange={(e) => setManualForm({ ...manualForm, role: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Offer Type</label>
              <select
                value={manualForm.type}
                onChange={(e) => setManualForm({ ...manualForm, type: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {OFFER_TYPES.map((t) => (
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
                placeholder="e.g. 12.0"
                value={manualForm.ctcLpa}
                onChange={(e) => setManualForm({ ...manualForm, ctcLpa: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Stipend (Monthly ₹)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 30000"
                value={manualForm.stipendMonthly}
                onChange={(e) => setManualForm({ ...manualForm, stipendMonthly: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Policy Override Reason (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Off-campus high CTC tier upgrade approved"
              value={manualForm.overrideReason}
              onChange={(e) => setManualForm({ ...manualForm, overrideReason: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setIsManualModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={manualSubmitting}>
              {manualSubmitting ? 'Recording...' : 'Record Offer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Upload Offer Letter Modal */}
      <Modal
        isOpen={uploadModal.isOpen}
        onClose={() => setUploadModal({ isOpen: false, offer: null, file: null, isUploading: false })}
        title="Upload Verified Offer Letter (PDF)"
        description="File size must be strictly under 2MB. Magic byte validation ensures strict PDF verification."
      >
        <form onSubmit={handleLetterUpload} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select PDF Document *</label>
            <input
              type="file"
              required
              accept="application/pdf"
              onChange={(e) => setUploadModal({ ...uploadModal, file: e.target.files?.[0] || null })}
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              type="button"
              onClick={() => setUploadModal({ isOpen: false, offer: null, file: null, isUploading: false })}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={!uploadModal.file || uploadModal.isUploading}>
              {uploadModal.isUploading ? 'Uploading...' : 'Upload PDF'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Offer Reversal Modal */}
      <Modal
        isOpen={reversalModal.isOpen}
        onClose={() => setReversalModal({ isOpen: false, offer: null, status: 'Declined', reason: '', isSubmitting: false })}
        title="Revert / Cancel Offer"
        description="Declining or revoking an accepted offer automatically recalculates the student's placement status."
      >
        <form onSubmit={handleReversalSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">New Status *</label>
            <select
              value={reversalModal.status}
              onChange={(e) => setReversalModal({ ...reversalModal, status: e.target.value as 'Declined' | 'Revoked' })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="Declined">Declined (Student declined)</option>
              <option value="Revoked">Revoked (Company rescinded)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mandatory Reversal Reason *</label>
            <textarea
              required
              rows={3}
              placeholder="State reason for declining or revoking this offer..."
              value={reversalModal.reason}
              onChange={(e) => setReversalModal({ ...reversalModal, reason: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              type="button"
              onClick={() => setReversalModal({ isOpen: false, offer: null, status: 'Declined', reason: '', isSubmitting: false })}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              type="submit"
              disabled={reversalModal.reason.trim().length < 5 || reversalModal.isSubmitting}
            >
              {reversalModal.isSubmitting ? 'Processing...' : 'Confirm Reversal'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
