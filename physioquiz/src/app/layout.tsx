import type { Metadata, Viewport } from 'next';
import { Space_Grotesk } from 'next/font/google';
import ServiceWorkerRegistrar from '@/components/ui/ServiceWorkerRegistrar';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: 'Les Incollables',
  description: 'Application de révision par QCM en Physiologie pour étudiants en médecine',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Les Incollables',
  },
};

export const viewport: Viewport = {
  themeColor: '#194ce6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={spaceGrotesk.variable}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="font-sans antialiased bg-background-light text-neutral-900">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
