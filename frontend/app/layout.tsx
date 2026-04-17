import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const SITE_NAME = 'Premium Store';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cms-driven-e-commerce.vercel.app';
const SITE_DESCRIPTION = 'Discover curated, high-quality products for modern living. Shop electronics, fashion, and lifestyle essentials with fast delivery across Bangladesh.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Premium Essentials for Modern Living`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: ['e-commerce', 'premium store', 'online shopping', 'Bangladesh', 'electronics', 'fashion', 'lifestyle'],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Premium Essentials for Modern Living`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Premium Essentials for Modern Living`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="layout-wrapper">
          <Header />
          <main className="layout-main">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
