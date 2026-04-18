import Link from 'next/link';
import { getBlogPosts } from '@/lib/api';
import styles from './blog.module.css';

export default async function BlogPage() {
  let posts: any[] = [];
  try {
    posts = await getBlogPosts();
  } catch {
    // Strapi may not have the content type yet — graceful fallback
  }

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '80vh' }}>
      <div className={styles.blogHeader}>
        <h1 className={styles.blogTitle}>Journal</h1>
        <p className={styles.blogSubtitle}>
          Style guides, product features, and trend reports
        </p>
      </div>

      <div className="container">
        {posts.length === 0 ? (
          <div className={styles.emptyBlog}>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: '0.5rem', fontSize: '1rem' }}>
              No articles published yet.
            </p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              Check back soon — we&apos;re working on something good.
            </p>
          </div>
        ) : (
          <div className={styles.postGrid}>
            {posts.map((post: any) => {
              const { title, slug, excerpt, author, readTime, cover, createdAt } = post.attributes;
              const coverUrl = cover?.data?.attributes?.url;
              const date = new Date(createdAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
              });

              return (
                <Link key={post.id} href={`/blog/${slug}`} className={styles.postCard}>
                  {coverUrl && (
                    <img src={coverUrl} alt={title} className={styles.postCover} loading="lazy" />
                  )}
                  <div className={styles.postBody}>
                    <div className={styles.postMeta}>
                      <span>{date}</span>
                      <span>·</span>
                      <span>{readTime} min read</span>
                      <span>·</span>
                      <span>{author}</span>
                    </div>
                    <h2 className={styles.postCardTitle}>{title}</h2>
                    <p className={styles.postExcerpt}>{excerpt}</p>
                    <span className={styles.readMore}>Read Article →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
