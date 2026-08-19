import { z } from 'zod';

export const roleSchema = z.enum(['admin', 'teacher', 'student']);

export const passwordSchema = z.string().min(8).max(200);

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1, 'Enter your password'),
});

export const createUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).max(200).trim(),
  role: roleSchema,
  password: passwordSchema.optional().or(z.literal('')),
});

export const updateUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).max(200).trim(),
  role: roleSchema,
});

export const setPasswordFormSchema = z.object({
  password: passwordSchema,
});

export const createGroupSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional().or(z.literal('')),
});

export const createClassSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional().or(z.literal('')),
  teacherId: z.string().uuid(),
});

export const createAssignmentSchema = z.object({
  title: z.string().min(1).max(300).trim(),
  description: z.string().max(10000).trim().optional().or(z.literal('')),
  dueAt: z.string().optional().or(z.literal('')),
  maxGrade: z.coerce.number().positive().max(1000),
  published: z.enum(['true', 'false']).optional(),
});

export const updateAssignmentSchema = z.object({
  title: z.string().min(1).max(300).trim(),
  description: z.string().max(10000).trim().optional().or(z.literal('')),
  dueAt: z.string().optional().or(z.literal('')),
  maxGrade: z.coerce.number().positive().max(1000),
});

export const submitWorkSchema = z.object({
  content: z.string().min(1).max(50000),
});

export const gradeSubmissionSchema = z.object({
  grade: z.coerce.number().min(0).max(1000),
  feedback: z.string().max(10000).trim().optional().or(z.literal('')),
  maxGrade: z.coerce.number().positive().max(1000),
}).refine((value) => value.grade <= value.maxGrade, {
  message: 'Grade cannot exceed the maximum',
  path: ['grade'],
});

export const chatMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});
