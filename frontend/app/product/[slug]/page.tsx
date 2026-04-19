import { notFound } from 'next/navigation';
import { getProductBySlug, getProducts } from '@/lib/api';
import AddToCartButton from '@/components/AddToCartButton';
import WishlistButton from '@/components/WishlistButton';
import ReviewSection from '@/components/ReviewSection';
import ProductJsonLd from '@/components/ProductJsonLd';
import { getWishlistIds } from '@/app/actions/wishlist';
import styles from './page.module.css';
import type { Metadata } from 'next';

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product: any) => ({
    slug: product.attributes.slug,
  }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const product = await getProductBySlug(params.slug);
  if (!product) return { title: 'Product Not Found' };

  const { title, description, price, images, category } = product.attributes;
  const imageUrl = images?.data?.[0]?.attributes?.url;
  const categoryName = category?.data?.attributes?.name || 'Products';
  const desc = description
    ? (typeof description === 'string' ? description : 'Premium quality product').slice(0, 155) + '…'
    : `Shop ${title} at Premium Store — ${categoryName}`;
  const productUrl = `https://cms-driven-e-commerce.vercel.app/product/${params.slug}`;

  return {
    title: `${title} — Tk ${parseFloat(price).toFixed(2)}`,
    description: desc,
    alternates: { canonical: productUrl },
    openGraph: {
      title: `${title} — Tk ${parseFloat(price).toFixed(2)}`,
      description: desc,
      type: 'website',
      url: productUrl,
      ...(imageUrl && { images: [{ url: imageUrl, width: 800, height: 800, alt: title }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — Tk ${parseFloat(price).toFixed(2)}`,
      description: desc,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  const { title, description, price, stock, category, images } = product.attributes;
  const imageUrl = images?.data?.[0]?.attributes?.url || 'https://via.placeholder.com/800x800?text=No+Image';
  const categoryName = category?.data?.attributes?.name || 'Uncategorized';
  const isOutOfStock = stock <= 0;
  const wishlistIds = await getWishlistIds();
  const isWishlisted = wishlistIds.includes(product.id);

  return (
    <div className={`container ${styles.container}`}>
      <ProductJsonLd product={product} />
      <div className={styles.grid}>
        <div className={styles.imageGallery}>
          <img src={imageUrl} alt={title} className={styles.mainImage} />
        </div>
        
        <div className={styles.info}>
          <span className={styles.category}>{categoryName}</span>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.price}>Tk {parseFloat(price).toFixed(2)}</div>
          
          <div className={styles.description}>
            {description}
          </div>
          
          <div style={{ color: isOutOfStock ? 'var(--accent-color)' : 'inherit', fontWeight: 600 }}>
            {isOutOfStock ? 'Out of Stock' : `In Stock: ${stock} units`}
          </div>

          <div className={styles.actions}>
            <AddToCartButton product={product} isOutOfStock={isOutOfStock} />
            <WishlistButton productId={product.id} productSlug={params.slug} initialWishlisted={isWishlisted} size={22} />
          </div>
        </div>
      </div>

      {/* Customer Reviews */}
      <ReviewSection productId={product.id} productSlug={params.slug} />
    </div>
  );
}

