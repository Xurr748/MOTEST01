import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SupabaseAuthProvider } from '@/lib/auth-context';
import { FloatingBackground } from '@/components/floating-background';
import { ServiceWorkerRegister } from '../components/sw-register';

export const metadata: Metadata = {
  title: 'MOMU SCAN',
  description: 'สแกนอาหารของคุณ เพื่อสุขภาพที่ดีกว่า — วิเคราะห์แคลอรี่จากรูปถ่ายอาหารด้วย AI',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MOMU SCAN',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#c4956a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FloatingBackground />
        <SupabaseAuthProvider>
          <div className="relative z-10">
            {children}
          </div>
        </SupabaseAuthProvider>
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
