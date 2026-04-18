import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Forgot Password', description: 'Reset your Premium Store password. Enter your email to receive a secure reset link.', robots: { index: false, follow: false } };
export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) { return children; }
