'use client';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-binding">
        Interrupted
      </p>
      <h1 className="mt-2 font-display text-3xl">Something failed</h1>
      <p className="mt-3 text-sm text-muted">
        {error.message || 'The hall could not complete that request.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-binding px-4 py-2 text-sm text-white"
      >
        Try again
      </button>
    </div>
  );
}
