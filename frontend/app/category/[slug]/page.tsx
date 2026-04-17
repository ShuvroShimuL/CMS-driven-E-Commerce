import { getCategoryBySlug, getProducts, getCategories } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import styles from './page.module.css';
import type { Metadata } from 'next';

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((cat: any) => ({
    slug: cat.attributes.slug,
  }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  if (params.slug === 'all') {
    return {
      title: 'All Products',
      description: 'Browse our full catalog of premium products — electronics, fashion, lifestyle essentials. Fast delivery across Bangladesh.',
    };
  }

  const category = await getCategoryBySlug(params.slug);
  if (!category) return { title: 'Category Not Found' };

  const name = category.attributes.name;
  const count = category.attributes.products?.data?.length || 0;

  return {
    title: `${name}`,
    description: `Shop ${count} premium ${name.toLowerCase()} products at Premium Store. Quality guaranteed with fast delivery.`,
    openGraph: {
      title: `${name} — Premium Store`,
      description: `Explore ${count} curated ${name.toLowerCase()} products.`,
    },
  };
}
export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const isAll = params.slug === 'all';
  let title = 'All Products';
  let products = [];

  if (isAll) {
    products = await getProducts();
  } else {
    const category = await getCategoryBySlug(params.slug);
    if (category) {
      title = category.attributes.name;
      // Strapi relation data is nested
      const relatedProducts = category.attributes.products?.data || [];
      // Re-map format so it behaves exactly like a root product endpoint
      products = relatedProducts.map((p: any) => ({
        id: p.id,
        attributes: { ...p.attributes, category: { data: category } }
      }));
    } else {
      title = 'Category Not Found';
    }
  }

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
        {products.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>No products found</h3>
            <p>We couldn't find any products in this category.</p>
          </div>
        ) : (
          <div className={styles.productGrid}>
            {products.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
