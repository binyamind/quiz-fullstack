import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateAssignmentForm, EditAssignmentForms } from '@/components/forms/assignment-forms.tsx';
import { ClassManageForms, CreateClassForm } from '@/components/forms/class-forms.tsx';
import { CreateUserForm } from '@/components/forms/create-user-form.tsx';
import { EditUserForms } from '@/components/forms/edit-user-forms.tsx';
import { CreateGroupForm, EditGroupForms } from '@/components/forms/group-forms.tsx';
import { LoginForm } from '@/components/forms/login-form.tsx';
import { GradeForm, SubmitWorkForm } from '@/components/forms/work-forms.tsx';
import { AppShell } from '@/components/shell/app-shell.tsx';
import type { Assignment, ClassDetail, PublicUser, Submission, TeacherGroupDetail } from '@/lib/types.ts';

vi.mock('next/navigation', () => ({
  usePathname: () => '/teach',
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useActionState: () =>
      [
        {
          error: 'nope',
          success: 'Saved',
          fieldErrors: {
            name: 'required',
            email: 'invalid',
            role: 'bad',
            password: 'short',
            title: 'needed',
            maxGrade: 'bad',
            content: 'needed',
            grade: 'high',
            teacherId: 'needed',
            description: 'long',
          },
        },
        vi.fn(),
        true,
      ] as const,
  };
});

vi.mock('@/actions/users.ts', () => ({
  createUserAction: vi.fn(async () => ({ error: 'exists' })),
  updateUserAction: vi.fn(async () => ({ success: 'Saved' })),
  setPasswordAction: vi.fn(async () => ({ success: 'Password updated' })),
  setSuspendedAction: vi.fn(),
  deleteUserAction: vi.fn(),
}));

vi.mock('@/actions/groups.ts', () => ({
  createGroupAction: vi.fn(async () => ({ fieldErrors: { name: 'required' } })),
  updateGroupAction: vi.fn(async () => ({ success: 'Saved' })),
  deleteGroupAction: vi.fn(),
  addGroupMemberAction: vi.fn(async () => ({ error: 'Choose a teacher' })),
  removeGroupMemberAction: vi.fn(),
}));

vi.mock('@/actions/classes.ts', () => ({
  createClassAction: vi.fn(async () => ({ error: 'no' })),
  updateClassAction: vi.fn(async () => ({ success: 'Saved' })),
  deleteClassAction: vi.fn(),
  enrollStudentAction: vi.fn(async () => ({ success: 'Student enrolled' })),
  unenrollStudentAction: vi.fn(),
}));

vi.mock('@/actions/assignments.ts', () => ({
  createAssignmentAction: vi.fn(async () => ({ error: 'no' })),
  updateAssignmentAction: vi.fn(async () => ({ success: 'Saved' })),
  publishAssignmentAction: vi.fn(),
  deleteAssignmentAction: vi.fn(),
}));

vi.mock('@/actions/submissions.ts', () => ({
  submitWorkAction: vi.fn(async () => ({ success: 'Submitted' })),
  updateWorkAction: vi.fn(async () => ({ success: 'Updated' })),
  gradeSubmissionAction: vi.fn(async () => ({ success: 'Marked' })),
}));

vi.mock('@/actions/auth.ts', () => ({
  loginAction: vi.fn(async () => ({ error: 'nope' })),
  logoutAction: vi.fn(),
  sendChatAction: vi.fn(async () => ({ reply: 'ok' })),
}));

const person: PublicUser = {
  id: 'u1',
  email: 'ada@school.test',
  name: 'Ada Admin',
  role: 'admin',
  suspended: true,
  createdAt: '',
  updatedAt: '',
};

const teacher: PublicUser = { ...person, id: 't1', name: 'Tina', role: 'teacher', suspended: false };

const group: TeacherGroupDetail = {
  id: 'g1',
  name: 'Science',
  description: 'Labs',
  createdAt: '',
  updatedAt: '',
  members: [teacher],
};

const emptyGroup: TeacherGroupDetail = { ...group, members: [], description: null };

const schoolClass: ClassDetail = {
  id: 'c1',
  name: 'Physics',
  description: 'Mechanics',
  teacherId: 't1',
  createdAt: '',
  updatedAt: '',
  teacher,
  students: [{ ...person, id: 's1', name: 'Sam', role: 'student', suspended: false }],
};

const emptyClass: ClassDetail = { ...schoolClass, students: [] };

const assignment: Assignment = {
  id: 'a1',
  classId: 'c1',
  title: 'Essay',
  description: 'Write',
  dueAt: '2026-02-01T12:00:00.000Z',
  maxGrade: 100,
  published: true,
  createdAt: '',
  updatedAt: '',
};

const draftAssignment: Assignment = { ...assignment, published: false, dueAt: null, description: null };

const submission: Submission = {
  id: 'sub1',
  assignmentId: 'a1',
  studentId: 's1',
  content: 'My work',
  grade: 80,
  feedback: 'Nice',
  gradedAt: '',
  submittedAt: '',
  updatedAt: '',
};

const ungraded: Submission = { ...submission, grade: null, feedback: null };

describe('remaining forms', () => {
  it('renders user, group, class, assignment and work forms', () => {
    render(
      <>
        <AppShell user={person}>
          <p>Hall body</p>
        </AppShell>
        <CreateUserForm />
        <EditUserForms user={person} />
        <EditUserForms user={{ ...person, suspended: false }} />
        <CreateGroupForm />
        <EditGroupForms group={group} teachers={[teacher, { ...teacher, id: 't2', name: 'Tom' }]} />
        <EditGroupForms group={emptyGroup} teachers={[teacher]} />
        <CreateClassForm teacherId="t1" />
        <CreateClassForm teachers={[{ id: 't1', name: 'Tina' }]} />
        <ClassManageForms schoolClass={schoolClass} students={[{ id: 's1', name: 'Sam' }, { id: 's2', name: 'Sue' }]} />
        <ClassManageForms schoolClass={emptyClass} students={[]} />
        <CreateAssignmentForm classId="c1" />
        <EditAssignmentForms assignment={assignment} />
        <EditAssignmentForms assignment={draftAssignment} />
        <SubmitWorkForm assignmentId="a1" />
        <SubmitWorkForm assignmentId="a1" submission={ungraded} />
        <GradeForm submission={ungraded} maxGrade={100} />
        <LoginForm />
      </>
    );

    expect(screen.getByText('Hall body')).toBeInTheDocument();
    expect(screen.getByText('The Register')).toBeInTheDocument();
    expect(screen.getAllByText('Roster is empty.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('No teachers in this group yet.').length).toBeGreaterThan(0);

    expect(screen.getAllByRole('button', { name: 'Creating…' }).length).toBeGreaterThan(0);
  });
});
