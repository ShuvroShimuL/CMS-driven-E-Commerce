import { notFound } from 'next/navigation';
import { getProductBySlug, getProducts } from '@/lib/api';
import AddToCartButton from '@/components/AddToCartButton';
import styles from './page.module.css';

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product: any) => ({
    slug: product.attributes.slug,
  }));
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProductBySlug(params.slug);

  if (!product) {
    return (
      <div className={`container ${styles.notFound}`}>
        <h1>Product Not Found</h1>
        <p>The product you are looking for does not exist or has been removed.</p>
      </div>
    );
  }

  const { title, description, price, stock, category, images } = product.attributes;
  const imageUrl = images?.data?.[0]?.attributes?.url || 'https://via.placeholder.com/800x800?text=No+Image';
  const categoryName = category?.data?.attributes?.name || 'Uncategorized';
  const isOutOfStock = stock <= 0;

  return (
    <div className={`container ${styles.container}`}>
      <div className={styles.grid}>
        <div className={styles.imageGallery}>
          <img src={imageUrl} alt={title} className={styles.mainImage} />
        </div>
        
        <div className={styles.info}>
          <span className={styles.category}>{categoryName}</span>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.price}>${parseFloat(price).toFixed(2)}</div>
          
          <div className={styles.description}>
            {description}
          </div>
          
          <div style={{ color: isOutOfStock ? 'var(--accent-color)' : 'inherit', fontWeight: 600 }}>
            {isOutOfStock ? 'Out of Stock' : `In Stock: ${stock} units`}
          </div>

          <div className={styles.actions}>
            <AddToCartButton product={product} isOutOfStock={isOutOfStock} />
          </div>
        </div>
      </div>
    </div>
  );
}
