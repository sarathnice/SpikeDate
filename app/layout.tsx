import type { Metadata } from 'next';
import { Inter, Playfair_Display, Poppins } from 'next/font/google';
import './globals.css';
import './count-typography.css';
import './registration-vibe.css';
import './profile-connection.css';
import './photo-quality.css';
import './quiet-rail.css';
import './connections.css';
import './profile-atelier.css';
import './profile-preview.css';
import './chat-midnight.css';
import './gallery-glass.css';
import './quiet-precision.css';
import './astrology.css';
import './games.css';
import './explore.css';
import './send-spike.css';
import './popup-editorial.css';
import './high-intent-moment.css';
import './reminder-moments.css';
import './midnight-actions.css';
import './midnight-color-variants.css';
import './counts-lift.css';

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
  themeColor: '#0B0C12',
  viewportFit: 'cover' as const,
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
