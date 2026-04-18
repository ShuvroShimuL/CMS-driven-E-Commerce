import Link from 'next/link';
import { getBlogPostBySlug, getBlogPosts } from '@/lib/api';
import styles from '../blog.module.css';
import type { Metadata } from 'next';

export async function generateStaticParams() {
  try {
    const posts = await getBlogPosts();
    return posts.map((post: any) => ({ slug: post.attributes.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const post = await getBlogPostBySlug(params.slug);
    if (!post) return { title: 'Article Not Found' };

    const { title, excerpt, cover, author } = post.attributes;
    const coverUrl = cover?.data?.attributes?.url;
    const postUrl = `https://cms-driven-e-commerce.vercel.app/blog/${params.slug}`;

    return {
      title,
      description: excerpt?.slice(0, 155),
      alternates: { canonical: postUrl },
      authors: [{ name: author }],
      openGraph: {
        title: `${title} — Premium Store`,
        description: excerpt?.slice(0, 155),
        type: 'article',
        url: postUrl,
        ...(coverUrl && { images: [{ url: coverUrl, width: 1200, height: 630, alt: title }] }),
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: excerpt?.slice(0, 155),
        ...(coverUrl && { images: [coverUrl] }),
      },
    };
  } catch {
    return { title: 'Blog — Premium Store' };
  }
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  let post: any = null;
  try {
    post = await getBlogPostBySlug(params.slug);
  } catch {}

  if (!post) {
    return (
      <div className={styles.articleContainer} style={{ textAlign: 'center', paddingTop: '5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>Article Not Found</h1>
        <p style={{ color: 'var(--text-tertiary)', marginBottom: '2rem' }}>
          This article doesn&apos;t exist or has been unpublished.
        </p>
        <Link href="/blog" className="btn-primary">Back to Blog</Link>
      </div>
    );
  }

  const { title, body, excerpt, author, read_time, cover, tags, createdAt } = post.attributes;
  const coverUrl = cover?.data?.attributes?.url;
  const date = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const parsedTags: string[] = Array.isArray(tags) ? tags : [];

  return (
    <article className={styles.articleContainer}>
      <Link href="/blog" className={styles.articleBack}>← Back to Journal</Link>

      <div className={styles.articleMeta}>
        <span>{date}</span>
        <span>·</span>
        <span>{read_time} min read</span>
        <span>·</span>
        <span>{author}</span>
      </div>

      <h1 className={styles.articleTitle}>{title}</h1>

      {coverUrl && (
        <img src={coverUrl} alt={title} className={styles.articleCover} />
      )}

      <div
        className={styles.articleBody}
        dangerouslySetInnerHTML={{ __html: body }}
      />

      {parsedTags.length > 0 && (
        <div className={styles.articleTags}>
          {parsedTags.map((tag: string) => (
            <span key={tag} className={styles.tag}>{tag}</span>
          ))}
        </div>
      )}
    </article>
  );
}
