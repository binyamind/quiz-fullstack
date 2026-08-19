import { LoginForm } from '@/components/forms/login-form.tsx';

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden flex-col justify-between border-r border-line bg-white px-12 py-16 lg:flex">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-binding">
            First bell
          </p>
          <h1 className="mt-4 max-w-md font-display text-5xl leading-tight">
            The Register
          </h1>
          <p className="mt-4 max-w-sm text-muted">
            Classes, briefs, and marks — kept like a hall timetable, not a
            dashboard.
          </p>
        </div>
        <ol className="space-y-4 font-mono text-sm text-muted">
          <li className="flex gap-4">
            <span className="text-binding">08:40</span>
            Homeroom opens
          </li>
          <li className="flex gap-4">
            <span className="text-binding">09:05</span>
            Period one — published work
          </li>
          <li className="flex gap-4">
            <span className="text-binding">15:20</span>
            Last bell — marks returned
          </li>
        </ol>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-xl border border-line bg-surface p-8 shadow-card">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-binding">
            Sign in
          </p>
          <h2 className="mt-2 font-display text-3xl">Welcome back</h2>
          <p className="mb-6 mt-2 text-sm text-muted">
            Use your school email, or continue with GitHub if your hall uses it.
          </p>
          <LoginForm />
          <a
            href="/api/v0/auth/oauth/github/start"
            className="mt-4 flex h-10 items-center justify-center rounded-md border border-line text-sm hover:border-binding"
          >
            Sign in with GitHub
          </a>
        </div>
      </section>
    </div>
  );
}
