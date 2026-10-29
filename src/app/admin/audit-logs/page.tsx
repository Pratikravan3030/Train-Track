'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  Search, 
  RefreshCw, 
  Calendar, 
  FileText, 
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface AuditLogEntry {
  _id: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface PaginationState {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AuditLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationState>({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 1,
  });

  // Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') {
      router.push('/');
    }
  }, [status, session, router]);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '25');

      if (search.trim()) params.set('search', search.trim());
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (resourceFilter !== 'all') params.set('resource', resourceFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          setError('Access denied. Audit logs require SUPER_ADMIN privileges.');
          return;
        }
        throw new Error(`Failed to load audit logs: ${res.statusText}`);
      }

      const data = await res.json();
      setLogs(data.logs || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 25, totalPages: 1 });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred fetching logs');
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter, resourceFilter, startDate, endDate]);

  useEffect(() => {
    if (session?.user?.role === 'SUPER_ADMIN') {
      fetchLogs();
    }
  }, [fetchLogs, session]);

  const handleResetFilters = () => {
    setSearch('');
    setActionFilter('all');
    setResourceFilter('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const getActionBadge = (action: string) => {
    if (action.startsWith('CREATE') || action.startsWith('RESTORE') || action.includes('ACCEPT')) {
      return <Badge variant="success">{action}</Badge>;
    }
    if (action.startsWith('DELETE') || action.includes('REJECT') || action.includes('REVERSAL')) {
      return <Badge variant="danger">{action}</Badge>;
    }
    if (action.startsWith('UPDATE') || action.includes('OVERRIDE')) {
      return <Badge variant="warning">{action}</Badge>;
    }
    return <Badge variant="info">{action}</Badge>;
  };

  const formatISTDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Stats */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Trail & Compliance Log</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Immutable institutional activity records for compliance, integrity verification, and accountability.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
              Total Log Entries: {pagination.total}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLogs()}
              disabled={loading}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search action, email, ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>

            {/* Action Filter */}
            <div>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="all">All Actions</option>
                <option value="LOGIN">LOGIN</option>
                <option value="CREATE_STUDENT">CREATE_STUDENT</option>
                <option value="UPDATE_STUDENT">UPDATE_STUDENT</option>
                <option value="DELETE_STUDENT">DELETE_STUDENT</option>
                <option value="RESTORE_STUDENT">RESTORE_STUDENT</option>
                <option value="CREATE_DRIVE">CREATE_DRIVE</option>
                <option value="UPDATE_DRIVE">UPDATE_DRIVE</option>
                <option value="DELETE_DRIVE">DELETE_DRIVE</option>
                <option value="RESTORE_DRIVE">RESTORE_DRIVE</option>
                <option value="ACCEPT_OFFER">ACCEPT_OFFER</option>
                <option value="OFFER_STATUS_REVERSAL">OFFER_STATUS_REVERSAL</option>
                <option value="DELETE_COMPANY">DELETE_COMPANY</option>
                <option value="RESTORE_COMPANY">RESTORE_COMPANY</option>
              </select>
            </div>

            {/* Resource Filter */}
            <div>
              <select
                value={resourceFilter}
                onChange={(e) => {
                  setResourceFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="all">All Resources</option>
                <option value="Student">Student</option>
                <option value="Drive">Drive</option>
                <option value="Company">Company</option>
                <option value="Offer">Offer</option>
                <option value="TrainingSession">TrainingSession</option>
                <option value="User">User</option>
                <option value="Auth">Auth</option>
              </select>
            </div>

            {/* Start Date */}
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                placeholder="From date"
              />
            </div>

            {/* End Date */}
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                placeholder="To date"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} results)
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              Reset Filters
            </Button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp (IST)</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Triggered By</th>
                  <th className="py-3 px-4">IP / Agent</th>
                  <th className="py-3 px-4 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                      Loading audit entries...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                      No audit records found matching your active filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        {formatISTDate(log.createdAt)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{log.resource}</div>
                        {log.resourceId && (
                          <div className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">
                            {log.resourceId}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{log.userEmail || 'System / Guest'}</div>
                        {log.userRole && (
                          <Badge variant="purple" size="sm" className="text-[9px] mt-0.5">
                            {log.userRole}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-[11px] text-slate-500">
                        <div>{log.ipAddress || '—'}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                          {log.userAgent || '—'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {log.details ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            className="text-xs h-7 px-2.5"
                          >
                            Details
                          </Button>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs">
              <span className="text-slate-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1 || loading}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages || loading}
                  className="flex items-center gap-1"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Log Details Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Audit Record Details</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {selectedLog._id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-500 font-medium">Action:</span>
                    <div className="mt-0.5">{getActionBadge(selectedLog.action)}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Resource:</span>
                    <p className="font-semibold text-slate-800">{selectedLog.resource} {selectedLog.resourceId && `(${selectedLog.resourceId})`}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Triggered By:</span>
                    <p className="font-semibold text-slate-800">{selectedLog.userEmail || 'System'} ({selectedLog.userRole || 'N/A'})</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Timestamp:</span>
                    <p className="font-semibold text-slate-800">{formatISTDate(selectedLog.createdAt)}</p>
                  </div>
                </div>

                <div>
                  <span className="text-slate-700 font-bold block mb-1.5">Payload Details:</span>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-72">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
