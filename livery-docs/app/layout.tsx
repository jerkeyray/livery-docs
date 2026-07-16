import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://jerkeyray.github.io/livery/'),
  title: {
    default: 'Livery | Programmable visuals for agents',
    template: '%s · Livery',
  },
  description: 'A small visual language for agents to create responsive, validated technical figures and stateful visuals.',
  icons: { icon: '/livery-mark.svg' },
  openGraph: {
    title: 'Livery | Programmable visuals for agents',
    description: 'Validated layout, retained streaming, and portable visual output.',
    type: 'website',
    images: [{ url: 'og.png', width: 1200, height: 630, alt: 'Livery | Programmable visuals for agents' }],
  },
  twitter: { card: 'summary_large_image', images: ['og.png'] },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
