import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { logoutAction } from '@/actions/auth.ts';
import { ChatPanel } from '@/components/chat/chat-panel.tsx';
import { EmptyState } from '@/components/data/empty-state.tsx';
import { PageHeader } from '@/components/data/page-header.tsx';
import { StatusBadge } from '@/components/data/status-badge.tsx';
import { Field, FormAlert } from '@/components/forms/field.tsx';
import { LoginForm } from '@/components/forms/login-form.tsx';
import { RoleNav } from '@/components/shell/role-nav.tsx';
import { UserMenu } from '@/components/shell/user-menu.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Card } from '@/components/ui/card.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Textarea } from '@/components/ui/textarea.tsx';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/users',
}));

vi.mock('@/actions/auth.ts', () => ({
  loginAction: vi.fn(async () => ({ error: 'Invalid email or password' })),
  logoutAction: vi.fn(),
  sendChatAction: vi.fn(async (turns: { content: string }[]) => {
    if (turns[turns.length - 1]?.content === 'fail') return { error: 'down' };
    return { reply: 'Hello from the hall' };
  }),
}));

const user = {
  id: '1',
  email: 'ada@school.test',
  name: 'Ada Admin',
  role: 'admin' as const,
  suspended: false,
  createdAt: '',
  updatedAt: '',
};

describe('primitives', () => {
  it('renders button variants and asChild', () => {
    render(
      <>
        <Button>Go</Button>
        <Button variant="secondary" size="sm">
          Alt
        </Button>
        <Button variant="ghost" size="lg">
          Ghost
        </Button>
        <Button variant="danger">Stop</Button>
        <Button asChild>
          <a href="/x">Link</a>
        </Button>
      </>
    );
    expect(screen.getByText('Go')).toBeInTheDocument();
    expect(screen.getByText('Link')).toHaveAttribute('href', '/x');
  });

  it('renders card stripes, badges, inputs and labels', () => {
    render(
      <>
        <Card>Plain</Card>
        <Card stripe="draft">Draft</Card>
        <Card stripe="open">Open</Card>
        <Card stripe="due">Due</Card>
        <Card stripe="overdue">Late</Card>
        <Card stripe="marked">Marked</Card>
        <Badge>Neutral</Badge>
        <Badge tone="open">Open</Badge>
        <Badge tone="due">Due</Badge>
        <Badge tone="danger">Danger</Badge>
        <Badge tone="marked">Marked</Badge>
        <Label htmlFor="x">Label</Label>
        <Input id="x" />
        <Textarea />
      </>
    );
    expect(screen.getByText('Plain')).toBeInTheDocument();
    expect(screen.getByText('Late')).toBeInTheDocument();
  });
});

describe('data components', () => {
  it('covers empty, header and status badges', () => {
    render(
      <>
        <EmptyState title="None" body="Create one" />
        <EmptyState
          title="None"
          body="Create one"
          action={{ href: '/new', label: 'Create' }}
        />
        <PageHeader title="Only title" />
        <PageHeader
          kicker="Hall"
          title="Overview"
          description="Desc"
          actions={<span>Act</span>}
        />
        <StatusBadge />
        <StatusBadge published={false} />
        <StatusBadge published />
        <StatusBadge published dueAt={null} />
        <StatusBadge
          published
          dueAt={new Date(Date.now() + 86_400_000).toISOString()}
        />
        <StatusBadge
          published
          dueAt={new Date(Date.now() - 86_400_000).toISOString()}
        />
        <StatusBadge graded />
      </>
    );
    expect(screen.getByText('Create')).toHaveAttribute('href', '/new');
    expect(screen.getByText('Past due')).toBeInTheDocument();
    expect(screen.getAllByText('Marked').length).toBeGreaterThan(0);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});

describe('forms helpers', () => {
  it('shows hint, error, success and alert emptiness', () => {
    render(
      <>
        <FormAlert />
        <FormAlert error="Nope" />
        <FormAlert success="Saved" />
        <Field label="Name" htmlFor="n" hint="help">
          <input id="n" />
        </Field>
        <Field label="Email" htmlFor="e" error="required">
          <input id="e" />
        </Field>
      </>
    );
    expect(screen.getByText('help')).toBeInTheDocument();
    expect(screen.getByText('required')).toBeInTheDocument();
    expect(screen.getByText('Nope')).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });
});

describe('shell', () => {
  it('marks the matching nav item and opens the user menu', async () => {
    const events = userEvent.setup();
    render(
      <>
        <RoleNav role="admin" />
        <UserMenu user={user} />
      </>
    );
    expect(screen.getByText('People')).toHaveClass('bg-binding-soft');
    await events.click(screen.getByRole('button', { name: /Ada Admin/i }));
    expect(await screen.findByText('ada@school.test')).toBeInTheDocument();
    await events.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(logoutAction).toHaveBeenCalled();
  });
});

describe('login form', () => {
  it('submits credentials', async () => {
    const events = userEvent.setup();
    render(<LoginForm />);
    await events.type(screen.getByLabelText('Email'), 'ada@school.test');
    await events.type(screen.getByLabelText('Password'), 'password-1234');
    await events.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });
});

describe('chat panel', () => {
  it('sends a question and shows the reply or an error', async () => {
    const events = userEvent.setup();
    render(<ChatPanel />);
    await events.click(screen.getByRole('button', { name: 'Ask the hall' }));
    expect(
      await screen.findByText(/Grounded in your classes/i)
    ).toBeInTheDocument();
    await events.type(screen.getByPlaceholderText('Ask a question'), 'Hello');
    await events.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Hello from the hall')).toBeInTheDocument();

    await events.type(screen.getByPlaceholderText('Ask a question'), 'fail');
    await events.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('down')).toBeInTheDocument();
  });

  it('ignores an empty send', async () => {
    const events = userEvent.setup();
    render(<ChatPanel />);
    await events.click(screen.getByRole('button', { name: 'Ask the hall' }));
    await events.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.queryByText('Hello from the hall')).not.toBeInTheDocument();
  });
});
