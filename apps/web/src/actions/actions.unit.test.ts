import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors.ts';

const revalidatePath = vi.fn();
const redirect = vi.fn((url: string) => {
  const error = new Error(`REDIRECT:${url}`) as Error & { digest: string };
  error.digest = `NEXT_REDIRECT;replace;${url};307;`;
  throw error;
});
const apiMutate = vi.fn();
const apiRequest = vi.fn();
const applySetCookies = vi.fn();
const readPayload = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
}));

vi.mock('@/lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api.ts')>();
  return {
    ...actual,
    apiMutate: (...args: unknown[]) => apiMutate(...args),
    apiRequest: (...args: unknown[]) => apiRequest(...args),
    readPayload: (...args: unknown[]) => readPayload(...args),
  };
});

vi.mock('@/lib/session.ts', () => ({
  applySetCookies: (...args: unknown[]) => applySetCookies(...args),
}));

const auth = await import('./auth.ts');
const users = await import('./users.ts');
const groups = await import('./groups.ts');
const classes = await import('./classes.ts');
const assignments = await import('./assignments.ts');
const submissions = await import('./submissions.ts');
const { fromApiError, field, toFormAction } = await import('./result.ts');

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe('fromApiError', () => {
  it('maps api and unknown errors', async () => {
    expect(
      fromApiError(new ApiError(400, 'VALIDATION_ERROR', 'bad', [
        { path: 'email', message: 'taken' },
      ]))
    ).toEqual({
      error: 'bad',
      fieldErrors: { email: 'taken' },
    });
    expect(fromApiError(new Error('x'))).toEqual({
      error: 'Something went wrong',
    });
    expect(fromApiError(null)).toEqual({ error: 'Something went wrong' });
    const redirectError = Object.assign(new Error('r'), {
      digest: 'NEXT_REDIRECT;replace;/x;307;',
    });
    expect(() => fromApiError(redirectError)).toThrow(redirectError);
    const notFound = Object.assign(new Error('n'), {
      digest: 'NEXT_NOT_FOUND',
    });
    expect(() => fromApiError(notFound)).toThrow(notFound);
    expect(fromApiError({ digest: 1 })).toEqual({
      error: 'Something went wrong',
    });
    const data = form({ name: 'Ada' });
    expect(field(data, 'name')).toBe('Ada');
    expect(field(data, 'missing')).toBe('');
    await toFormAction(async () => 'ok')(new FormData());
  });
});

describe('auth actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid login then signs in', async () => {
    const invalid = await auth.loginAction(null, form({ email: 'no', password: '' }));
    expect(invalid?.fieldErrors).toBeDefined();

    apiRequest.mockResolvedValue(new Response(null, { status: 401 }));
    readPayload.mockResolvedValue({
      error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' },
    });
    const failed = await auth.loginAction(
      null,
      form({ email: 'a@b.com', password: 'secret' })
    );
    expect(failed?.error).toMatch(/Invalid/);

    apiRequest.mockResolvedValue(new Response(null, { status: 200 }));
    readPayload.mockResolvedValue({
      user: { id: '1', role: 'admin' },
    });
    await expect(
      auth.loginAction(null, form({ email: 'a@b.com', password: 'secret' }))
    ).rejects.toThrow('REDIRECT:/admin');
  });

  it('logs out and sends chat replies', async () => {
    apiRequest.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(auth.logoutAction()).rejects.toThrow('REDIRECT:/login');

    apiMutate.mockResolvedValue({ reply: 'Hello' });
    await expect(
      auth.sendChatAction([{ role: 'user', content: 'Hi' }])
    ).resolves.toEqual({ reply: 'Hello' });

    apiMutate.mockRejectedValue(new ApiError(503, 'CHAT_DISABLED', 'off'));
    await expect(
      auth.sendChatAction([{ role: 'user', content: 'Hi' }])
    ).resolves.toEqual({ error: 'off' });

    apiMutate.mockRejectedValue(new Error('network'));
    await expect(
      auth.sendChatAction([{ role: 'user', content: 'Hi' }])
    ).resolves.toEqual({ error: 'Chat is unavailable' });
  });
});

