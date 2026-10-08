'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  Building2,
  FileSpreadsheet,
  Download,
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Briefcase,
  GraduationCap,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/ToastContext';
import {
  DEFAULT_DEPARTMENT_NAMES,
  DEFAULT_ACADEMIC_YEARS,
  VALID_PASSOUT_YEARS,
  DEFAULT_PASSOUT_YEAR,
  CURRENT_ACADEMIC_YEAR,
  PLACEMENT_STATUSES,
  PlacementStatus,
} from '@/config/collegeConfig';
import type { ImportPreviewResponse } from '@/lib/validations/student-import';

interface PlacementDetails {
  companyName?: string;
  packageLPA?: number;
  placedDate?: string;
  reasonForStatusChange?: string;
}

interface Student {
  _id: string;
  name: string;
  rollNumber: string;
  department?: string;
  branch?: string;
  year: string;
  passoutYear: number;
  placementStatus?: PlacementStatus;
  placementDetails?: PlacementDetails;
  cgpa?: number;
  backlogs?: number;
  resumeUrl?: string;
  resumeFilename?: string;
  email?: string;
  phone?: string;
}

const DEFAULT_BRANCHES = DEFAULT_DEPARTMENT_NAMES;
const YEARS = DEFAULT_ACADEMIC_YEARS;

