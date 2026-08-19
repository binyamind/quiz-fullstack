import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#E7ECF1',
        surface: '#F4F6F8',
        ink: '#1E2A38',
        muted: '#5C6B7A',
        line: '#C5D0DA',
        binding: {
          DEFAULT: '#2A6B66',
          dark: '#1F524E',
          soft: '#D5E8E6',
        },
        bell: {
          draft: '#8A94A0',
          open: '#2A6B66',
          due: '#C45C26',
          marked: '#1F4E8C',
        },
        danger: {
          DEFAULT: '#B42318',
          soft: '#F8D7D4',
        },
        mark: {
          DEFAULT: '#1F7A4D',
          soft: '#D5EDDF',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(30, 42, 56, 0.04), 0 8px 24px -16px rgba(30, 42, 56, 0.18)',
      },
    },
  },
  plugins: [animate],
};

export default config;