describe('user actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validates and creates a user', async () => {
    expect(
      (await users.createUserAction(null, form({ email: 'bad', name: '', role: 'admin' })))
        ?.fieldErrors
    ).toBeDefined();
    apiMutate.mockResolvedValue({ id: 'u1' });
    await expect(
      users.createUserAction(
        null,
        form({
          email: 'a@b.com',
          name: 'Ada',
          role: 'admin',
          password: 'password1',
        })
      )
    ).rejects.toThrow('REDIRECT:/admin/users/u1');
    apiMutate.mockRejectedValue(new ApiError(409, 'CONFLICT', 'exists'));
    expect(
      (
        await users.createUserAction(
          null,
          form({ email: 'a@b.com', name: 'Ada', role: 'student' })
        )
      )?.error
    ).toBe('exists');
  });

  it('updates, resets password, suspends and deletes', async () => {
    expect(
      (await users.updateUserAction('u1', null, form({ email: 'bad', name: 'A', role: 'admin' })))
        ?.fieldErrors
    ).toBeDefined();
    apiMutate.mockResolvedValue({});
    expect(
      await users.updateUserAction(
        'u1',
        null,
        form({ email: 'a@b.com', name: 'Ada', role: 'admin' })
      )
    ).toEqual({ success: 'Saved' });
    apiMutate.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'no'));
    expect(
      (
        await users.updateUserAction(
          'u1',
          null,
          form({ email: 'a@b.com', name: 'Ada', role: 'admin' })
        )
      )?.error
    ).toBe('no');

    expect(
      (await users.setPasswordAction('u1', null, form({ password: 'short' })))
        ?.fieldErrors
    ).toBeDefined();
    apiMutate.mockResolvedValue(undefined);
    expect(await users.setPasswordAction('u1', null, form({ password: 'password1' }))).toEqual({
      success: 'Password updated',
    });
    apiMutate.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'gone'));
    expect(
      (await users.setPasswordAction('u1', null, form({ password: 'password1' })))?.error
    ).toBe('gone');

    apiMutate.mockResolvedValue({});
    expect(await users.setSuspendedAction('u1', true)).toEqual({
      success: 'Account suspended',
    });
    expect(await users.setSuspendedAction('u1', false)).toEqual({
      success: 'Account restored',
    });
    apiMutate.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'no'));
    expect((await users.setSuspendedAction('u1', true))?.error).toBe('no');

    apiMutate.mockResolvedValue(undefined);
    await expect(users.deleteUserAction('u1')).rejects.toThrow(
      'REDIRECT:/admin/users'
    );
    apiMutate.mockRejectedValue(new ApiError(409, 'CONFLICT', 'in use'));
    expect((await users.deleteUserAction('u1'))?.error).toBe('in use');
  });
});

