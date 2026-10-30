/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  Star, 
  AlertCircle, 
  FileText, 
  ExternalLink, 
  Globe, 
  Briefcase, 
  Award, 
  Code2, 
  GraduationCap, 
  Lock, 
  Download 
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/ToastContext';

interface SessionDetails {
  _id: string;
  title: string;
  date: string;
  trainer?: string;
}

interface AttendanceRecord {
  _id: string;
  sessionId: SessionDetails | null;
  present: boolean;
  status?: string;
  remarks?: string;
  markedAt: string;
}

interface FeedbackRecord {
  _id: string;
  sessionId: SessionDetails | null;
  rating: number;
  comment: string;
  createdAt: string;
}

interface StudentDetailData {
  student: {
    _id: string;
    name: string;
    rollNumber: string;
    department?: string;
    branch?: string;
    year?: string;
    email?: string;
    phone?: string;
    gender?: string;
    dateOfBirth?: string;
    division?: string;
    passoutYear?: number;
    placementStatus?: string;
    placementDetails?: {
      companyName?: string;
      packageLPA?: number;
      placedDate?: string;
      reasonForStatusChange?: string;
    };
    cgpa?: number | null;
    backlogs?: number | null;
    backlogHistory?: {
      active: number;
      dead: number;
      cleared: number;
    };
    tenthPercentage?: number | null;
    twelfthOrDiplomaPercentage?: number | null;
    semesterSgpa?: number[];
    skills?: string[];
    certifications?: Array<{
      title: string;
      issuer: string;
      issueDate?: string;
      url?: string;
    }>;
    projects?: Array<{
      title: string;
      description?: string;
      techStack?: string[];
      githubUrl?: string;
      liveUrl?: string;
    }>;
    internships?: Array<{
      company: string;
      role: string;
      startDate?: string;
      endDate?: string;
      description?: string;
    }>;
    socialLinks?: {
      github?: string;
      linkedin?: string;
      portfolio?: string;
    };
    photoUrl?: string;
    photoStorageKey?: string;
    resumeUrl?: string;
    resumeStorageKey?: string;
    isDemographicsRedacted?: boolean;
  };
  attendance: AttendanceRecord[];
  feedback: FeedbackRecord[];
  completeness?: {
    totalPercentage: number;
    sections: {
      basic: { score: number; max: number; percentage: number; missing: string[] };
      academic: { score: number; max: number; percentage: number; missing: string[] };
      skillsAndResume: { score: number; max: number; percentage: number; missing: string[] };
      experience: { score: number; max: number; percentage: number; missing: string[] };
    };
    recommendations: string[];
  };
}

