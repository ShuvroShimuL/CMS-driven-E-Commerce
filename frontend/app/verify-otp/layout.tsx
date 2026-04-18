import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Verify Email', description: 'Enter the 6-digit code sent to your email to verify your Premium Store account.', robots: { index: false, follow: false } };
export default function VerifyOtpLayout({ children }: { children: React.ReactNode }) { return children; }
