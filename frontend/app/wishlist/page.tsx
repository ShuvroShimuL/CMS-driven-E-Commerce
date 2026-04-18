import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { getWishlistItems } from '@/app/actions/wishlist';
import { getProducts } from '@/lib/api';
import ProductCard from '@/components/ProductCard';

export default async function WishlistPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('commerce_access_token')?.value;
  if (!token) redirect('/login');

  const wishlistItems = await getWishlistItems();
  const allProducts = await getProducts();

  // Match wishlist slugs to full product data from Strapi
  const wishlistedProducts = wishlistItems
    .map((item: any) => allProducts.find((p: any) => p.attributes.slug === item.product_slug))
    .filter(Boolean);

  // All wishlist items are wishlisted by definition
  const wishlistIds = wishlistItems.map((item: any) => item.product_strapi_id);

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '80vh' }}>
      <div style={{
        background: 'var(--bg-tertiary)', padding: '3rem 0', marginBottom: '3rem',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div className="container">
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 700,
            letterSpacing: '-1px', margin: 0,
          }}>My Wishlist</h1>
          <p style={{ color: 'var(--text-tertiary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {wishlistedProducts.length} {wishlistedProducts.length === 1 ? 'item' : 'items'} saved
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: '4rem' }}>
        {wishlistedProducts.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '4rem 2rem',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          }}>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: '1.5rem', fontSize: '1rem' }}>
              Your wishlist is empty. Browse products and tap the ♡ to save items here.
            </p>
            <Link href="/category/all" className="btn-primary">
              Explore Products
            </Link>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '2rem',
          }}>
            {wishlistedProducts.map((product: any) => (
              <ProductCard
                key={product.id}
                product={product}
                isWishlisted={wishlistIds.includes(product.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