export default function StudentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();

  const [data, setData] = useState<StudentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'academics' | 'skills' | 'documents' | 'placements'>('academics');

  // Photo upload modal state
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const loadStudentDetails = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/students/${id}`);

      if (!res.ok) {
        if (res.status === 401) {
          setError('Session expired. Redirecting to login...');
          setTimeout(() => {
            window.location.href = '/login';
          }, 1200);
          return;
        }

        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Failed to load student details (${res.status})`);
      }

      const result = await res.json();
      setData(result);
      setError('');
    } catch (err: unknown) {
      console.error('[StudentDetailPage fetch error]:', err);
      const message = err instanceof Error ? err.message : 'An error occurred while loading profile.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadStudentDetails();
  }, [loadStudentDetails]);

  const handlePhotoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile) return;

    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append('file', photoFile);

      const res = await fetch(`/api/students/${id}/photo`, {
        method: 'POST',
        body: formData,
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to upload photo');

      toast.success('Profile photo uploaded successfully!');
      setIsPhotoModalOpen(false);
      setPhotoFile(null);
      loadStudentDetails();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 bg-white border border-red-100 rounded-2xl text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-slate-800">Failed to Load Profile</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-md">{error || 'Student profile not found.'}</p>
        <Link
          href="/students"
          className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition"
        >
          Back to Students
        </Link>
      </div>
    );
  }

  const { student, attendance, feedback, completeness } = data;
  const totalSessions = attendance.length;
  const sessionsAttended = attendance.filter((a) => a.present).length;
  const attendanceRate = totalSessions > 0 ? Math.round((sessionsAttended / totalSessions) * 100) : 0;
  const score = completeness?.totalPercentage || 0;

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link 
          href="/students" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Student Directory
        </Link>
        <span className="text-xs text-slate-400 font-mono">PRN: {student.rollNumber}</span>
      </div>

      {/* Completeness Meter Banner */}
      {completeness && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Profile Completeness</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                score >= 80 ? 'bg-emerald-50 text-emerald-700' : score >= 50 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {score}%
              </span>
            </div>
            {completeness.recommendations.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
                <span className="font-semibold text-slate-600">Suggested:</span>
                {completeness.recommendations.map((rec) => (
                  <span key={rec} className="px-2 py-0.5 bg-slate-100 rounded-md text-slate-700">
                    + {rec}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-blue-600' : 'bg-amber-500'
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      )}

      {/* Redaction Notice */}
      {student.isDemographicsRedacted && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium">
          <Lock className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Demographic protection enabled: Sensitive fields (Date of Birth, Gender, Phone Number) are restricted to TPO & Administrator access.
          </span>
        </div>
      )}

      {/* Profile Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Profile Avatar / Photo */}
            <div className="relative group shrink-0">
              {student.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt={student.name}
                  className="h-20 w-20 rounded-2xl object-cover border-2 border-slate-200 shadow-sm"
                />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 font-bold text-xl">
                  {student.name.charAt(0)}
                </div>
              )}
              <button
                onClick={() => setIsPhotoModalOpen(true)}
                className="absolute inset-0 bg-slate-900/60 rounded-2xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold cursor-pointer"
              >
                Change
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-800">{student.name}</h2>
                <Badge variant={student.placementStatus === 'Placed' ? 'success' : 'neutral'} size="sm">
                  {student.placementStatus || 'Not Placed'}
                </Badge>
              </div>
              <p className="text-xs font-mono text-slate-500">
                {student.rollNumber} {student.division && `• Div: ${student.division}`}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
                <span className="px-2 py-0.5 bg-slate-100 rounded-md font-semibold text-slate-700">
                  {student.department || student.branch || 'Unassigned'}
                </span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-semibold">
                  {student.year || 'Academic Year'}
                </span>
                {student.passoutYear && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md font-semibold">
                    Batch {student.passoutYear}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex gap-3 border-t sm:border-0 pt-4 sm:pt-0">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center min-w-[90px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">CGPA</span>
              <span className="text-base font-extrabold text-slate-800">
                {student.cgpa != null ? student.cgpa.toFixed(2) : 'N/A'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center min-w-[90px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Attendance</span>
              <span className="text-base font-extrabold text-emerald-600">{attendanceRate}%</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center min-w-[90px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Backlogs</span>
              <span className={`text-base font-extrabold ${student.backlogs ? 'text-red-600' : 'text-slate-800'}`}>
                {student.backlogs ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Demographics Row (if not redacted) */}
        {!student.isDemographicsRedacted && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 mt-5 pt-4 text-xs text-slate-600">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Date of Birth</span>
              <span className="font-semibold text-slate-700">
                {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : 'Not recorded'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Gender</span>
              <span className="font-semibold text-slate-700">{student.gender || 'Not specified'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Phone</span>
              <span className="font-semibold text-slate-700">{student.phone || 'Not recorded'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Profile Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('academics')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'academics'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Academics
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'skills'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Skills, Projects & Experience
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'documents'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Documents & Photo
        </button>
        <button
          onClick={() => setActiveTab('placements')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'placements'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Placements & Training History
        </button>
      </div>

      {/* Tab 1: Academics */}
      {activeTab === 'academics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-blue-600" />
              Academic Performance
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Overall CGPA</span>
                <span className="text-lg font-black text-slate-800">{student.cgpa ?? 'N/A'} / 10.0</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Division</span>
                <span className="text-lg font-black text-slate-800">{student.division || 'Unassigned'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">10th Standard</span>
                <span className="text-base font-bold text-slate-700">
                  {student.tenthPercentage != null ? `${student.tenthPercentage}%` : 'Not recorded'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">12th / Diploma</span>
                <span className="text-base font-bold text-slate-700">
                  {student.twelfthOrDiplomaPercentage != null ? `${student.twelfthOrDiplomaPercentage}%` : 'Not recorded'}
                </span>
              </div>
            </div>

            {/* Backlog Breakdown */}
            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 mb-2">Backlogs History</h4>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-red-50 text-red-700 rounded-lg">
                  <span className="text-[10px] font-bold block">Active</span>
                  <span className="font-extrabold">{student.backlogHistory?.active ?? student.backlogs ?? 0}</span>
                </div>
                <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                  <span className="text-[10px] font-bold block">Dead</span>
                  <span className="font-extrabold">{student.backlogHistory?.dead ?? 0}</span>
                </div>
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                  <span className="text-[10px] font-bold block">Cleared</span>
                  <span className="font-extrabold">{student.backlogHistory?.cleared ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Semester-wise SGPA */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Award className="h-4 w-4 text-indigo-600" />
              Semester SGPA Progression
            </h3>
            {student.semesterSgpa && student.semesterSgpa.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {student.semesterSgpa.map((sgpa, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 block">Sem {idx + 1}</span>
                    <span className="text-base font-extrabold text-indigo-700">{sgpa.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No semester SGPA records entered yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Skills & Projects */}
      {activeTab === 'skills' && (
        <div className="space-y-6">
          {/* Skills & Links */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Code2 className="h-4 w-4 text-emerald-600" />
                Technical Skills
              </h3>
              {student.skills && student.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {student.skills.map((s) => (
                    <span key={s} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition">
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No skills listed yet.</p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-800">Online Profiles</h3>
              <div className="space-y-2 text-xs">
                {student.socialLinks?.github && (
                  <a href={student.socialLinks.github} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
                    <Code2 className="h-4 w-4 text-slate-700" />
                    GitHub Profile
                  </a>
                )}
                {student.socialLinks?.linkedin && (
                  <a href={student.socialLinks.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
                    <Globe className="h-4 w-4 text-blue-700" />
                    LinkedIn Profile
                  </a>
                )}
                {student.socialLinks?.portfolio && (
                  <a href={student.socialLinks.portfolio} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
                    <Globe className="h-4 w-4 text-emerald-600" />
                    Personal Portfolio
                  </a>
                )}
                {!student.socialLinks?.github && !student.socialLinks?.linkedin && !student.socialLinks?.portfolio && (
                  <p className="text-slate-400 italic">No links added.</p>
                )}
              </div>
            </div>
          </div>

          {/* Projects & Internships split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Projects */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-indigo-600" />
                Projects ({student.projects?.length || 0})
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {student.projects && student.projects.length > 0 ? (
                  student.projects.map((p, idx) => (
                    <div key={idx} className="p-3.5 border border-slate-100 rounded-xl space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{p.title}</span>
                        <div className="flex items-center gap-2">
                          {p.githubUrl && (
                            <a href={p.githubUrl} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-800">
                              <Code2 className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {p.liveUrl && (
                            <a href={p.liveUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                      {p.description && <p className="text-slate-600">{p.description}</p>}
                      {p.techStack && p.techStack.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {p.techStack.map((tech) => (
                            <span key={tech} className="px-2 py-0.5 bg-slate-100 text-[10px] font-mono text-slate-600 rounded">
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No projects recorded.</p>
                )}
              </div>
            </div>

            {/* Internships & Certifications */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-600" />
                Internships & Certifications
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {student.internships && student.internships.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Internships</span>
                    {student.internships.map((intern, idx) => (
                      <div key={idx} className="p-3 border border-slate-100 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{intern.role}</span>
                          <span className="text-[10px] text-slate-500">{intern.startDate} - {intern.endDate || 'Present'}</span>
                        </div>
                        <p className="text-slate-600 font-medium">{intern.company}</p>
                        {intern.description && <p className="text-slate-500 text-[11px]">{intern.description}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {student.certifications && student.certifications.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Certifications</span>
                    {student.certifications.map((c, idx) => (
                      <div key={idx} className="p-3 border border-slate-100 rounded-xl text-xs flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800">{c.title}</p>
                          <p className="text-[11px] text-slate-500">{c.issuer} {c.issueDate && `• ${c.issueDate}`}</p>
                        </div>
                        {c.url && (
                          <a href={c.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {(!student.internships || student.internships.length === 0) &&
                 (!student.certifications || student.certifications.length === 0) && (
                  <p className="text-xs text-slate-400 italic">No internships or certifications added.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Documents & Photo */}
      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Photo Management */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Profile Photograph</h3>
            <div className="flex items-center gap-5">
              {student.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt={student.name}
                  className="h-28 w-28 rounded-2xl object-cover border-2 border-slate-200"
                />
              ) : (
                <div className="h-28 w-28 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-semibold text-xs border border-dashed border-slate-300">
                  No Photo
                </div>
              )}
              <div className="space-y-2 text-xs">
                <p className="text-slate-600">
                  Passport size photo for placement drive credentials and candidate rosters.
                </p>
                <button
                  onClick={() => setIsPhotoModalOpen(true)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-sm cursor-pointer"
                >
                  Upload / Replace Photo
                </button>
              </div>
            </div>
          </div>

          {/* Resume PDF */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Verified Resume Document</h3>
            {student.resumeUrl || student.resumeStorageKey ? (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">{student.rollNumber}-Resume.pdf</p>
                    <p className="text-[10px] text-slate-400">PDF Document • Stored securely</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/students/${student._id}/resume`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                  >
                    <Download className="h-3.5 w-3.5" />
                    View / Download
                  </a>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No resume PDF has been uploaded for this student.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Placements & Training */}
      {activeTab === 'placements' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance History */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                Training Attendance ({attendance.length})
              </h3>
              <Badge variant="purple" size="sm">
                {attendanceRate}% Present
              </Badge>
            </div>
            <div className="space-y-3 overflow-y-auto max-h-[360px] pr-1">
              {attendance.length > 0 ? (
                attendance.map((record) => (
                  <div key={record._id} className="p-3 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{record.sessionId?.title || 'Training Session'}</p>
                      <p className="text-[10px] text-slate-400">
                        {record.sessionId?.date ? new Date(record.sessionId.date).toLocaleDateString() : 'N/A'} • Trainer: {record.sessionId?.trainer || 'TPO'}
                      </p>
                    </div>
                    <Badge variant={record.present ? 'success' : 'danger'} size="sm">
                      {record.status || (record.present ? 'Present' : 'Absent')}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">No attendance records.</div>
              )}
            </div>
          </div>

          {/* Feedback History */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Feedback Submitted ({feedback.length})</h3>
            <div className="space-y-3 overflow-y-auto max-h-[360px] pr-1">
              {feedback.length > 0 ? (
                feedback.map((f) => (
                  <div key={f._id} className="p-3 border border-slate-100 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{f.sessionId?.title || 'Session Review'}</span>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, idx) => (
                          <Star key={idx} className={`h-3 w-3 ${idx < f.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}`} />
                        ))}
                      </div>
                    </div>
                    {f.comment && <p className="text-slate-600 italic bg-slate-50 p-2 rounded-lg">&ldquo;{f.comment}&rdquo;</p>}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">No feedback logged.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      <Modal isOpen={isPhotoModalOpen} onClose={() => setIsPhotoModalOpen(false)} title="Upload Student Photo">
        <form onSubmit={handlePhotoUpload} className="space-y-4">
          <p className="text-xs text-slate-500">
            Select a passport photo image (JPEG, PNG, or WebP). Maximum size 2MB.
          </p>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsPhotoModalOpen(false)}
              className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploadingPhoto || !photoFile}
              className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition disabled:opacity-50"
            >
              {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