describe('group actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('covers create, update, members and delete', async () => {
    expect(
      (await groups.createGroupAction(null, form({ name: '' })))?.fieldErrors
    ).toBeDefined();
    apiMutate.mockResolvedValue({ id: 'g1' });
    await expect(
      groups.createGroupAction(null, form({ name: 'Science', description: 'x' }))
    ).rejects.toThrow('REDIRECT:/admin/groups/g1');
    apiMutate.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'no'));
    expect(
      (await groups.createGroupAction(null, form({ name: 'Science' })))?.error
    ).toBe('no');

    expect(
      (await groups.updateGroupAction('g1', null, form({ name: '' })))?.fieldErrors
    ).toBeDefined();
    apiMutate.mockResolvedValue({});
    expect(
      await groups.updateGroupAction('g1', null, form({ name: 'Sci' }))
    ).toEqual({ success: 'Saved' });
    apiMutate.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'gone'));
    expect(
      (await groups.updateGroupAction('g1', null, form({ name: 'Sci' })))?.error
    ).toBe('gone');

    expect(await groups.addGroupMemberAction('g1', null, form({}))).toEqual({
      error: 'Choose a teacher',
    });
    apiMutate.mockResolvedValue({});
    expect(
      await groups.addGroupMemberAction('g1', null, form({ teacherId: 't1' }))
    ).toEqual({ success: 'Teacher added' });
    apiMutate.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'no'));
    expect(
      (await groups.addGroupMemberAction('g1', null, form({ teacherId: 't1' })))
        ?.error
    ).toBe('no');

    apiMutate.mockResolvedValue(undefined);
    expect(await groups.removeGroupMemberAction('g1', 't1')).toEqual({
      success: 'Teacher removed',
    });
    apiMutate.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'gone'));
    expect((await groups.removeGroupMemberAction('g1', 't1'))?.error).toBe('gone');

    apiMutate.mockResolvedValue(undefined);
    await expect(groups.deleteGroupAction('g1')).rejects.toThrow(
      'REDIRECT:/admin/groups'
    );
    apiMutate.mockRejectedValue(new ApiError(409, 'CONFLICT', 'no'));
    expect((await groups.deleteGroupAction('g1'))?.error).toBe('no');
  });
});

describe('class actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('covers class CRUD and roster', async () => {
    expect(
      (await classes.createClassAction(null, form({ name: '', teacherId: 'bad' })))
        ?.fieldErrors
    ).toBeDefined();
    apiMutate.mockResolvedValue({ id: 'c1' });
    await expect(
      classes.createClassAction(
        null,
        form({
          name: 'Physics',
          teacherId: '00000000-0000-4000-8000-000000000000',
        })
      )
    ).rejects.toThrow('REDIRECT:/teach/classes/c1');
    apiMutate.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'no'));
    expect(
      (
        await classes.createClassAction(
          null,
          form({
            name: 'Physics',
            teacherId: '00000000-0000-4000-8000-000000000000',
          })
        )
      )?.error
    ).toBe('no');

    expect(
      (await classes.updateClassAction('c1', null, form({ name: '' })))?.fieldErrors
    ).toBeDefined();
    apiMutate.mockResolvedValue({});
    expect(
      await classes.updateClassAction('c1', null, form({ name: 'Chem' }))
    ).toEqual({ success: 'Saved' });
    apiMutate.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'gone'));
    expect(
      (await classes.updateClassAction('c1', null, form({ name: 'Chem' })))?.error
    ).toBe('gone');

    expect(await classes.enrollStudentAction('c1', null, form({}))).toEqual({
      error: 'Choose a student',
    });
    apiMutate.mockResolvedValue({});
    expect(
      await classes.enrollStudentAction('c1', null, form({ studentId: 's1' }))
    ).toEqual({ success: 'Student enrolled' });
    apiMutate.mockRejectedValue(new ApiError(409, 'CONFLICT', 'already'));
    expect(
      (await classes.enrollStudentAction('c1', null, form({ studentId: 's1' })))
        ?.error
    ).toBe('already');

    apiMutate.mockResolvedValue(undefined);
    expect(await classes.unenrollStudentAction('c1', 's1')).toEqual({
      success: 'Student removed',
    });
    apiMutate.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'gone'));
    expect((await classes.unenrollStudentAction('c1', 's1'))?.error).toBe('gone');

    apiMutate.mockResolvedValue(undefined);
    await expect(classes.deleteClassAction('c1')).rejects.toThrow('REDIRECT:/teach');
    apiMutate.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'no'));
    expect((await classes.deleteClassAction('c1'))?.error).toBe('no');
  });
});

