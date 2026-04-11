import Link from 'next/link';
import { getProducts } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import styles from './page.module.css';

export default async function Home() {
  const products = await getProducts({ 'pagination[limit]': 8 });

  return (
    <>
      <section className={styles.hero}>
        <div className="container">
          <h1 className={styles.heroTitle}>
            Discover <span>Premium</span> Essentials
          </h1>
          <p className={styles.heroSubtitle}>
            Elevate your lifestyle with our curated collection of high-quality products designed for modern living.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link href="/category/all" className="btn-primary">Shop Now</Link>
            <Link href="/about" className="btn-secondary">Learn More</Link>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Featured Products</h2>
            <Link href="/category/all" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
              View All &rarr;
            </Link>
          </div>
          
          {products.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No products found</h3>
              <p>Looks like our catalog is currently empty. Check back soon!</p>
            </div>
          ) : (
            <div className={styles.productGrid}>
              {products.map((product: any) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
