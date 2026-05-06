import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import '@/styles/globals.css';
import '@/app.scss';
import { AppProviders } from '@/contexts/AppContexts';
import QueryProvider from '@/components/QueryProvider';

const geist = Geist({
  subsets: ["latin"],
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: '--font-geist-mono',
});

export const metadata = {
  title: {
    default: 'RemyInk! - Professional Writing & Creative Platform',
    template: '%s | RemyInk!'
  },
  description: 'Elevate your brand with vetted experts in SEO articles, blog management, ghostwriting, and professional document design. We connect you with high-caliber writers for compelling narratives.',
  keywords: [
    'professional writing',
    'SEO articles',
    'ghostwriting',
    'copywriting',
    'document design',
    'content strategy',
    'creative platform',
    'managed agency',
    'business profiles'
  ],
  authors: [{ name: 'RemyInk!' }],
  creator: 'RemyInk!',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://remyink.co.ke',
    title: 'RemyInk! - Professional Writing & Creative Platform',
    description: 'Connect with high-caliber writers to craft compelling narratives, from whitepapers to industry-leading CVs.',
    siteName: 'RemyInk!',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RemyInk! - Professional Writing & Creative Platform',
    description: 'Expert ghostwriters and SEO-optimized content delivery.',
  },
};

export default function RootLayout({
  children,
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${geist.className} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <QueryProvider>
          <AppProviders>
            {children}
          </AppProviders>
        </QueryProvider>
        <Analytics />
      </body>
    </html>
  );
}