import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
