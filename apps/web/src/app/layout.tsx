import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Figtree, IBM_Plex_Mono, Literata } from 'next/font/google';
import './globals.css';

const sans = Figtree({
  subsets: ['latin'],
  variable: '--font-sans',
});

const display = Literata({
  subsets: ['latin'],
  variable: '--font-display',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'The Register',
  description: 'School hall portal for classes, assignments, and marks.',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${sans.variable} ${display.variable} ${mono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
