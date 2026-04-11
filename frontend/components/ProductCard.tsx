import Link from 'next/link';
import styles from './ProductCard.module.css';

export default function ProductCard({ product }: { product: any }) {
  const { title, slug, price, category, images } = product.attributes;
  const imageUrl = images?.data?.[0]?.attributes?.url || 'https://via.placeholder.com/600x600?text=No+Image';
  const categoryName = category?.data?.attributes?.name || 'Uncategorized';

  return (
    <Link href={`/product/${slug}`} className={styles.card}>
      <div className={styles.imageContainer}>
        <img src={imageUrl} alt={title} className={styles.image} loading="lazy" />
      </div>
      <div className={styles.content}>
        <span className={styles.category}>{categoryName}</span>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.footer}>
          <span className={styles.price}>${parseFloat(price).toFixed(2)}</span>
          <span style={{ color: 'var(--accent-color)', fontWeight: 600, fontSize: '0.875rem' }}>View Details &rarr;</span>
        </div>
      </div>
    </Link>
  );
}
