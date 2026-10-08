'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Eye, 
  AlertCircle,
  Users,
  Building2,
  Filter,
  X,
  RotateCcw
} from 'lucide-react';
import Link from 'next/link';
import Modal from '@/components/Modal';

interface Student {
  _id: string;
  name: string;
  rollNumber: string;
  branch: string;
  year: string;
  email: string;
}

const DEFAULT_BRANCHES = [
  'Computer Science & Engineering',
  'Information Technology',
  'Electronics & Communication Engineering',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Other'
];

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    rollNumber: '',
    branch: DEFAULT_BRANCHES[0],
    year: YEARS[0],
    email: '',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/students');

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
        throw new Error(errData?.error || `Failed to fetch students (Status ${res.status})`);
      }

      const data = await res.json();
      setStudents(Array.isArray(data) ? data : []);
      setError('');
    } catch (err: unknown) {
      console.error('[StudentsPage fetch error]:', err);
      const message = err instanceof Error ? err.message : 'An error occurred while loading students.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // Derive unique branches from existing students + predefined defaults
  const allBranches = useMemo(() => {
    const branchSet = new Set<string>(DEFAULT_BRANCHES);
    students.forEach((s) => {
      if (s.branch && s.branch.trim()) {
        branchSet.add(s.branch.trim());
      }
    });
    return Array.from(branchSet);
  }, [students]);

  // Compute student count per department
  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: students.length };
    allBranches.forEach((b) => {
      counts[b] = 0;
    });
    students.forEach((s) => {
      const b = s.branch?.trim() || 'Other';
      counts[b] = (counts[b] || 0) + 1;
    });
    return counts;
  }, [students, allBranches]);

  // Compute student count per year of study
  const yearCounts = useMemo(() => {
    const counts: Record<string, number> = { all: students.length };
    YEARS.forEach((y) => {
      counts[y] = 0;
    });
    students.forEach((s) => {
      const y = s.year?.trim();
      if (y && counts[y] !== undefined) {
        counts[y] = (counts[y] || 0) + 1;
      }
    });
    return counts;
  }, [students]);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      rollNumber: '',
      branch: selectedDepartment !== 'all' ? selectedDepartment : DEFAULT_BRANCHES[0],
      year: selectedYear !== 'all' ? selectedYear : YEARS[0],
      email: '',
    });
    setFormError('');
    setIsAddOpen(true);
  };

  const handleOpenEdit = (student: Student) => {
    setCurrentStudent(student);
    setFormData({
      name: student.name,
      rollNumber: student.rollNumber,
      branch: student.branch || DEFAULT_BRANCHES[0],
      year: student.year || YEARS[0],
      email: student.email || '',
    });
    setFormError('');
    setIsEditOpen(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) return 'Name is required.';
    if (!formData.rollNumber.trim()) return 'Roll Number is required.';
    if (formData.email.trim() && !/\S+@\S+\.\S+/.test(formData.email)) {
      return 'Please enter a valid email address.';
    }
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
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create student');
      }

      setIsAddOpen(false);
      fetchStudents();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Server error occurred.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStudent) return;

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const res = await fetch(`/api/students/${currentStudent._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update student');
      }

      setIsEditOpen(false);
      fetchStudents();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Server error occurred.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student? All their attendance and feedback logs will be permanently deleted.')) {
      return;
    }

    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete student');
      }

      fetchStudents();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete student';
      alert(message);
    }
  };

  const handleResetFilters = () => {
    setSelectedDepartment('all');
    setSelectedYear('all');
    setSearchQuery('');
  };

  // Filter students by selected department, year, and search query
  const filteredStudents = students.filter((student) => {
    // Department Filter
    const matchesDept = 
      selectedDepartment === 'all' || 
      (student.branch && student.branch.trim().toLowerCase() === selectedDepartment.trim().toLowerCase());

    // Year Filter
    const matchesYear = 
      selectedYear === 'all' || 
      (student.year && student.year.trim().toLowerCase() === selectedYear.trim().toLowerCase());

    // Search Query Filter
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      !query ||
      student.name.toLowerCase().includes(query) ||
      student.rollNumber.toLowerCase().includes(query) ||
      (student.email && student.email.toLowerCase().includes(query)) ||
      (student.branch && student.branch.toLowerCase().includes(query));

    return matchesDept && matchesYear && matchesSearch;
  });

  const isFiltered = selectedDepartment !== 'all' || selectedYear !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="space-y-6">
      {/* Header and Add Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Student Directory</h2>
          <p className="text-xs text-slate-500 mt-1">Manage student registrations, departments, and credentials</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 text-sm cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          Add Student
        </button>
      </div>

      {/* Filter Tabs Container */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 space-y-3.5">
        {/* Department Filter Row */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <Building2 className="h-3.5 w-3.5 text-blue-600" />
            <span>Select Department</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedDepartment('all')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedDepartment === 'all'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80'
              }`}
            >
              <span>All Departments</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                selectedDepartment === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-200/70 text-slate-600'
              }`}>
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
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80'
                  }`}
                >
                  <span>{dept}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                    isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200/70 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Year of Study Filter Row */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 mb-2 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <Filter className="h-3.5 w-3.5 text-indigo-600" />
            <span>Select Year of Study</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedYear('all')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedYear === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80'
              }`}
            >
              <span>All Years</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                selectedYear === 'all' ? 'bg-indigo-700 text-white' : 'bg-slate-200/70 text-slate-600'
              }`}>
                {students.length}
              </span>
            </button>

            {YEARS.map((year) => {
              const count = yearCounts[year] || 0;
              const isSelected = selectedYear.toLowerCase() === year.toLowerCase();
              return (
                <button
                  key={year}
                  onClick={() => setSelectedYear(isSelected ? 'all' : year)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80'
                  }`}
                >
                  <span>{year}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                    isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200/70 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">
        {/* Search and Filters Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search by name, roll number, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-xs transition-all bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Department Dropdown Selector */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="bg-transparent text-slate-700 font-medium focus:outline-none text-xs cursor-pointer"
              >
                <option value="all">All Departments ({students.length})</option>
                {allBranches.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept} ({departmentCounts[dept] || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Year Dropdown Filter */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
              <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent text-slate-700 font-medium focus:outline-none text-xs cursor-pointer"
              >
                <option value="all">All Years ({students.length})</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y} ({yearCounts[y] || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters Button */}
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Summary Status */}
        {isFiltered && (
          <div className="px-6 py-2.5 bg-blue-50/60 border-b border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-600">Active Filters:</span>
              {selectedDepartment !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-blue-100/90 text-blue-800 px-2 py-0.5 rounded-md font-semibold">
                  <span>Dept: {selectedDepartment}</span>
                  <button
                    onClick={() => setSelectedDepartment('all')}
                    className="hover:text-blue-950 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {selectedYear !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-indigo-100/90 text-indigo-800 px-2 py-0.5 rounded-md font-semibold">
                  <span>Year: {selectedYear}</span>
                  <button
                    onClick={() => setSelectedYear('all')}
                    className="hover:text-indigo-950 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {searchQuery.trim() !== '' && (
                <span className="inline-flex items-center gap-1 bg-slate-200/80 text-slate-800 px-2 py-0.5 rounded-md font-semibold">
                  <span>Search: &ldquo;{searchQuery}&rdquo;</span>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="hover:text-slate-950 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <span className="text-slate-500 font-medium ml-1">
                ({filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} found)
              </span>
            </div>
            <button
              onClick={handleResetFilters}
              className="text-blue-700 hover:text-blue-900 font-semibold underline text-[11px] cursor-pointer"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Contents */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
            <p className="text-sm font-semibold text-slate-700">Error loading student list</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md">{error}</p>
            <button
              onClick={() => fetchStudents()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors cursor-pointer shadow-sm"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <Users className="h-12 w-12 text-slate-300 mb-3" />
            <h4 className="text-sm font-bold text-slate-700">
              {searchQuery
                ? 'No matching students found'
                : selectedDepartment !== 'all'
                ? `No students found in ${selectedDepartment}`
                : 'No students yet – Add Student or Import CSV'}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {searchQuery 
                ? 'Try adjusting your keywords or search query to locate the record.' 
                : selectedDepartment !== 'all'
                ? `No student records found under ${selectedDepartment}. You can register students directly to this department or clear the department filter.`
                : 'Your student directory is currently empty. Get started by registering your first student in the coordination dashboard.'}
            </p>
            <div className="mt-4 flex items-center gap-3">
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors cursor-pointer"
              >
                {selectedDepartment !== 'all' ? `Add Student to ${selectedDepartment.split(' ')[0]}` : 'Add Student'}
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Roll Number</th>
                  <th className="px-6 py-4">Branch</th>
                  <th className="px-6 py-4">Year</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredStudents.map((student) => (
                  <tr key={student._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4.5 font-semibold text-slate-800">{student.name}</td>
                    <td className="px-6 py-4.5 font-mono text-slate-600">{student.rollNumber}</td>
                    <td className="px-6 py-4.5">{student.branch || '—'}</td>
                    <td className="px-6 py-4.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                        {student.year}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-slate-500">{student.email || '—'}</td>
                    <td className="px-6 py-4.5 text-right space-x-1 whitespace-nowrap">
                      <Link
                        href={`/students/${student._id}`}
                        className="inline-flex items-center justify-center p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="View profile"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleOpenEdit(student)}
                        className="inline-flex items-center justify-center p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit student"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(student._id)}
                        className="inline-flex items-center justify-center p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Delete student"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Register Student">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-medium rounded-lg flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Full Name *</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleFormChange}
              placeholder="e.g. John Doe"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Roll Number *</label>
            <input
              type="text"
              name="rollNumber"
              required
              value={formData.rollNumber}
              onChange={handleFormChange}
              placeholder="e.g. 21CS001"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Branch / Department</label>
            <select
              name="branch"
              value={formData.branch}
              onChange={handleFormChange}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white"
            >
              {allBranches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Year of Study</label>
            <select
              name="year"
              value={formData.year}
              onChange={handleFormChange}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleFormChange}
              placeholder="john.doe@college.edu"
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
              {submitting ? 'Registering...' : 'Register'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Modify Student Details">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-medium rounded-lg flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Full Name *</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleFormChange}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Roll Number *</label>
            <input
              type="text"
              name="rollNumber"
              required
              value={formData.rollNumber}
              onChange={handleFormChange}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Branch / Department</label>
            <select
              name="branch"
              value={formData.branch}
              onChange={handleFormChange}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white"
            >
              {allBranches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Year of Study</label>
            <select
              name="year"
              value={formData.year}
              onChange={handleFormChange}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleFormChange}
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
