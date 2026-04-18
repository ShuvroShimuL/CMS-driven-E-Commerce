import { getCategoryBySlug, getProducts, getCategories } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import FilterBar from '@/components/FilterBar';
import { getWishlistIds } from '@/app/actions/wishlist';
import styles from './page.module.css';
import type { Metadata } from 'next';

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((cat: any) => ({
    slug: cat.attributes.slug,
  }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const siteUrl = 'https://cms-driven-e-commerce.vercel.app';

  if (params.slug === 'all') {
    return {
      title: 'All Products',
      description: 'Browse our full catalog of premium products — electronics, fashion, lifestyle essentials. Fast delivery across Bangladesh.',
      alternates: { canonical: `${siteUrl}/category/all` },
      openGraph: {
        title: 'All Products — Premium Store',
        description: 'Browse our full catalog of premium products with fast delivery across Bangladesh.',
        url: `${siteUrl}/category/all`,
      },
      twitter: {
        card: 'summary',
        title: 'All Products — Premium Store',
        description: 'Browse our full catalog of premium products with fast delivery across Bangladesh.',
      },
    };
  }

  const category = await getCategoryBySlug(params.slug);
  if (!category) return { title: 'Category Not Found' };

  const name = category.attributes.name;
  const count = category.attributes.products?.data?.length || 0;
  const desc = `Shop ${count} premium ${name.toLowerCase()} products at Premium Store. Quality guaranteed with fast delivery.`;
  const catUrl = `${siteUrl}/category/${params.slug}`;

  return {
    title: `${name}`,
    description: desc,
    alternates: { canonical: catUrl },
    openGraph: {
      title: `${name} — Premium Store`,
      description: `Explore ${count} curated ${name.toLowerCase()} products.`,
      url: catUrl,
    },
    twitter: {
      card: 'summary',
      title: `${name} — Premium Store`,
      description: desc,
    },
  };
}

export default async function CategoryPage({ 
  params,
  searchParams 
}: { 
  params: { slug: string },
  searchParams: { [key: string]: string | undefined }
}) {
  const isAll = params.slug === 'all';
  let title = 'All Products';
  let products = [];

  // Build API Query based on URL filters
  const apiQuery: any = {
    'pagination[limit]': 100, // Reasonable max for a category
  };

  if (searchParams.sort) {
    apiQuery['sort'] = searchParams.sort; // e.g. price:asc
  }
  
  if (searchParams.inStock === 'true') {
    apiQuery['filters[stock][$gt]'] = 0;
  }

  if (isAll) {
    products = await getProducts(apiQuery);
  } else {
    // Filter heavily natively through Strapi
    apiQuery['filters[category][slug][$eq]'] = params.slug;
    
    // Fetch title
    const category = await getCategoryBySlug(params.slug);
    if (category) {
      title = category.attributes.name;
      products = await getProducts(apiQuery);
    } else {
      title = 'Category Not Found';
    }
  }

  const wishlistIds = await getWishlistIds();

  return (
    <>
      <div className={styles.header}>
        <div className="container">
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>
            {products.length} {products.length === 1 ? 'Product' : 'Products'} available
          </p>
        </div>
      </div>

      <div className="container">
        <FilterBar />

        {products.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>No products found</h3>
            <p>Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className={styles.productGrid}>
            {products.map((product: any) => (
              <ProductCard key={product.id} product={product} isWishlisted={wishlistIds.includes(product.id)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
