import { afterEach, describe, expect, it } from 'vitest';
import {
  dueState,
  formatDate,
  formatDateTime,
  formatGrade,
  getApiUrl,
  queryString,
} from './format.ts';

describe('getApiUrl', () => {
  afterEach(() => {
    delete process.env.API_URL;
  });

  it('defaults locally and honours API_URL', () => {
    delete process.env.API_URL;
    expect(getApiUrl()).toBe('http://localhost:4000');
    process.env.API_URL = 'http://api:4000';
    expect(getApiUrl()).toBe('http://api:4000');
  });
});

describe('queryString', () => {
  it('skips empty values and stringifies the rest', () => {
    expect(queryString({})).toBe('');
    expect(queryString({ search: '', role: undefined })).toBe('');
    expect(queryString({ published: false, limit: 10 })).toBe(
      '?published=false&limit=10'
    );
  });
});

describe('formatDate', () => {
  it('formats valid dates and dashes the rest', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatDate('2026-01-15T00:00:00.000Z')).toMatch(/Jan/);
  });
});

describe('formatDateTime', () => {
  it('formats valid datetimes and dashes the rest', () => {
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('nope')).toBe('—');
    expect(formatDateTime('2026-01-15T12:30:00.000Z')).toMatch(/Jan/);
  });
});

describe('formatGrade', () => {
  it('renders marks', () => {
    expect(formatGrade(null, 100)).toBe('Not marked');
    expect(formatGrade(90, 100)).toBe('90 / 100');
    expect(formatGrade(90.25, 100)).toBe('90.3 / 100');
  });
});

describe('dueState', () => {
  it('classifies drafts, open work, due and overdue', () => {
    expect(dueState(null, false)).toBe('draft');
    expect(dueState(null, true)).toBe('open');
    expect(dueState('not-a-date', true)).toBe('open');
    expect(dueState(new Date(Date.now() + 86_400_000).toISOString(), true)).toBe(
      'due'
    );
    expect(dueState(new Date(Date.now() - 86_400_000).toISOString(), true)).toBe(
      'overdue'
    );
  });
});
