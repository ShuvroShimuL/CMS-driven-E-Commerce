import Link from 'next/link';
import styles from '../checkout/page.module.css';

export default function OrderSuccessPage({
  searchParams,
}: {
  searchParams: { id?: string; method?: string };
}) {
  const orderId = searchParams.id || 'UNKNOWN';
  const isBkash = searchParams.method === 'bkash';

  return (
    <div className={styles.container}>
      <div className={styles.successMessage}>
        <div className={styles.successIcon}>{isBkash ? '📱' : '🎉'}</div>
        <h1 style={{ marginBottom: '1rem' }}>
          {isBkash ? 'Order Received!' : 'Order Confirmed!'}
        </h1>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
          Thank you for shopping with us. Your Order ID is{' '}
          <strong>#{orderId}</strong>.
        </p>

        {isBkash ? (
          <div style={{
            background: '#fdf2f8',
            border: '1px solid #f9a8d4',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '2rem',
            textAlign: 'left',
            maxWidth: '420px',
            margin: '0 auto 2rem',
          }}>
            <p style={{ fontWeight: 600, color: '#e2136e', marginBottom: '8px' }}>
              ⏳ Payment Verification in Progress
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              We've received your bKash transaction details.
              Our team will verify the payment and confirm your order shortly.
              You'll receive a confirmation email once verified.
            </p>
          </div>
        ) : (
          <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
            Your order has been placed successfully. You will pay the courier upon delivery.
          </p>
        )}

        <Link href="/category/all" className="btn-primary">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
