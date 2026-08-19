import { apiFetch } from './api.ts';
import { queryString } from './format.ts';
import type {
  Assignment,
  ClassDetail,
  ClassSummary,
  ListEnvelope,
  NamedPerson,
  PublicUser,
  SchoolAverages,
  SchoolClass,
  Submission,
  TeacherGroup,
  TeacherGroupDetail,
} from './types.ts';

export function listUsers(filters: {
  search?: string;
  role?: string;
  suspended?: string;
  limit?: number;
  offset?: number;
}): Promise<ListEnvelope<PublicUser>> {
  return apiFetch(`/users${queryString(filters)}`);
}

export function getUser(id: string): Promise<PublicUser> {
  return apiFetch(`/users/${id}`);
}

export function listGroups(): Promise<ListEnvelope<TeacherGroup>> {
  return apiFetch('/teacher-groups');
}

export function getGroup(id: string): Promise<TeacherGroupDetail> {
  return apiFetch(`/teacher-groups/${id}`);
}

export function listClasses(filters: {
  teacherId?: string;
  studentId?: string;
} = {}): Promise<ListEnvelope<SchoolClass>> {
  return apiFetch(`/classes${queryString(filters)}`);
}

export function getClass(id: string): Promise<ClassDetail> {
  return apiFetch(`/classes/${id}`);
}

export function listClassAssignments(
  classId: string,
  published?: boolean
): Promise<ListEnvelope<Assignment>> {
  return apiFetch(
    `/classes/${classId}/assignments${queryString({
      published: published === undefined ? undefined : published,
    })}`
  );
}

export function getAssignment(id: string): Promise<Assignment> {
  return apiFetch(`/assignments/${id}`);
}

export function listAssignmentSubmissions(
  assignmentId: string
): Promise<ListEnvelope<Submission>> {
  return apiFetch(`/assignments/${assignmentId}/submissions`);
}

export function getSubmission(id: string): Promise<Submission> {
  return apiFetch(`/submissions/${id}`);
}

export function listStudentClasses(
  studentId: string
): Promise<ListEnvelope<SchoolClass>> {
  return apiFetch(`/students/${studentId}/classes`);
}

export function listStudentAssignments(
  studentId: string,
  published?: boolean
): Promise<ListEnvelope<Assignment>> {
  return apiFetch(
    `/students/${studentId}/assignments${queryString({
      published: published === undefined ? undefined : published,
    })}`
  );
}

export function listStudentSubmissions(
  studentId: string
): Promise<ListEnvelope<Submission>> {
  return apiFetch(`/students/${studentId}/submissions`);
}

export function schoolAverages(): Promise<SchoolAverages> {
  return apiFetch('/stats/average-grades');
}

export function teacherNames(): Promise<{ data: NamedPerson[] }> {
  return apiFetch('/stats/teacher-names');
}

export function studentNames(): Promise<{ data: NamedPerson[] }> {
  return apiFetch('/stats/student-names');
}

export function classSummaries(): Promise<{ data: ClassSummary[] }> {
  return apiFetch('/stats/classes');
}
