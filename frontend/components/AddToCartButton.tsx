'use client'

import { useState } from 'react';
import { addToCart } from '@/app/actions/cart';
import { useRouter } from 'next/navigation';

export default function AddToCartButton({ product, isOutOfStock }: { product: any, isOutOfStock: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAdd = async () => {
    if (isOutOfStock) return;
    setLoading(true);
    
    // Extract vital fields
    const productData = {
      id: product.id,
      slug: product.attributes.slug,
      title: product.attributes.title,
      price: product.attributes.price,
      image: product.attributes.images?.data?.[0]?.attributes?.url || ''
    };

    await addToCart(productData);
    setLoading(false);
    
    // Send them to cart route instead of a silent alert
    router.push('/cart');
  };

  return (
    <button 
      className="btn-primary" 
      style={{ flex: 1, opacity: (isOutOfStock || loading) ? 0.5 : 1, cursor: (isOutOfStock || loading) ? 'not-allowed' : 'pointer' }}
      disabled={isOutOfStock || loading}
      onClick={handleAdd}
    >
      {loading ? 'Adding...' : (isOutOfStock ? 'Sold Out' : 'Add to Cart')}
    </button>
  );
}
