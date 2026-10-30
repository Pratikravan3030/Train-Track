'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  Award,
  Briefcase,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Loader2,
  ExternalLink,
  Globe,
  Trash2,
  Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface CertificationItem {
  name: string;
  issuer: string;
  issueDate?: string;
  url?: string;
}

interface ProjectItem {
  title: string;
  description?: string;
  technologies?: string[];
  link?: string;
}

interface InternshipItem {
  company: string;
  role: string;
  duration?: string;
  description?: string;
}

interface StudentFullProfile {
  student: {
    _id: string;
    name: string;
    rollNumber: string;
    department: string;
    passoutYear: number;
    cgpa?: number;
    backlogs?: number;
    division?: string;
    email?: string;
    photoUrl?: string;
    resumeUrl?: string;
    resumeFilename?: string;
    skills?: string[];
    certifications?: CertificationItem[];
    projects?: ProjectItem[];
    internships?: InternshipItem[];
    socialLinks?: {
      linkedin?: string;
      github?: string;
      portfolio?: string;
    };
  };
  completeness?: {
    percentage: number;
    recommendations?: string[];
  };
}

export default function StudentProfilePage() {
  const [loading, setLoading] = useState(true);
  const [portalDisabled, setPortalDisabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<'personal' | 'skills' | 'experience' | 'links' | 'documents'>('personal');

  const [profileData, setProfileData] = useState<StudentFullProfile | null>(null);

  // Form states
  const [division, setDivision] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [internships, setInternships] = useState<InternshipItem[]>([]);
  const [socialLinks, setSocialLinks] = useState({
    linkedin: '',
    github: '',
    portfolio: '',
  });

  // Upload states
  const photoInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/student/profile');
      if (res.status === 403) {
        setPortalDisabled(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load profile');
      }
      const data = await res.json();
      setProfileData(data);

      const st = data.student || {};
      setDivision(st.division || '');
      setSkills(st.skills || []);
      setCertifications(st.certifications || []);
      setProjects(st.projects || []);
      setInternships(st.internships || []);
      setSocialLinks({
        linkedin: st.socialLinks?.linkedin || '',
        github: st.socialLinks?.github || '',
        portfolio: st.socialLinks?.portfolio || '',
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error loading profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const payload = {
        division,
        skills,
        certifications,
        projects,
        internships,
        socialLinks,
      };

      const res = await fetch('/api/student/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setSuccessMessage('Profile updated successfully!');
      await fetchProfile();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/student/photo', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Photo upload failed');
      }

      setSuccessMessage('Profile photo updated successfully!');
      await fetchProfile();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingResume(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/student/resume', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Resume upload failed');
      }

      setSuccessMessage('Resume PDF updated successfully!');
      await fetchProfile();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Resume upload failed');
    } finally {
      setUploadingResume(false);
    }
  };

  const handleAddSkill = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = newSkillInput.trim().replace(/^,+|,+$/g, '');
      if (trimmed && !skills.includes(trimmed)) {
        setSkills([...skills, trimmed]);
        setNewSkillInput('');
      }
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">Loading student profile...</p>
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

  const { student, completeness } = profileData || {};

  return (
    <div className="space-y-6">
      {/* Top Banner / Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          {/* Avatar with Upload Trigger */}
          <div className="relative group shrink-0">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center overflow-hidden border-2 border-white shadow-md">
              {student?.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={student.photoUrl}
                  alt={student.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                student?.name?.charAt(0) || 'S'
              )}
            </div>

            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              title="Upload profile photo"
              className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors cursor-pointer"
            >
              {uploadingPhoto ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 truncate">{student?.name}</h1>
              <Badge variant="info" size="sm">
                {student?.department}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              PRN: {student?.rollNumber} • Passout Batch: {student?.passoutYear}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{student?.email}</p>
          </div>
        </div>

        {/* Completeness Meter */}
        {completeness && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 min-w-[200px] shrink-0">
            <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-800">
              <span>Profile Completeness</span>
              <span className="text-blue-600">{completeness.percentage}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${completeness.percentage}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">
              {completeness.recommendations?.length
                ? `${completeness.recommendations.length} action items suggested`
                : 'All sections up to date'}
            </p>
          </div>
        )}
      </div>

      {/* Notifications / Alerts */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2 text-xs font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto text-xs font-bold">
        {[
          { key: 'personal', label: 'Academic & Personal', icon: GraduationCap },
          { key: 'skills', label: 'Skills & Certifications', icon: Award },
          { key: 'experience', label: 'Projects & Internships', icon: Briefcase },
          { key: 'links', label: 'Social & Portfolio', icon: Globe },
          { key: 'documents', label: 'Resume & Documents', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6">
        {/* Tab 1: Personal & Academic Info */}
        {activeTab === 'personal' && (
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-500 leading-relaxed">
              <span className="font-bold text-slate-700 block mb-1">Academic Integrity Policy</span>
              Official institutional records (CGPA, active backlogs, department, and passout year) can only be updated by the Department Coordinator or Training & Placement Cell.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  disabled
                  value={student?.name || ''}
                  className="w-full text-xs p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Roll / PRN Number
                </label>
                <input
                  type="text"
                  disabled
                  value={student?.rollNumber || ''}
                  className="w-full text-xs p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Department
                </label>
                <input
                  type="text"
                  disabled
                  value={student?.department || ''}
                  className="w-full text-xs p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Passout Batch
                </label>
                <input
                  type="text"
                  disabled
                  value={student?.passoutYear || ''}
                  className="w-full text-xs p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Cumulative CGPA
                </label>
                <input
                  type="text"
                  disabled
                  value={student?.cgpa ? student.cgpa.toFixed(2) : 'Not Entered'}
                  className="w-full text-xs p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Active Backlogs
                </label>
                <input
                  type="text"
                  disabled
                  value={student?.backlogs ?? 0}
                  className="w-full text-xs p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Class Division / Section
                </label>
                <input
                  type="text"
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  placeholder="e.g. A, B, C"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}

        {/* Tab 2: Skills & Certifications */}
        {activeTab === 'skills' && (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Technical & Soft Skills
              </label>
              <p className="text-[11px] text-slate-400 mb-2">
                Type a skill and press Enter or comma (e.g. React, Node.js, Python, Public Speaking).
              </p>

              <div className="flex flex-wrap gap-2 p-3 rounded-2xl border border-slate-200 bg-slate-50/50 min-h-[50px] items-center">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="text-blue-400 hover:text-blue-700 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  onKeyDown={handleAddSkill}
                  placeholder="Add a skill and press Enter..."
                  className="flex-1 min-w-[150px] text-xs bg-transparent border-none focus:outline-none p-1"
                />
              </div>
            </div>

            {/* Certifications List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-800">Certifications</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCertifications([
                      ...certifications,
                      { name: '', issuer: '', issueDate: '', url: '' },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Certificate
                </Button>
              </div>

              {certifications.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">No certifications added yet.</p>
              ) : (
                <div className="space-y-3">
                  {certifications.map((cert, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex gap-3 items-start">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                        <input
                          type="text"
                          placeholder="Certificate Name (e.g. AWS Cloud Practitioner)"
                          value={cert.name || ''}
                          onChange={(e) => {
                            const updated = [...certifications];
                            updated[idx].name = e.target.value;
                            setCertifications(updated);
                          }}
                          className="text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Issuing Organization (e.g. Amazon, Coursera)"
                          value={cert.issuer || ''}
                          onChange={(e) => {
                            const updated = [...certifications];
                            updated[idx].issuer = e.target.value;
                            setCertifications(updated);
                          }}
                          className="text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setCertifications(certifications.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Skills & Certifications'}
              </Button>
            </div>
          </form>
        )}

        {/* Tab 3: Projects & Internships */}
        {activeTab === 'experience' && (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Projects */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-800">Academic & Personal Projects</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setProjects([
                      ...projects,
                      { title: '', description: '', technologies: [], link: '' },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Project
                </Button>
              </div>

              {projects.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">No projects listed yet.</p>
              ) : (
                <div className="space-y-3">
                  {projects.map((proj, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex gap-3 items-start">
                      <div className="space-y-2 flex-1">
                        <input
                          type="text"
                          placeholder="Project Title"
                          value={proj.title || ''}
                          onChange={(e) => {
                            const updated = [...projects];
                            updated[idx].title = e.target.value;
                            setProjects(updated);
                          }}
                          className="text-xs p-2.5 rounded-xl border border-slate-200 bg-white w-full"
                        />
                        <textarea
                          rows={2}
                          placeholder="Short summary of technologies used and problem solved..."
                          value={proj.description || ''}
                          onChange={(e) => {
                            const updated = [...projects];
                            updated[idx].description = e.target.value;
                            setProjects(updated);
                          }}
                          className="text-xs p-2.5 rounded-xl border border-slate-200 bg-white w-full"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setProjects(projects.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Internships */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-800">Internship Experience</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setInternships([
                      ...internships,
                      { company: '', role: '', duration: '', description: '' },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Internship
                </Button>
              </div>

              {internships.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">No internships added yet.</p>
              ) : (
                <div className="space-y-3">
                  {internships.map((intern, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex gap-3 items-start">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                        <input
                          type="text"
                          placeholder="Company / Organization"
                          value={intern.company || ''}
                          onChange={(e) => {
                            const updated = [...internships];
                            updated[idx].company = e.target.value;
                            setInternships(updated);
                          }}
                          className="text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Role / Designation"
                          value={intern.role || ''}
                          onChange={(e) => {
                            const updated = [...internships];
                            updated[idx].role = e.target.value;
                            setInternships(updated);
                          }}
                          className="text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setInternships(internships.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Experience'}
              </Button>
            </div>
          </form>
        )}

        {/* Tab 4: Links */}
        {activeTab === 'links' && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                LinkedIn Profile URL
              </label>
              <input
                type="url"
                value={socialLinks.linkedin}
                onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                placeholder="https://linkedin.com/in/username"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                GitHub Profile URL
              </label>
              <input
                type="url"
                value={socialLinks.github}
                onChange={(e) => setSocialLinks({ ...socialLinks, github: e.target.value })}
                placeholder="https://github.com/username"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Personal Portfolio or Website
              </label>
              <input
                type="url"
                value={socialLinks.portfolio}
                onChange={(e) => setSocialLinks({ ...socialLinks, portfolio: e.target.value })}
                placeholder="https://yourportfolio.com"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Links'}
              </Button>
            </div>
          </form>
        )}

        {/* Tab 5: Documents (Resume) */}
        {activeTab === 'documents' && (
          <div className="space-y-5">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">Placement Resume (PDF)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {student?.resumeUrl
                    ? `Current file: ${student.resumeFilename || 'resume.pdf'}`
                    : 'No resume uploaded yet. Placement coordinators use this file for company applications.'}
                </p>
                <p className="text-[10px] text-slate-400">Allowed format: PDF only, max 2MB.</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {student?.resumeUrl && (
                  <a
                    href={student.resumeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> View
                  </a>
                )}

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={uploadingResume}
                  onClick={() => resumeInputRef.current?.click()}
                  className="flex items-center gap-1.5"
                >
                  {uploadingResume ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {student?.resumeUrl ? 'Replace Resume' : 'Upload Resume'}
                </Button>
                <input
                  ref={resumeInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleResumeUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
