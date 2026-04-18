import { getProducts } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import { getWishlistIds } from '@/app/actions/wishlist';
import styles from '../category/[slug]/page.module.css'; // Reusing category styles for consistency
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search Results',
  description: 'Search results for premium products.',
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const query = typeof searchParams.q === 'string' ? searchParams.q : '';
  
  let products = [];
  if (query) {
    // Using Strapi's case-insensitive contains filter on the title
    products = await getProducts({ 'filters[title][$containsi]': query });
  }

  const wishlistIds = await getWishlistIds();

  return (
    <>
      <div className={styles.header}>
        <div className="container">
          <h1 className={styles.title}>Search Results</h1>
          <p className={styles.subtitle}>
            {query ? (
              <>Showing results for &ldquo;<strong>{query}</strong>&rdquo; — {products.length} {products.length === 1 ? 'Product' : 'Products'} found</>
            ) : (
              'Enter a search term to find products.'
            )}
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: '4rem' }}>
        {products.length === 0 && query ? (
          <div className={styles.emptyState}>
            <h3>No products found</h3>
            <p>We couldn&apos;t find any products matching &ldquo;{query}&rdquo;.</p>
          </div>
        ) : products.length > 0 ? (
          <div className={styles.productGrid}>
            {products.map((product: any) => (
              <ProductCard key={product.id} product={product} isWishlisted={wishlistIds.includes(product.id)} />
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
