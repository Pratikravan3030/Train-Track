import { z } from 'zod';
import { ATTENDANCE_STATUSES } from '@/models/Attendance';

export const attendanceRecordItemSchema = z.object({
  studentId: z.string().trim().min(1, 'Student ID is required'),
  present: z.boolean().optional(),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  remarks: z.string().trim().optional(),
});

export const saveAttendanceSchema = z.object({
  sessionId: z.string().trim().min(1, 'Session ID is required'),
  records: z.array(attendanceRecordItemSchema).min(1, 'At least one attendance record is required'),
});

export const attendanceQuerySchema = z.object({
  sessionId: z.string().trim().min(1, 'Session ID is required'),
});

export type SaveAttendanceInput = z.infer<typeof saveAttendanceSchema>;
export type AttendanceQueryInput = z.infer<typeof attendanceQuerySchema>;
