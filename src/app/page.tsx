'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  Star, 
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import DashboardChart from '@/components/DashboardChart';

interface UpcomingSession {
  _id: string;
  title: string;
  date: string;
  trainer: string;
}

interface SessionRating {
  title: string;
  averageRating: number;
}

interface StatsData {
  totalStudents: number;
  totalSessions: number;
  averageRating: number;
  sessionRatings: SessionRating[];
  upcomingSessions: UpcomingSession[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/dashboard-stats');
        if (!res.ok) {
          throw new Error('Failed to fetch dashboard stats');
        }
        const data = await res.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message || 'An error occurred while loading dashboard statistics.');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 bg-white border border-red-100 rounded-2xl text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-slate-800">Failed to Load Dashboard</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-md">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const { totalStudents, totalSessions, averageRating, sessionRatings, upcomingSessions } = stats!;

  return (
    <div className="space-y-8">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-center justify-between p-6 bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 hover:shadow-md transition-all duration-200">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Students</p>
            <h3 className="text-3xl font-extrabold text-slate-800 mt-2">{totalStudents}</h3>
            <p className="text-xs text-slate-500 mt-1">Registered in directory</p>
          </div>
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="flex items-center justify-between p-6 bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 hover:shadow-md transition-all duration-200">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Sessions</p>
            <h3 className="text-3xl font-extrabold text-slate-800 mt-2">{totalSessions}</h3>
            <p className="text-xs text-slate-500 mt-1">Conducted & scheduled</p>
          </div>
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Calendar className="h-6 w-6" />
          </div>
        </div>

        <div className="flex items-center justify-between p-6 bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 hover:shadow-md transition-all duration-200">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Average Rating</p>
            <div className="flex items-baseline gap-2 mt-2">
              <h3 className="text-3xl font-extrabold text-slate-800">{averageRating.toFixed(2)}</h3>
              <span className="text-sm font-semibold text-slate-400">/ 5.0</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">From student feedback</p>
          </div>
          <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
            <Star className="h-6 w-6 fill-current" />
          </div>
        </div>
      </div>

      {/* Stats Chart and Table Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Session Performance</h3>
              <p className="text-xs text-slate-400 mt-0.5">Average feedback ratings across sessions</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full">
              <TrendingUp className="h-3.5 w-3.5" />
              Rating metrics
            </div>
          </div>
          
          {sessionRatings.length > 0 ? (
            <DashboardChart data={sessionRatings} />
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] border border-dashed border-slate-200 rounded-2xl text-center">
              <TrendingUp className="h-10 w-10 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-500">No session rating data available yet</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Upcoming Sessions</h3>
              <p className="text-xs text-slate-400 mt-0.5">Next scheduled classes</p>
            </div>
            <Link 
              href="/sessions" 
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-colors"
              title="Schedule a session"
            >
              <Plus className="h-5 w-5" />
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[300px] pr-1 space-y-3.5">
            {upcomingSessions.length > 0 ? (
              upcomingSessions.map((session) => (
                <div 
                  key={session._id} 
                  className="p-3.5 border border-slate-100 rounded-xl hover:border-blue-100 hover:bg-blue-50/20 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-900 transition-colors">
                        {session.title}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Trainer: <span className="font-medium">{session.trainer || 'Unassigned'}</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(session.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <Link
                      href={`/sessions/${session._id}`}
                      className="p-1.5 bg-slate-50 text-slate-500 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 border border-dashed border-slate-200 rounded-xl text-center">
                <Calendar className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No upcoming sessions</p>
                <Link
                  href="/sessions"
                  className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  Schedule one now
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
