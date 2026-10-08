'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Building2, 
  Search, 
  Plus, 
  ExternalLink, 
  Mail, 
  Phone, 
  Trash2, 
  Edit3, 
  Archive,
  RefreshCw,
  Briefcase
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/ToastContext';

interface HRContact {
  name: string;
  email: string;
  phone?: string;
  designation?: string;
}

interface Company {
  _id: string;
  name: string;
  sector: string;
  website?: string;
  hrContacts: HRContact[];
  hrContactsCount: number;
  preSystemHistory?: string;
  notes?: string;
  isArchived: boolean;
  driveCount: number;
  mostRecentDriveDate?: string | null;
  createdAt: string;
}

export default function CompaniesPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();

  const isStaff = session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'TPO';
  const isCoordinator = session?.user?.role === 'DEPT_COORDINATOR';

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    sector: '',
    website: '',
    notes: '',
    preSystemHistory: '',
    hrContacts: [{ name: '', email: '', phone: '', designation: '' }],
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (sectorFilter) params.set('sector', sectorFilter);
      if (showArchived) params.set('includeArchived', 'true');

      const res = await fetch(`/api/companies?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load companies');
      const data = await res.json();
      setCompanies(data.data || []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error fetching companies', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, sectorFilter, showArchived, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCompanies();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchCompanies]);

  const openCreateModal = () => {
    setEditingCompany(null);
    setFormData({
      name: '',
      sector: '',
      website: '',
      notes: '',
      preSystemHistory: '',
      hrContacts: [{ name: '', email: '', phone: '', designation: '' }],
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (comp: Company) => {
    setEditingCompany(comp);
    setFormData({
      name: comp.name,
      sector: comp.sector,
      website: comp.website || '',
      notes: comp.notes || '',
      preSystemHistory: comp.preSystemHistory || '',
      hrContacts:
        comp.hrContacts.length > 0
          ? comp.hrContacts.map((c) => ({
              name: c.name,
              email: c.email,
              phone: c.phone || '',
              designation: c.designation || '',
            }))
          : [{ name: '', email: '', phone: '', designation: '' }],
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    const validHrContacts = formData.hrContacts.filter(
      (c) => c.name.trim() !== '' && c.email.trim() !== ''
    );

    const payload = {
      name: formData.name.trim(),
      sector: formData.sector.trim(),
      website: formData.website.trim() || undefined,
      notes: formData.notes.trim() || undefined,
      preSystemHistory: formData.preSystemHistory.trim() || undefined,
      hrContacts: validHrContacts,
    };

    try {
      const url = editingCompany ? `/api/companies/${editingCompany._id}` : '/api/companies';
      const method = editingCompany ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to save company');
      }

      showToast(
        editingCompany ? 'Company updated successfully' : 'Company added successfully',
        'success'
      );
      setIsModalOpen(false);
      fetchCompanies();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const res = await fetch(`/api/companies/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete company');
      }

      showToast('Company deleted successfully', 'success');
      setDeleteTarget(null);
      fetchCompanies();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error deleting company', 'error');
    }
  };

  const handleToggleArchive = async (comp: Company) => {
    try {
      const res = await fetch(`/api/companies/${comp._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: !comp.isArchived }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update company');

      showToast(comp.isArchived ? 'Company restored' : 'Company archived', 'success');
      fetchCompanies();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error updating company', 'error');
    }
  };

  const sectors = Array.from(new Set(companies.map((c) => c.sector))).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Company Directory</h1>
          <p className="text-sm text-slate-500">
            Corporate recruiters, hiring history, and HR contacts for DYPCET campus drives.
          </p>
        </div>
        {isStaff && (
          <Button onClick={openCreateModal} variant="primary" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Company
          </Button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-1 w-full flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by company name, sector, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
          >
            <option value="">All Sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-end">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Show Archived
          </label>
          <Button onClick={fetchCompanies} variant="outline" size="sm" className="flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Companies Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse space-y-4">
              <div className="h-6 bg-slate-100 rounded-sm w-3/4"></div>
              <div className="h-4 bg-slate-100 rounded-sm w-1/2"></div>
              <div className="h-16 bg-slate-50 rounded-sm"></div>
            </div>
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800">No companies found</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {search || sectorFilter
              ? 'No recruiting companies matched your current search filters.'
              : 'Start by registering visiting companies for campus placement drives.'}
          </p>
          {isStaff && (
            <Button onClick={openCreateModal} variant="primary" size="sm">
              Add First Company
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((comp) => (
            <div
              key={comp._id}
              className={`bg-white rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                comp.isArchived
                  ? 'border-slate-200 bg-slate-50/60 opacity-75'
                  : 'border-slate-200/90 hover:border-slate-300 hover:shadow-md'
              }`}
            >
              <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 text-base line-clamp-1">{comp.name}</h3>
                      {comp.isArchived && <Badge variant="neutral">Archived</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium border border-blue-100">
                        {comp.sector}
                      </span>
                      {comp.website && (
                        <a
                          href={comp.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1"
                        >
                          Website <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Drive Stats */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                    <span>Drives Conducted:</span>
                  </div>
                  <span className="font-semibold text-slate-800">{comp.driveCount}</span>
                </div>

                {/* HR Contacts Section */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    HR Contacts ({comp.hrContactsCount})
                  </div>
                  {isCoordinator ? (
                    <p className="text-xs text-slate-400 italic">
                      HR contact details restricted to central TPO.
                    </p>
                  ) : comp.hrContacts.length === 0 ? (
                    <p className="text-xs text-slate-400">No HR contacts on record.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {comp.hrContacts.map((contact, idx) => (
                        <div key={idx} className="text-xs text-slate-600 bg-slate-50 p-2 rounded-md border border-slate-100 space-y-0.5">
                          <div className="font-medium text-slate-800 flex justify-between">
                            <span>{contact.name}</span>
                            {contact.designation && (
                              <span className="text-[10px] text-slate-400 font-normal">{contact.designation}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-slate-500">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <a href={`mailto:${contact.email}`} className="hover:text-blue-600 truncate">
                              {contact.email}
                            </a>
                          </div>
                          {contact.phone && (
                            <div className="flex items-center gap-1 text-slate-500">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <a href={`tel:${contact.phone}`} className="hover:text-blue-600">
                                {contact.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes if any */}
                {comp.notes && (
                  <p className="text-xs text-slate-500 line-clamp-2 border-t border-slate-100 pt-2">
                    {comp.notes}
                  </p>
                )}
              </div>

              {/* Actions Footer */}
              {isStaff && (
                <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs">
                  <Button
                    onClick={() => handleToggleArchive(comp)}
                    variant="ghost"
                    size="sm"
                    className="text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    {comp.isArchived ? 'Restore' : 'Archive'}
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => openEditModal(comp)}
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      onClick={() => setDeleteTarget(comp)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Company Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCompany ? 'Edit Company' : 'Register New Company'}
        description="Add company profile, sector, and official recruiter contacts."
        maxWidth="lg"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Tata Consultancy Services"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sector *</label>
              <input
                type="text"
                required
                value={formData.sector}
                onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                placeholder="e.g. IT Services / Manufacturing"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Website URL</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://company.com"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* HR Contacts */}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">HR Contacts</label>
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    hrContacts: [...formData.hrContacts, { name: '', email: '', phone: '', designation: '' }],
                  })
                }
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add Contact
              </button>
            </div>

            {formData.hrContacts.map((contact, index) => (
              <div key={index} className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Contact Name"
                    value={contact.name}
                    onChange={(e) => {
                      const updated = [...formData.hrContacts];
                      updated[index].name = e.target.value;
                      setFormData({ ...formData, hrContacts: updated });
                    }}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                  />
                  <input
                    type="email"
                    placeholder="Work Email"
                    value={contact.email}
                    onChange={(e) => {
                      const updated = [...formData.hrContacts];
                      updated[index].email = e.target.value;
                      setFormData({ ...formData, hrContacts: updated });
                    }}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Phone"
                    value={contact.phone}
                    onChange={(e) => {
                      const updated = [...formData.hrContacts];
                      updated[index].phone = e.target.value;
                      setFormData({ ...formData, hrContacts: updated });
                    }}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Designation / Role"
                    value={contact.designation}
                    onChange={(e) => {
                      const updated = [...formData.hrContacts];
                      updated[index].designation = e.target.value;
                      setFormData({ ...formData, hrContacts: updated });
                    }}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Pre-System / Historical Notes</label>
            <textarea
              rows={2}
              value={formData.preSystemHistory}
              onChange={(e) => setFormData({ ...formData, preSystemHistory: e.target.value })}
              placeholder="e.g. Visited in 2022, hired 15 students at 4.5 LPA."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={formSubmitting}>
              {formSubmitting ? 'Saving...' : editingCompany ? 'Update Company' : 'Create Company'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Company Record"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? Companies with past or active placement drives cannot be deleted.`}
        confirmText="Delete Company"
        variant="danger"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
