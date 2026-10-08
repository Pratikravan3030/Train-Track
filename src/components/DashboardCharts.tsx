'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { BarChart3, LineChart as LineChartIcon } from 'lucide-react';

interface DeptData {
  department: string;
  students: number;
}

interface YearData {
  year: string;
  students: number;
}

interface RatingData {
  title: string;
  averageRating: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { [key: string]: unknown };
  }>;
  label?: string;
}

function DeptTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const item = payload[0].payload as unknown as DeptData;
    return (
      <div className="p-3 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-800 text-xs">
        <p className="font-semibold mb-1">{item.department}</p>
        <p className="text-blue-400 font-bold">{payload[0].value} Enrolled Students</p>
      </div>
    );
  }
  return null;
}

function YearTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const item = payload[0].payload as unknown as YearData;
    return (
      <div className="p-3 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-800 text-xs">
        <p className="font-semibold mb-1">{item.year}</p>
        <p className="text-indigo-400 font-bold">{payload[0].value} Enrolled Students</p>
      </div>
    );
  }
  return null;
}

function RatingTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const item = payload[0].payload as unknown as RatingData;
    return (
      <div className="p-3 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-800 text-xs">
        <p className="font-semibold mb-1">{item.title}</p>
        <p className="text-amber-400 font-bold">Rating: {Number(payload[0].value).toFixed(2)} / 5.0</p>
      </div>
    );
  }
  return null;
}

export function DepartmentChart({ data }: { data: DeptData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[260px] flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
        <BarChart3 className="h-8 w-8 text-slate-300 mb-2" />
        <p className="text-xs font-semibold text-slate-600">No Department Distribution Data</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Enroll students to visualize branch ratios.</p>
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="department"
            stroke="#94a3b8"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            dy={8}
            tickFormatter={(val) => (val.length > 12 ? `${val.substring(0, 10)}...` : val)}
          />
          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dx={-8} />
          <Tooltip content={<DeptTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} />
          <Bar dataKey="students" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function YearDistributionChart({ data }: { data: YearData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[260px] flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
        <LineChartIcon className="h-8 w-8 text-slate-300 mb-2" />
        <p className="text-xs font-semibold text-slate-600">No Year Trend Data</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Students per academic year will render here.</p>
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="yearGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="year" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dy={8} />
          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dx={-8} />
          <Tooltip content={<YearTooltip />} />
          <Area type="monotone" dataKey="students" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#yearGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RatingTrendChart({ data }: { data: RatingData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[260px] flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
        <LineChartIcon className="h-8 w-8 text-slate-300 mb-2" />
        <p className="text-xs font-semibold text-slate-600">No Session Feedback Yet</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Post-session student feedback ratings will plot here.</p>
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="title"
            stroke="#94a3b8"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            dy={8}
            tickFormatter={(val) => (val.length > 15 ? `${val.substring(0, 12)}...` : val)}
          />
          <YAxis stroke="#94a3b8" fontSize={10} domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tickLine={false} axisLine={false} dx={-8} />
          <Tooltip content={<RatingTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} />
          <Bar dataKey="averageRating" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
