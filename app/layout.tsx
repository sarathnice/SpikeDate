import type { Metadata } from 'next';
import { Inter, Playfair_Display, Poppins } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  style: ['italic'],
});

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
});

export const metadata: Metadata = {
  title: 'SpikeDate — Find your person',
  description:
    'A photo-first dating experience built around thoughtful discovery, Galaxy communities, and genuine connection.',
  applicationName: 'SpikeDate',
  appleWebApp: { title: 'SpikeDate', capable: true },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/brand/app-icon-192.png',
    apple: '/brand/app-icon-1024.png',
  },
};

export const viewport = {
  themeColor: '#1A1A2E',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${playfair.variable} ${poppins.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
