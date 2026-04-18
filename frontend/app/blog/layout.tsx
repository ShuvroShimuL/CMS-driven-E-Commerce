import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Read the latest articles on style, trends, and curated product guides from Premium Store.',
  openGraph: {
    title: 'Blog — Premium Store',
    description: 'Style guides, product features, and trend reports.',
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
