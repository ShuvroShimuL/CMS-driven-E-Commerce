export default function ProductJsonLd({ product }: { product: any }) {
  const { title, description, price, stock, images } = product.attributes;
  const imageUrl = images?.data?.[0]?.attributes?.url;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description: typeof description === 'string' ? description.slice(0, 300) : title,
    ...(imageUrl && { image: imageUrl }),
    offers: {
      '@type': 'Offer',
      price: parseFloat(price).toFixed(2),
      priceCurrency: 'BDT',
      availability: stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'Premium Store',
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
