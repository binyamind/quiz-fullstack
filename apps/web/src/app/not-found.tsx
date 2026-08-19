import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-binding">
        Missing period
      </p>
      <h1 className="mt-2 font-display text-3xl">That page is not on the roll</h1>
      <p className="mt-3 text-sm text-muted">
        Check the address, or return to your hall.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-md bg-binding px-4 py-2 text-sm text-white"
      >
        Back to the hall
      </Link>
    </div>
  );
}
