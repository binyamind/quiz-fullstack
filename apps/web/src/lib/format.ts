export function getApiUrl(): string {
  return process.env.API_URL ?? 'http://localhost:4000';
}

export function queryString(
  params: Record<string, string | number | boolean | undefined>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatGrade(
  grade: number | null | undefined,
  maxGrade: number
): string {
  if (grade === null || grade === undefined) return 'Not marked';
  const rounded = Number.isInteger(grade) ? String(grade) : grade.toFixed(1);
  return `${rounded} / ${maxGrade}`;
}

export function dueState(
  dueAt: string | null,
  published: boolean
): 'draft' | 'open' | 'due' | 'overdue' {
  if (!published) return 'draft';
  if (!dueAt) return 'open';
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return 'open';
  return due < Date.now() ? 'overdue' : 'due';
}
