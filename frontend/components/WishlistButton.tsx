'use client'

import { useState, useTransition } from 'react';
import { toggleWishlist } from '@/app/actions/wishlist';
import { useRouter } from 'next/navigation';

export default function WishlistButton({
  productId,
  productSlug,
  initialWishlisted = false,
  size = 20,
  className = '',
}: {
  productId: number;
  productSlug: string;
  initialWishlisted?: boolean;
  size?: number;
  className?: string;
}) {
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    startTransition(async () => {
      const result = await toggleWishlist(productId, productSlug);
      if (result.success) {
        setWishlisted(result.action === 'added');
        router.refresh();
      } else if (result.error?.includes('sign in')) {
        router.push('/login');
      }
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={className}
      aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      style={{
        background: 'none',
        border: 'none',
        cursor: isPending ? 'wait' : 'pointer',
        padding: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: isPending ? 'scale(0.9)' : 'scale(1)',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={wishlisted ? '#f43f5e' : 'none'}
        stroke={wishlisted ? '#f43f5e' : 'var(--text-tertiary)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          filter: wishlisted ? 'drop-shadow(0 0 4px rgba(244,63,94,0.4))' : 'none',
        }}
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
