import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@jerkeyray/react/styles.css';
import './studio.css';

export const metadata: Metadata = {
  title: 'Studio',
  description: 'Describe a technical visual, then refine the compiled Livery scene.',
};

export default function StudioLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
