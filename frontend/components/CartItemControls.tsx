'use client'

import { useState, useTransition } from 'react';
import { updateCartItemQuantity, removeCartItem } from '@/app/actions/cart';
import { useRouter } from 'next/navigation';

export default function CartItemControls({ productId, initialQuantity }: {
  productId: number;
  initialQuantity: number;
}) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleUpdate = (newQty: number) => {
    if (isPending) return; // debounce — block while previous action runs
    if (newQty < 1) return handleRemove();
    setQuantity(newQty); // optimistic update
    startTransition(async () => {
      await updateCartItemQuantity(productId, newQty);
      router.refresh();
    });
  };

  const handleRemove = () => {
    if (isPending) return;
    startTransition(async () => {
      await removeCartItem(productId);
      router.refresh();
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        opacity: isPending ? 0.6 : 1,
        transition: 'opacity 0.2s',
      }}>
        <button
          onClick={() => handleUpdate(quantity - 1)}
          disabled={isPending}
          style={{
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-secondary)',
            border: 'none',
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            transition: 'background 0.15s',
          }}
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span style={{
          width: '40px',
          textAlign: 'center',
          fontWeight: 600,
          fontSize: '0.95rem',
          userSelect: 'none',
        }}>
          {quantity}
        </span>
        <button
          onClick={() => handleUpdate(quantity + 1)}
          disabled={isPending}
          style={{
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-secondary)',
            border: 'none',
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontSize: '1.1rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            transition: 'background 0.15s',
          }}
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
      <button
        onClick={handleRemove}
        disabled={isPending}
        style={{
          background: 'none',
          border: 'none',
          color: '#ef4444',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
          padding: '2px 0',
          transition: 'opacity 0.15s',
          opacity: isPending ? 0.5 : 1,
        }}
      >
        Remove
      </button>
    </div>
  );
}
