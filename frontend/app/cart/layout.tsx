import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Shopping Cart', description: 'Review your selected items, update quantities, and proceed to secure checkout.' };
export default function CartLayout({ children }: { children: React.ReactNode }) { return children; }
