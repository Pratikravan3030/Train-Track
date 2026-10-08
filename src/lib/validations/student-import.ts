import { z } from 'zod';
import {
  VALID_PASSOUT_YEARS,
  PLACEMENT_STATUSES,
  PlacementStatus,
} from '@/config/collegeConfig';

export const normalizeHeader = (header: string): string => {
  const clean = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean === 'name' || clean === 'studentname' || clean === 'fullname') return 'name';
  if (clean === 'rollnumber' || clean === 'rollno' || clean === 'prn' || clean === 'prnnumber')
    return 'rollNumber';
  if (clean === 'department' || clean === 'dept' || clean === 'branch') return 'department';
  if (clean === 'year' || clean === 'academicyear' || clean === 'class') return 'year';
  if (clean === 'passoutyear' || clean === 'batch' || clean === 'gradyear') return 'passoutYear';
  if (clean === 'email' || clean === 'emailaddress') return 'email';
  if (clean === 'phone' || clean === 'mobile' || clean === 'contact' || clean === 'contactno')
    return 'phone';
  if (clean === 'cgpa' || clean === 'gpa') return 'cgpa';
  if (clean === 'backlogs' || clean === 'activebacklogs' || clean === 'kt') return 'backlogs';
  if (clean === 'placementstatus' || clean === 'status') return 'placementStatus';
  return header;
};

export const normalizeAcademicYear = (val: string): string => {
  const trimmed = val.trim();
  const lower = trimmed.toLowerCase();
  if (lower === '1' || lower === 'fe' || lower === 'first year' || lower === 'first') return 'First Year';
  if (lower === '2' || lower === 'se' || lower === 'second year' || lower === 'second') return 'Second Year';
  if (lower === '3' || lower === 'te' || lower === 'third year' || lower === 'third') return 'Third Year';
  if (lower === '4' || lower === 'be' || lower === 'final year' || lower === 'final') return 'Final Year';
  return trimmed || 'Final Year';
};

export const importStudentRowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  rollNumber: z.string().min(1, 'PRN / Roll Number is required').toUpperCase(),
  department: z.string().min(1, 'Department / Branch is required'),
  year: z.string().default('Final Year'),
  passoutYear: z
    .number()
    .int()
    .refine((y) => VALID_PASSOUT_YEARS.includes(y as (typeof VALID_PASSOUT_YEARS)[number]), {
      message: `Passout year must be between ${VALID_PASSOUT_YEARS[0]} and ${VALID_PASSOUT_YEARS[VALID_PASSOUT_YEARS.length - 1]}`,
    }),
  placementStatus: z
    .enum(PLACEMENT_STATUSES as [PlacementStatus, ...PlacementStatus[]])
    .default('Not Placed'),
  cgpa: z.number().min(0).max(10).optional(),
  backlogs: z.number().int().min(0).default(0),
  email: z.string().email('Valid email is required').toLowerCase().optional(),
  phone: z.string().max(20).optional(),
});

export type ImportStudentRow = z.infer<typeof importStudentRowSchema>;

export interface PreviewRowResult {
  rowNumber: number;
  original: Record<string, string>;
  parsedData?: ImportStudentRow;
  canonicalDepartment?: string;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
  duplicateType: 'file' | 'database' | null;
  duplicateDetails?: string;
}

export interface ImportPreviewResponse {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateCount: number;
  targetBatch: number;
  rows: PreviewRowResult[];
}
