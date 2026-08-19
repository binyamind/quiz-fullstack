import { expect, test, type Page } from '@playwright/test';

const password = process.env.SEED_PASSWORD ?? 'password-1234';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function signOut(page: Page, name: string | RegExp) {
  await page.getByRole('button', { name }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
}

test.describe.serial('school hall', () => {
  test('admin can manage people and groups', async ({ page }) => {
    await signIn(page, 'admin@school.test');
    await expect(page.getByRole('heading', { name: 'School overview' })).toBeVisible();

    await page.getByRole('link', { name: 'People' }).click();
    await expect(page.getByRole('heading', { name: 'Directory' })).toBeVisible();
    await page.getByLabel('Name').fill('Riley Teacher');
    await page.getByLabel('Email').fill(`riley.${Date.now()}@school.test`);
    await page.locator('#role').selectOption('teacher');
    await page.getByLabel('Password').fill('password-1234');
    await page.getByRole('button', { name: 'Create person' }).click();
    await expect(page.getByRole('heading', { name: 'Riley Teacher' })).toBeVisible();

    await page.goto('/admin/users');
    await page.getByPlaceholder('Search name or email').fill('Sam Student');
    await page.getByRole('button', { name: 'Filter' }).click();
    await page.getByRole('link', { name: 'Sam Student' }).click();
    await expect(page.getByRole('heading', { name: 'Sam Student' })).toBeVisible();
    // Retries reuse the seeded DB, so Sam may already be suspended.
    await expect(
      page.getByRole('button', { name: /^(Suspend|Restore) account$/ })
    ).toBeVisible();
    const suspend = page.getByRole('button', { name: 'Suspend account' });
    if (await suspend.isVisible()) {
      await suspend.click();
    }
    await expect(page.getByRole('button', { name: 'Restore account' })).toBeVisible();

    await page.getByRole('link', { name: 'Groups' }).click();
    // Sam's profile also has a Name field; wait until the groups form is up.
    await expect(page.getByRole('heading', { name: 'Teacher groups' })).toBeVisible();
    const groupName = `Science faculty ${Date.now()}`;
    await page.getByLabel('Name').fill(groupName);
    await page.getByRole('button', { name: 'Create group' }).click();
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible();
  });

  test('suspended student cannot sign in', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('sam@school.test');
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('status')).toContainText(/suspend|Invalid|Forbidden/i);
  });

  test('teacher publishes work and student hands it in', async ({ page }) => {
    await signIn(page, 'tina@school.test');
    await expect(page.getByRole('heading', { name: 'Your classes' })).toBeVisible();
    await page.getByLabel('Class name').fill('Latin');
    await page.getByRole('button', { name: 'Open class' }).click();
    await expect(page.getByRole('heading', { name: 'Latin' })).toBeVisible();

    await page.locator('#studentId').selectOption({ label: 'Sue Student' });
    await page.getByRole('button', { name: 'Enrol' }).click();
    await expect(page.getByText('Sue Student')).toBeVisible();

    await page.getByRole('link', { name: 'New assignment' }).click();
    await expect(page.getByRole('heading', { name: 'New assignment' })).toBeVisible();
    await page.getByLabel('Title').fill('Declensions');
    await page.getByLabel('Brief').fill('Decline puella.');
    await page.getByLabel('Publish immediately').check();
    await page.getByRole('button', { name: 'Save assignment' }).click();
    await expect(page.getByRole('heading', { name: 'Declensions' })).toBeVisible();

    await signOut(page, /Tina Teacher/);

    await signIn(page, 'sue@school.test');
    await page.getByRole('link', { name: 'Work' }).click();
    await expect(page.getByRole('heading', { name: 'Assignments' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Declensions/ })).toBeVisible();
    await page.getByRole('link', { name: /Declensions/ }).click();
    await expect(page.getByRole('heading', { name: 'Declensions' })).toBeVisible();
    await page.getByLabel('Your work').fill('puella, puellae, puellae');
    await page.getByRole('button', { name: 'Hand in' }).click();
    await expect(page.getByText('Submitted')).toBeVisible();

    await signOut(page, /Sue Student/);

    await signIn(page, 'tina@school.test');
    await page.getByRole('link', { name: 'Latin' }).click();
    await page.getByRole('link', { name: 'Declensions' }).click();
    await page.getByRole('link', { name: 'Sue Student' }).click();
    await page.getByLabel('Mark').fill('9');
    await page.getByLabel('Feedback').fill('Good start.');
    await page.getByRole('button', { name: 'Save mark' }).click();
    await expect(page.getByText('Marked')).toBeVisible();

    await signOut(page, /Tina Teacher/);
    await signIn(page, 'sue@school.test');
    await page.getByRole('link', { name: 'Work' }).click();
    await expect(page.getByRole('heading', { name: 'Assignments' })).toBeVisible();
    await page.getByRole('link', { name: /Declensions/ }).click();
    await expect(page.getByRole('heading', { name: 'Declensions' })).toBeVisible();
    await expect(page.getByText('9 / 100')).toBeVisible();
    await expect(page.getByText('Good start.')).toBeVisible();
  });
});
