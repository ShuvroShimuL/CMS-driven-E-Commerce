import Link from 'next/link';
import styles from '../checkout/page.module.css';

export default function OrderSuccessPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const orderId = searchParams.id || 'UNKNOWN';

  return (
    <div className={styles.container}>
      <div className={styles.successMessage}>
        <div className={styles.successIcon}>🎉</div>
        <h1 style={{ marginBottom: '1rem' }}>Order Confirmed!</h1>
        <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
          Thank you for shopping with us. Your Order ID is{' '}
          <strong>#{orderId}</strong>.
          <br />
          Your order has been placed successfully. You will pay the courier upon
          delivery.
        </p>
        <Link href="/category/all" className="btn-primary">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
