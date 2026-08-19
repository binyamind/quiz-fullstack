export type Role = 'admin' | 'teacher' | 'student';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  suspended: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListEnvelope<T> {
  data: T[];
  limit?: number;
  offset?: number;
}

export interface TeacherGroup {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherGroupDetail extends TeacherGroup {
  members: PublicUser[];
}

export interface SchoolClass {
  id: string;
  name: string;
  description: string | null;
  teacherId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassDetail extends SchoolClass {
  teacher: PublicUser;
  students: PublicUser[];
}

export interface Assignment {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  maxGrade: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  content: string;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface ClassAverage {
  classId: string;
  className: string;
  averageGrade: number | null;
  gradedSubmissions: number;
}

export interface SchoolAverages {
  averageGrade: number | null;
  gradedSubmissions: number;
  perClass: ClassAverage[];
}

export interface ClassSummary {
  id: string;
  name: string;
  teacherName: string;
  studentCount: number;
}

export interface NamedPerson {
  id: string;
  name: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface FieldIssue {
  path: string;
  message: string;
}
