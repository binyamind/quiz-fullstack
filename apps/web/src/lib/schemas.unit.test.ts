import { describe, expect, it } from 'vitest';
import {
  createAssignmentSchema,
  createClassSchema,
  createGroupSchema,
  createUserSchema,
  gradeSubmissionSchema,
  loginSchema,
} from './schemas.ts';

describe('schemas', () => {
  it('accepts a valid login and rejects an empty password', () => {
    expect(
      loginSchema.safeParse({ email: 'A@B.COM', password: 'x' }).success
    ).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(
      false
    );
  });

  it('accepts optional passwords on create user', () => {
    expect(
      createUserSchema.safeParse({
        email: 'a@b.com',
        name: 'Ada',
        role: 'admin',
      }).success
    ).toBe(true);
    expect(
      createUserSchema.safeParse({
        email: 'a@b.com',
        name: 'Ada',
        role: 'admin',
        password: '',
      }).success
    ).toBe(true);
  });

  it('validates groups, classes and assignments', () => {
    expect(createGroupSchema.safeParse({ name: 'Science' }).success).toBe(true);
    expect(
      createClassSchema.safeParse({
        name: 'Physics',
        teacherId: '00000000-0000-4000-8000-000000000000',
      }).success
    ).toBe(true);
    expect(
      createAssignmentSchema.safeParse({ title: 'Essay', maxGrade: 50 }).success
    ).toBe(true);
  });

  it('rejects a grade over the maximum', () => {
    expect(
      gradeSubmissionSchema.safeParse({ grade: 120, maxGrade: 100 }).success
    ).toBe(false);
    expect(
      gradeSubmissionSchema.safeParse({ grade: 80, maxGrade: 100 }).success
    ).toBe(true);
  });
});
