import type {
  Generated,
  ColumnType,
  Selectable,
  Insertable,
  Updateable,
} from 'kysely';

/**
 * Table and column names are declared in camelCase; the CamelCasePlugin in
 * `db.ts` maps them to the snake_case physical schema in `migrations/`.
 */

export type Role = 'admin' | 'teacher' | 'student';

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface UsersTable {
  id: Generated<string>;
  email: string;
  name: string;
  role: Role;
  suspended: Generated<boolean>;
  /** Null for accounts that only ever sign in through OAuth. */
  passwordHash: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OauthIdentitiesTable {
  provider: string;
  providerUserId: string;
  userId: string;
  createdAt: Timestamp;
}

export interface TeacherGroupsTable {
  id: Generated<string>;
  name: string;
  description: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TeacherGroupMembersTable {
  groupId: string;
  teacherId: string;
  addedAt: Timestamp;
}

export interface ClassesTable {
  id: Generated<string>;
  name: string;
  description: string | null;
  teacherId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EnrollmentsTable {
  classId: string;
  studentId: string;
  enrolledAt: Timestamp;
}

export interface AssignmentsTable {
  id: Generated<string>;
  classId: string;
  title: string;
  description: string | null;
  dueAt: ColumnType<
    Date | null,
    Date | string | null | undefined,
    Date | string | null
  >;
  maxGrade: Generated<number>;
  published: Generated<boolean>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SubmissionsTable {
  id: Generated<string>;
  assignmentId: string;
  studentId: string;
  content: string;
  grade: number | null;
  feedback: string | null;
  gradedAt: ColumnType<
    Date | null,
    Date | string | null | undefined,
    Date | string | null
  >;
  submittedAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Database {
  users: UsersTable;
  oauthIdentities: OauthIdentitiesTable;
  teacherGroups: TeacherGroupsTable;
  teacherGroupMembers: TeacherGroupMembersTable;
  classes: ClassesTable;
  enrollments: EnrollmentsTable;
  assignments: AssignmentsTable;
  submissions: SubmissionsTable;
}

export type UserRow = Selectable<UsersTable>;

/**
 * Every read that can reach a response body selects these columns explicitly,
 * so `password_hash` can never ride along in a payload by accident.
 */
export const PUBLIC_USER_COLUMNS = [
  'id',
  'email',
  'name',
  'role',
  'suspended',
  'createdAt',
  'updatedAt',
] as const;

export const PUBLIC_USER_COLUMNS_QUALIFIED = [
  'users.id',
  'users.email',
  'users.name',
  'users.role',
  'users.suspended',
  'users.createdAt',
  'users.updatedAt',
] as const;

export type PublicUser = Omit<UserRow, 'passwordHash'>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type TeacherGroupRow = Selectable<TeacherGroupsTable>;
export type ClassRow = Selectable<ClassesTable>;
export type AssignmentRow = Selectable<AssignmentsTable>;
export type SubmissionRow = Selectable<SubmissionsTable>;
