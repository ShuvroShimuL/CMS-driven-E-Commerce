import Link from 'next/link';
import styles from './ProductCard.module.css';
import WishlistButton from './WishlistButton';

export default function ProductCard({
  product,
  isWishlisted = false,
}: {
  product: any;
  isWishlisted?: boolean;
}) {
  const { title, slug, price, category, images } = product.attributes;
  const imageUrl = images?.data?.[0]?.attributes?.url || 'https://via.placeholder.com/600x600?text=No+Image';
  const categoryName = category?.data?.attributes?.name || 'Uncategorized';

  return (
    <div className={styles.card} style={{ position: 'relative' }}>
      <div className={styles.wishlistCorner}>
        <WishlistButton
          productId={product.id}
          productSlug={slug}
          initialWishlisted={isWishlisted}
          size={18}
        />
      </div>
      <Link href={`/product/${slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className={styles.imageContainer}>
          <img src={imageUrl} alt={title} className={styles.image} loading="lazy" />
        </div>
        <div className={styles.content}>
          <span className={styles.category}>{categoryName}</span>
          <h3 className={styles.title}>{title}</h3>
          <div className={styles.footer}>
            <span className={styles.price}>Tk {parseFloat(price).toFixed(2)}</span>
            <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>View →</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