export default function StudentsPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const isPlacementAdmin = userRole === 'TPO' || userRole === 'SUPER_ADMIN';
  const canImportExport = userRole === 'TPO' || userRole === 'SUPER_ADMIN' || userRole === 'DEPT_COORDINATOR';

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<number>(DEFAULT_PASSOUT_YEAR);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [minCgpa, setMinCgpa] = useState<string>('');
  const [maxBacklogs, setMaxBacklogs] = useState<string>('');

  const [serverFacets, setServerFacets] = useState<{
    departmentCounts: Record<string, number>;
    yearCounts: Record<string, number>;
    totalAll: number;
  } | null>(null);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPlacementModalOpen, setIsPlacementModalOpen] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  // Registration & Edit Form State
  const [formData, setFormData] = useState<{
    name: string;
    rollNumber: string;
    department: string;
    year: string;
    passoutYear: number;
    cgpa: string;
    backlogs: string;
    email: string;
    phone: string;
  }>({
    name: '',
    rollNumber: '',
    department: DEFAULT_BRANCHES[0] || 'CSE',
    year: YEARS[0] || 'Final Year',
    passoutYear: DEFAULT_PASSOUT_YEAR,
    cgpa: '',
    backlogs: '0',
    email: '',
    phone: '',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Placement Status Form State
  const [placementForm, setPlacementForm] = useState<{
    status: PlacementStatus;
    companyName: string;
    packageLPA: string;
    placedDate: string;
    reasonForStatusChange: string;
  }>({
    status: 'Not Placed',
    companyName: '',
    packageLPA: '',
    placedDate: '',
    reasonForStatusChange: '',
  });
  const [placementError, setPlacementError] = useState('');
  const [updatingPlacement, setUpdatingPlacement] = useState(false);

  // Resume Upload State
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState('');

  // CSV Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewResponse | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const refreshStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('batch', selectedBatch.toString());
      if (selectedDepartment !== 'all') params.set('department', selectedDepartment);
      if (selectedYear !== 'all') params.set('year', selectedYear);
      if (selectedStatus !== 'all') params.set('placementStatus', selectedStatus);
      if (minCgpa) params.set('minCgpa', minCgpa);
      if (maxBacklogs) params.set('maxBacklogs', maxBacklogs);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('limit', '100');

      const res = await fetch(`/api/students?${params.toString()}`);
      if (res.ok) {
        const result = await res.json();
        setStudents(Array.isArray(result) ? result : result.data || []);
        if (result.facets) setServerFacets(result.facets);
        setError('');
      }
    } catch {
      // Ignore background refresh errors
    } finally {
      setLoading(false);
    }
  }, [selectedBatch, selectedDepartment, selectedYear, selectedStatus, minCgpa, maxBacklogs, searchQuery]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const params = new URLSearchParams();
        params.set('batch', selectedBatch.toString());
        if (selectedDepartment !== 'all') params.set('department', selectedDepartment);
        if (selectedYear !== 'all') params.set('year', selectedYear);
        if (selectedStatus !== 'all') params.set('placementStatus', selectedStatus);
        if (minCgpa) params.set('minCgpa', minCgpa);
        if (maxBacklogs) params.set('maxBacklogs', maxBacklogs);
        if (searchQuery.trim()) params.set('search', searchQuery.trim());
        params.set('limit', '100');

        const res = await fetch(`/api/students?${params.toString()}`);

        if (!res.ok) {
          if (res.status === 401) {
            if (!ignore) setError('Session expired. Redirecting to login...');
            setTimeout(() => {
              window.location.href = '/login';
            }, 1200);
            return;
          }

          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || `Failed to fetch students (Status ${res.status})`);
        }

        const result = await res.json();
        if (!ignore) {
          const studentList = Array.isArray(result) ? result : result.data || [];
          setStudents(studentList);
          if (result.facets) setServerFacets(result.facets);
          setError('');
        }
      } catch (err: unknown) {
        if (!ignore) {
          console.error('[StudentsPage fetch error]:', err);
          const message = err instanceof Error ? err.message : 'An error occurred while loading students.';
          setError(message);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [selectedBatch, selectedDepartment, selectedYear, selectedStatus, minCgpa, maxBacklogs, searchQuery]);

  const allBranches = useMemo(() => {
    const branchSet = new Set<string>(DEFAULT_BRANCHES);
    students.forEach((s) => {
      const dept = s.department || s.branch;
      if (dept && dept.trim()) {
        branchSet.add(dept.trim());
      }
    });
    return Array.from(branchSet);
  }, [students]);

  const departmentCounts = useMemo(() => {
    if (serverFacets?.departmentCounts) {
      const counts: Record<string, number> = { all: serverFacets.totalAll };
      allBranches.forEach((b) => {
        counts[b] = serverFacets.departmentCounts[b] || 0;
      });
      return counts;
    }
    const counts: Record<string, number> = { all: students.length };
    allBranches.forEach((b) => {
      counts[b] = 0;
    });
    students.forEach((s) => {
      const b = s.department || s.branch || 'Other';
      counts[b] = (counts[b] || 0) + 1;
    });
    return counts;
  }, [students, allBranches, serverFacets]);

  // Form Handlers
  const handleOpenAdd = () => {
    setFormData({
      name: '',
      rollNumber: '',
      department: selectedDepartment !== 'all' ? selectedDepartment : DEFAULT_BRANCHES[0],
      year: selectedYear !== 'all' ? selectedYear : YEARS[0],
      passoutYear: selectedBatch,
      cgpa: '',
      backlogs: '0',
      email: '',
      phone: '',
    });
    setFormError('');
    setIsAddOpen(true);
  };

  const handleOpenEdit = (student: Student) => {
    setActiveStudent(student);
    setFormData({
      name: student.name,
      rollNumber: student.rollNumber,
      department: student.department || student.branch || DEFAULT_BRANCHES[0],
      year: student.year || YEARS[0],
      passoutYear: student.passoutYear || selectedBatch,
      cgpa: student.cgpa !== undefined ? student.cgpa.toString() : '',
      backlogs: student.backlogs !== undefined ? student.backlogs.toString() : '0',
      email: student.email || '',
      phone: student.phone || '',
    });
    setFormError('');
    setIsEditOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return setFormError('Name is required.');
    if (!formData.rollNumber.trim()) return setFormError('Roll Number / PRN is required.');

    setSubmitting(true);
    setFormError('');

    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        rollNumber: formData.rollNumber.trim().toUpperCase(),
        department: formData.department,
        year: formData.year,
        passoutYear: Number(formData.passoutYear),
        backlogs: parseInt(formData.backlogs, 10) || 0,
      };
      if (formData.cgpa) payload.cgpa = parseFloat(formData.cgpa);
      if (formData.email.trim()) payload.email = formData.email.trim();
      if (formData.phone.trim()) payload.phone = formData.phone.trim();

      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create student');

      setIsAddOpen(false);
      toast.success('Student registered successfully!');
      refreshStudents();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Server error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent) return;
    if (!formData.name.trim()) return setFormError('Name is required.');
    if (!formData.rollNumber.trim()) return setFormError('Roll Number / PRN is required.');

    setSubmitting(true);
    setFormError('');

    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        rollNumber: formData.rollNumber.trim().toUpperCase(),
        department: formData.department,
        year: formData.year,
        passoutYear: Number(formData.passoutYear),
        backlogs: parseInt(formData.backlogs, 10) || 0,
      };
      if (formData.cgpa) payload.cgpa = parseFloat(formData.cgpa);
      if (formData.email.trim()) payload.email = formData.email.trim();
      if (formData.phone.trim()) payload.phone = formData.phone.trim();

      const res = await fetch(`/api/students/${activeStudent._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update student');

      setIsEditOpen(false);
      toast.success('Student record updated successfully!');
      refreshStudents();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Server error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  // Placement Status Governance Handlers
  const handleOpenPlacementModal = (student: Student) => {
    setActiveStudent(student);
    setPlacementForm({
      status: student.placementStatus || 'Not Placed',
      companyName: student.placementDetails?.companyName || '',
      packageLPA: student.placementDetails?.packageLPA ? student.placementDetails.packageLPA.toString() : '',
      placedDate: student.placementDetails?.placedDate
        ? new Date(student.placementDetails.placedDate).toISOString().split('T')[0]
        : '',
      reasonForStatusChange: '',
    });
    setPlacementError('');
    setIsPlacementModalOpen(true);
  };

  const handlePlacementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent) return;

    // Rule: moving out of Placed strictly requires a reason
    const movingOutOfPlaced =
      activeStudent.placementStatus === 'Placed' && placementForm.status !== 'Placed';
    if (movingOutOfPlaced && !placementForm.reasonForStatusChange.trim()) {
      setPlacementError(
        "A mandatory reason is required by placement policy when moving a student out of 'Placed' status."
      );
      return;
    }

    setUpdatingPlacement(true);
    setPlacementError('');

    try {
      const payload: Record<string, unknown> = {
        placementStatus: placementForm.status,
      };

      if (placementForm.status === 'Placed') {
        payload.placementDetails = {
          companyName: placementForm.companyName.trim(),
          packageLPA: parseFloat(placementForm.packageLPA) || 0,
          placedDate: placementForm.placedDate ? new Date(placementForm.placedDate) : new Date(),
        };
      }

      if (movingOutOfPlaced) {
        payload.statusChangeReason = placementForm.reasonForStatusChange.trim();
      }

      const res = await fetch(`/api/students/${activeStudent._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update placement status');

      setIsPlacementModalOpen(false);
      toast.success(`Placement status updated to "${placementForm.status}"`);
      refreshStudents();
    } catch (err: unknown) {
      setPlacementError(err instanceof Error ? err.message : 'Server error occurred.');
    } finally {
      setUpdatingPlacement(false);
    }
  };

  // Resume Upload Handlers
  const handleOpenResumeModal = (student: Student) => {
    setActiveStudent(student);
    setResumeFile(null);
    setResumeError('');
    setIsResumeModalOpen(true);
  };

  const handleResumeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent || !resumeFile) {
      setResumeError('Please select a PDF resume file.');
      return;
    }

    if (resumeFile.size > 5 * 1024 * 1024) {
      setResumeError('File size exceeds the 5MB limit.');
      return;
    }

    setUploadingResume(true);
    setResumeError('');

    try {
      const formData = new FormData();
      formData.append('file', resumeFile);

      const res = await fetch(`/api/students/${activeStudent._id}/resume`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload resume');

      setIsResumeModalOpen(false);
      toast.success('Student resume uploaded successfully!');
      refreshStudents();
    } catch (err: unknown) {
      setResumeError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingResume(false);
    }
  };

  // CSV Import Handlers
  const handlePreviewImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      setImportError('Please select a CSV file.');
      return;
    }

    setPreviewLoading(true);
    setImportError('');
    setImportPreview(null);

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('batch', selectedBatch.toString());

      const res = await fetch('/api/students/import/preview', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse CSV preview');

      setImportPreview(data);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Preview generation failed.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.validRows === 0) return;
    if (importPreview.duplicateCount > 0) {
      setImportError('Cannot proceed with import while duplicate PRN conflicts exist. Please resolve duplicate rows in your CSV.');
      return;
    }

    setImporting(true);
    setImportError('');

    try {
      const validStudents = importPreview.rows
        .filter((r) => r.isValid && r.parsedData)
        .map((r) => r.parsedData);

      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch: selectedBatch,
          students: validStudents,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import execution failed');

      toast.success(`Import complete! ${data.count} students added to Batch ${selectedBatch}.`);
      setIsImportModalOpen(false);
      setImportPreview(null);
      setImportFile(null);
      refreshStudents();
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const downloadSampleCsv = () => {
    const sample = [
      'PRN / Roll Number,Student Name,Department,Academic Year,Passout Year,CGPA,Active Backlogs,Email,Phone',
      'PRN2026CSE001,Aarav Patil,CSE,Final Year,2026,8.75,0,aarav.patil@dypcet.edu,9876543210',
      'PRN2026IT002,Sneha Kulkarni,IT,Final Year,2026,9.10,0,sneha.k@dypcet.edu,9876543211',
      'PRN2026ME003,Rohan Deshmukh,ME,Final Year,2026,7.95,1,rohan.d@dypcet.edu,9876543212',
    ].join('\n');

    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DYPCET-Student-Import-Template-Batch-${selectedBatch}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    params.set('batch', selectedBatch.toString());
    if (selectedDepartment !== 'all') params.set('department', selectedDepartment);
    if (selectedStatus !== 'all') params.set('placementStatus', selectedStatus);

    window.open(`/api/students/export?${params.toString()}`, '_blank');
    toast.success(`Exporting roster for Batch ${selectedBatch}...`);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/students/${deleteTarget._id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to delete student');
      }

      toast.success(`Student "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      refreshStudents();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete student');
    } finally {
      setDeleting(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedDepartment('all');
    setSelectedYear('all');
    setSelectedStatus('all');
    setMinCgpa('');
    setMaxBacklogs('');
    setSearchQuery('');
  };

  const getStatusBadge = (status?: PlacementStatus, details?: PlacementDetails) => {
    switch (status) {
      case 'Placed':
        return (
          <div className="space-y-0.5">
            <Badge variant="success" size="sm" dot>
              Placed
            </Badge>
            {details?.companyName && (
              <div className="text-[11px] font-bold text-slate-800">
                {details.companyName} {details.packageLPA ? `• ${details.packageLPA} LPA` : ''}
              </div>
            )}
          </div>
        );
      case 'Opted Out':
        return (
          <Badge variant="warning" size="sm" dot>
            Opted Out
          </Badge>
        );
      case 'Higher Studies':
        return (
          <Badge variant="info" size="sm" dot>
            Higher Studies
          </Badge>
        );
      case 'Entrepreneurship':
        return (
          <Badge variant="purple" size="sm" dot>
            Entrepreneurship
          </Badge>
        );
      case 'Not Placed':
      default:
        return (
          <Badge variant="neutral" size="sm" dot>
            Not Placed
          </Badge>
        );
    }
  };

  const isFiltered =
    selectedDepartment !== 'all' ||
    selectedYear !== 'all' ||
    selectedStatus !== 'all' ||
    minCgpa !== '' ||
    maxBacklogs !== '' ||
    searchQuery.trim() !== '';

  return (
    <div className="space-y-6">
      {/* Top Banner & Cohort Batch Switcher */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 bg-blue-500/30 text-blue-200 border border-blue-400/30 rounded-full text-xs font-bold">
                DYPCET Kasaba Bawada
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 rounded-full text-xs font-bold">
                Academic Year: {CURRENT_ACADEMIC_YEAR}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Student Cohort Directory</h1>
            <p className="text-xs text-blue-200/90 max-w-xl">
              Strict batch isolation active. Students, imports, resumes, and reports are partitioned by graduation year so cohorts never mix.
            </p>
          </div>

          {/* Cohort Batch Selector Dropdown */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-100 uppercase tracking-wider">
              <GraduationCap className="h-4 w-4 text-amber-300" />
              <span>Active Batch:</span>
            </div>
            <select
              aria-label="Active Cohort Batch"
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(Number(e.target.value))}
              className="px-3 py-1.5 bg-white text-slate-900 font-bold text-xs rounded-xl border border-white/40 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-amber-400 cursor-pointer"
            >
              {VALID_PASSOUT_YEARS.map((year) => (
                <option key={year} value={year}>
                  {year} Passout Batch {year === DEFAULT_PASSOUT_YEAR ? '(Current Final Year)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800">
            Batch {selectedBatch} Roster ({students.length} Students)
          </h2>
          <p className="text-xs text-slate-500">Filter, search, track placements, and manage student credentials</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canImportExport && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="text-xs font-bold text-slate-700 hover:text-slate-900"
              >
                <Download className="h-3.5 w-3.5 mr-1 text-slate-500" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportPreview(null);
                  setImportFile(null);
                  setImportError('');
                  setIsImportModalOpen(true);
                }}
                className="text-xs font-bold text-slate-700 hover:text-slate-900"
              >
                <Upload className="h-3.5 w-3.5 mr-1 text-slate-500" />
                Import CSV
              </Button>
            </>
          )}

          <Button variant="primary" size="sm" onClick={handleOpenAdd} className="text-xs font-bold">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Filter and Search Container */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        {/* Department Tabs */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <Building2 className="h-3.5 w-3.5 text-blue-600" />
            <span>Filter By Department</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedDepartment('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedDepartment === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <span>All Departments</span>
              <span className="px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-white/20">
                {students.length}
              </span>
            </button>
            {allBranches.map((dept) => {
              const count = departmentCounts[dept] || 0;
              const isSelected = selectedDepartment.toLowerCase() === dept.toLowerCase();
              return (
                <button
                  key={dept}
                  onClick={() => setSelectedDepartment(isSelected ? 'all' : dept)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                  }`}
                >
                  <span>{dept}</span>
                  <span className="px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-slate-200/60 text-slate-700">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Placement Status Tabs */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <Briefcase className="h-3.5 w-3.5 text-indigo-600" />
            <span>Filter By Placement Status</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedStatus === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              All Statuses
            </button>
            {PLACEMENT_STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(selectedStatus === status ? 'all' : status)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedStatus === status
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Search, Eligibility Criteria & Reset */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, PRN, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              placeholder="Min CGPA (e.g. 7.5)"
              value={minCgpa}
              onChange={(e) => setMinCgpa(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <input
              type="number"
              min="0"
              placeholder="Max Backlogs (e.g. 0)"
              value={maxBacklogs}
              onChange={(e) => setMaxBacklogs(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isFiltered && (
            <button
              onClick={handleResetFilters}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Student Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 animate-pulse">
            Loading student roster for Batch {selectedBatch}...
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="h-10 w-10 text-red-500 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <AlertCircle className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold text-slate-800">{error}</p>
            <Button variant="outline" size="sm" onClick={() => refreshStudents()} className="mt-3 text-xs">
              Retry
            </Button>
          </div>
        ) : students.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={`No students registered for Batch ${selectedBatch}`}
            description={
              isFiltered
                ? 'No students match your active filters. Try clearing search criteria.'
                : 'Get started by adding student profiles or importing roster via CSV.'
            }
            action={
              <Button
                variant={isFiltered ? 'outline' : 'primary'}
                size="sm"
                onClick={isFiltered ? handleResetFilters : handleOpenAdd}
              >
                {isFiltered ? 'Reset Filters' : 'Add First Student'}
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">PRN / Roll No</th>
                  <th className="py-3 px-4">Student Details</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Academics</th>
                  <th className="py-3 px-4">Placement Status</th>
                  <th className="py-3 px-4">Resume</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => {
                  const dept = student.department || student.branch || 'Unassigned';
                  return (
                    <tr key={student._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {student.rollNumber}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{student.name}</div>
                        <div className="text-[11px] text-slate-500">{student.email || 'No email provided'}</div>
                        {student.phone && (
                          <div className="text-[10px] text-slate-400">Mob: {student.phone}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="inline-block px-2 py-0.5 rounded-md font-bold text-[11px] bg-blue-50 text-blue-700 border border-blue-200/60">
                          {dept}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{student.year}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">
                          CGPA: {student.cgpa !== undefined ? student.cgpa.toFixed(2) : '—'}
                        </div>
                        <div className={`text-[10px] font-semibold ${
                          student.backlogs && student.backlogs > 0 ? 'text-amber-600' : 'text-slate-400'
                        }`}>
                          Backlogs: {student.backlogs ?? 0}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {getStatusBadge(student.placementStatus, student.placementDetails)}
                        {isPlacementAdmin && (
                          <button
                            onClick={() => handleOpenPlacementModal(student)}
                            className="mt-1 block text-[10px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                          >
                            Update Status
                          </button>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {student.resumeUrl ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={student.resumeUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold border border-slate-200 transition-colors"
                            >
                              <FileText className="h-3 w-3 text-red-500" />
                              View PDF
                            </a>
                            <button
                              onClick={() => handleOpenResumeModal(student)}
                              title="Replace Resume"
                              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                            >
                              <Upload className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenResumeModal(student)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-blue-600 cursor-pointer"
                          >
                            <Upload className="h-3 w-3" />
                            Upload
                          </button>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(student)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Student"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {userRole === 'SUPER_ADMIN' && (
                            <button
                              onClick={() => setDeleteTarget(student)}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Student"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 1. Add Student Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Register New Student" maxWidth="md">
        <form onSubmit={handleAddSubmit} className="space-y-4 pt-2">
          {formError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                placeholder="e.g. Aarav Patil"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Roll Number / PRN *</label>
              <input
                type="text"
                required
                value={formData.rollNumber}
                onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden uppercase"
                placeholder="e.g. PRN2026CSE042"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Department *</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {DEFAULT_BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Academic Year</label>
              <select
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Passout Year *</label>
              <select
                value={formData.passoutYear}
                onChange={(e) => setFormData({ ...formData, passoutYear: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {VALID_PASSOUT_YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">CGPA (0 - 10)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={formData.cgpa}
                onChange={(e) => setFormData({ ...formData, cgpa: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                placeholder="e.g. 8.45"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Active Backlogs</label>
              <input
                type="number"
                min="0"
                value={formData.backlogs}
                onChange={(e) => setFormData({ ...formData, backlogs: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                placeholder="student@dypcet.edu"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                placeholder="10-digit mobile"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" loading={submitting}>Register Student</Button>
          </div>
        </form>
      </Modal>

      {/* 2. Edit Student Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Student Record" maxWidth="md">
        <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
          {formError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Roll Number / PRN *</label>
              <input
                type="text"
                required
                value={formData.rollNumber}
                onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Department *</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {DEFAULT_BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Academic Year</label>
              <select
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Passout Year *</label>
              <select
                value={formData.passoutYear}
                onChange={(e) => setFormData({ ...formData, passoutYear: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {VALID_PASSOUT_YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">CGPA</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={formData.cgpa}
                onChange={(e) => setFormData({ ...formData, cgpa: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Active Backlogs</label>
              <input
                type="number"
                min="0"
                value={formData.backlogs}
                onChange={(e) => setFormData({ ...formData, backlogs: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" loading={submitting}>Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* 3. Placement Status Governance Modal */}
      <Modal
        isOpen={isPlacementModalOpen}
        onClose={() => setIsPlacementModalOpen(false)}
        title="Placement Status Governance"
        maxWidth="md"
      >
        <form onSubmit={handlePlacementSubmit} className="space-y-4 pt-2">
          {placementError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{placementError}</span>
            </div>
          )}

          {activeStudent && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-800">{activeStudent.name}</span>
                <span className="text-slate-500 ml-2">({activeStudent.rollNumber})</span>
              </div>
              <span className="text-slate-500 font-semibold">{activeStudent.department} • Batch {activeStudent.passoutYear}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Placement Status *</label>
            <select
              value={placementForm.status}
              onChange={(e) => setPlacementForm({ ...placementForm, status: e.target.value as PlacementStatus })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-bold"
            >
              {PLACEMENT_STATUSES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Conditional Placed Fields */}
          {placementForm.status === 'Placed' && (
            <div className="space-y-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={placementForm.companyName}
                  onChange={(e) => setPlacementForm({ ...placementForm, companyName: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  placeholder="e.g. Tata Consultancy Services (TCS)"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Package (LPA)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={placementForm.packageLPA}
                    onChange={(e) => setPlacementForm({ ...placementForm, packageLPA: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    placeholder="e.g. 7.50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Placed Date</label>
                  <input
                    type="date"
                    value={placementForm.placedDate}
                    onChange={(e) => setPlacementForm({ ...placementForm, placedDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Mandatory Reason when transitioning OUT of Placed */}
          {activeStudent?.placementStatus === 'Placed' && placementForm.status !== 'Placed' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Mandatory De-listing Reason Required</span>
              </div>
              <p className="text-[11px] text-amber-700">
                You are transitioning a student out of &apos;Placed&apos; status. In accordance with T&amp;P policy, provide an official audit reason (e.g. offer revoked by employer, student opted out, higher studies preference).
              </p>
              <textarea
                required
                rows={2}
                value={placementForm.reasonForStatusChange}
                onChange={(e) => setPlacementForm({ ...placementForm, reasonForStatusChange: e.target.value })}
                placeholder="Enter mandatory reason for moving out of Placed status..."
                className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setIsPlacementModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" loading={updatingPlacement}>
              Confirm Status Change
            </Button>
          </div>
        </form>
      </Modal>

      {/* 4. Resume Upload Modal */}
      <Modal isOpen={isResumeModalOpen} onClose={() => setIsResumeModalOpen(false)} title="Upload Student Resume" maxWidth="sm">
        <form onSubmit={handleResumeSubmit} className="space-y-4 pt-2">
          {resumeError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{resumeError}</span>
            </div>
          )}

          {activeStudent && (
            <div className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-700">
              Uploading for <span className="font-bold text-slate-900">{activeStudent.name}</span> ({activeStudent.rollNumber})
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Select PDF File (Max 5MB)</label>
            <input
              type="file"
              accept="application/pdf"
              required
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setIsResumeModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" type="submit" loading={uploadingResume}>Upload PDF</Button>
          </div>
        </form>
      </Modal>

      {/* 5. CSV Import & Duplicate Preview Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={`Import Students (Batch ${selectedBatch})`}
        maxWidth="xl"
      >
        <div className="space-y-4 pt-2">
          {importError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {!importPreview ? (
            <form onSubmit={handlePreviewImport} className="space-y-4">
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center space-y-2">
                <FileSpreadsheet className="h-8 w-8 text-blue-600 mx-auto" />
                <div className="text-xs font-bold text-slate-800">Upload CSV Roster File</div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Import will preview duplicate PRNs and validate department codes before applying changes.
                </p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  required
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer mx-auto max-w-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={downloadSampleCsv}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Sample CSV Template
                </button>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(false)}>Cancel</Button>
                  <Button variant="primary" size="sm" type="submit" loading={previewLoading}>Preview Roster</Button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Preview KPI Summary Cards */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-slate-500 text-[10px] font-bold uppercase">Total Rows</div>
                  <div className="text-base font-black text-slate-800">{importPreview.totalRows}</div>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="text-emerald-700 text-[10px] font-bold uppercase">Valid Rows</div>
                  <div className="text-base font-black text-emerald-800">{importPreview.validRows}</div>
                </div>
                <div className="p-2.5 bg-red-50 rounded-xl border border-red-200">
                  <div className="text-red-700 text-[10px] font-bold uppercase">Error Rows</div>
                  <div className="text-base font-black text-red-800">{importPreview.errorRows}</div>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="text-amber-800 text-[10px] font-bold uppercase">Duplicates</div>
                  <div className="text-base font-black text-amber-900">{importPreview.duplicateCount}</div>
                </div>
              </div>

              {/* Duplicate Conflicts Warning */}
              {importPreview.duplicateCount > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1 text-xs text-red-800">
                  <div className="flex items-center gap-1.5 font-bold">
                    <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                    <span>Duplicate PRN / Roll Numbers Found</span>
                  </div>
                  <p className="text-[11px] text-red-700">
                    Per college policy, duplicates cannot be silently merged. Fix or remove conflicting rows before continuing.
                  </p>
                </div>
              )}

              {/* Row Inspection Table */}
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl text-xs">
                <table className="w-full text-left divide-y divide-slate-200">
                  <thead className="bg-slate-50 font-bold text-[10px] uppercase text-slate-500 sticky top-0">
                    <tr>
                      <th className="p-2">Line</th>
                      <th className="p-2">PRN / Roll</th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Dept</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importPreview.rows.map((row) => (
                      <tr key={row.rowNumber} className={row.isValid ? 'bg-white' : 'bg-red-50/40'}>
                        <td className="p-2 font-mono text-[10px] text-slate-500">#{row.rowNumber}</td>
                        <td className="p-2 font-mono font-bold">{row.parsedData?.rollNumber || row.original.rollNumber || '—'}</td>
                        <td className="p-2">{row.parsedData?.name || row.original.name || '—'}</td>
                        <td className="p-2">{row.canonicalDepartment || row.original.department || '—'}</td>
                        <td className="p-2">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                              <CheckCircle2 className="h-3 w-3" /> Ready
                            </span>
                          ) : (
                            <div className="text-[10px] text-red-600 font-semibold space-y-0.5">
                              {row.errors.map((err, i) => (
                                <div key={i}>{err}</div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImportPreview(null);
                    setImportFile(null);
                  }}
                >
                  Upload Different File
                </Button>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={importPreview.duplicateCount > 0 || importPreview.validRows === 0}
                    loading={importing}
                    onClick={handleConfirmImport}
                  >
                    Import {importPreview.validRows} Students
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 6. Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Student Profile"
        description={`Are you sure you want to delete "${deleteTarget?.name}" (${deleteTarget?.rollNumber})? This will permanently remove the student and cascade delete all their attendance records and feedbacks.`}
        confirmText="Delete Student"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={executeDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