describe('assignment actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('covers create, update, publish and delete', async () => {
    expect(
      (await assignments.createAssignmentAction('c1', null, form({ title: '' })))
        ?.fieldErrors
    ).toBeDefined();
    apiMutate.mockResolvedValue({ id: 'a1' });
    await expect(
      assignments.createAssignmentAction(
        'c1',
        null,
        form({
          title: 'Essay',
          maxGrade: '50',
          dueAt: '2026-01-01T12:00',
          published: 'true',
        })
      )
    ).rejects.toThrow('REDIRECT:/teach/assignments/a1');
    apiMutate.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'no'));
    expect(
      (
        await assignments.createAssignmentAction(
          'c1',
          null,
          form({ title: 'Essay', maxGrade: '50' })
        )
      )?.error
    ).toBe('no');

    expect(
      (
        await assignments.updateAssignmentAction(
          'a1',
          'c1',
          null,
          form({ title: '', maxGrade: '1' })
        )
      )?.fieldErrors
    ).toBeDefined();
    apiMutate.mockResolvedValue({});
    expect(
      await assignments.updateAssignmentAction(
        'a1',
        'c1',
        null,
        form({ title: 'Essay', maxGrade: '80', dueAt: '' })
      )
    ).toEqual({ success: 'Saved' });
    apiMutate.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'gone'));
    expect(
      (
        await assignments.updateAssignmentAction(
          'a1',
          'c1',
          null,
          form({ title: 'Essay', maxGrade: '80' })
        )
      )?.error
    ).toBe('gone');

    apiMutate.mockResolvedValue({});
    expect(await assignments.publishAssignmentAction('a1', 'c1', true)).toEqual({
      success: 'Published',
    });
    expect(await assignments.publishAssignmentAction('a1', 'c1', false)).toEqual({
      success: 'Unpublished',
    });
    apiMutate.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'no'));
    expect((await assignments.publishAssignmentAction('a1', 'c1', true))?.error).toBe(
      'no'
    );

    apiMutate.mockResolvedValue(undefined);
    await expect(assignments.deleteAssignmentAction('a1', 'c1')).rejects.toThrow(
      'REDIRECT:/teach/classes/c1'
    );
    apiMutate.mockRejectedValue(new ApiError(409, 'CONFLICT', 'no'));
    expect((await assignments.deleteAssignmentAction('a1', 'c1'))?.error).toBe('no');
  });
});

describe('submission actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('covers submit, update and grade', async () => {
    expect(
      (await submissions.submitWorkAction('a1', null, form({ content: '' })))
        ?.fieldErrors
    ).toBeDefined();
    apiMutate.mockResolvedValue({ id: 's1' });
    expect(
      await submissions.submitWorkAction('a1', null, form({ content: 'My essay' }))
    ).toEqual({ success: 'Submitted' });
    apiMutate.mockRejectedValue(new ApiError(409, 'CONFLICT', 'already'));
    expect(
      (await submissions.submitWorkAction('a1', null, form({ content: 'My essay' })))
        ?.error
    ).toBe('already');

    expect(
      (
        await submissions.updateWorkAction(
          's1',
          'a1',
          null,
          form({ content: '' })
        )
      )?.fieldErrors
    ).toBeDefined();
    apiMutate.mockResolvedValue({});
    expect(
      await submissions.updateWorkAction(
        's1',
        'a1',
        null,
        form({ content: 'Edited' })
      )
    ).toEqual({ success: 'Updated' });
    apiMutate.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'no'));
    expect(
      (
        await submissions.updateWorkAction(
          's1',
          'a1',
          null,
          form({ content: 'Edited' })
        )
      )?.error
    ).toBe('no');

    expect(
      (
        await submissions.gradeSubmissionAction(
          's1',
          'a1',
          null,
          form({ grade: '120', maxGrade: '100' })
        )
      )?.fieldErrors
    ).toBeDefined();
    apiMutate.mockResolvedValue({});
    expect(
      await submissions.gradeSubmissionAction(
        's1',
        'a1',
        null,
        form({ grade: '80', maxGrade: '100', feedback: 'Good' })
      )
    ).toEqual({ success: 'Marked' });
    apiMutate.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'no'));
    expect(
      (
        await submissions.gradeSubmissionAction(
          's1',
          'a1',
          null,
          form({ grade: '80', maxGrade: '100' })
        )
      )?.error
    ).toBe('no');
  });
});
