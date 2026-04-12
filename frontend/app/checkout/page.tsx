'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { processCheckout } from '@/app/actions/checkout';
import styles from './page.module.css';

export default function CheckoutPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await processCheckout(formData);

    if (result.success && result.orderId) {
      // Hard navigate so the Header Server Component re-renders with cart = 0
      router.replace(`/order-success?id=${(result.orderId as string).slice(0, 8).toUpperCase()}`);
    } else {
      setError(result.error || 'Checkout failed. Please try again.');
      setLoading(false);
    }
  };


  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Secure Checkout</h1>
      
      {error && <div className={styles.errorBox}>{error}</div>}

      <form className={styles.checkoutForm} onSubmit={handleSubmit}>
        <div className={styles.formGrid}>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label>Full Name *</label>
            <input name="fullName" type="text" required className={styles.input} />
          </div>

          <div className={styles.field}>
            <label>Email Address *</label>
            <input name="email" type="email" required className={styles.input} />
          </div>

          <div className={styles.field}>
            <label>Phone Number *</label>
            <input name="phone" type="tel" required className={styles.input} />
          </div>

          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label>Full Address *</label>
            <textarea name="fullAddress" required rows={3} className={styles.input}></textarea>
          </div>

          <div className={styles.field}>
            <label>Division *</label>
            <input name="division" type="text" required className={styles.input} />
          </div>

          <div className={styles.field}>
            <label>District *</label>
            <input name="district" type="text" required className={styles.input} />
          </div>

          <div className={styles.field}>
            <label>Thana *</label>
            <input name="thana" type="text" required className={styles.input} />
          </div>
        </div>

        <div className={styles.paymentNotice}>
          🔒 Secure Payment via SSLCommerz (Cards, Mobile Banking, Net Banking)
        </div>

        <button 
          type="submit" 
          className={`btn-primary ${styles.submitBtn}`} 
          disabled={loading}
          style={{ opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Processing Order...' : 'Place Order'}
        </button>
      </form>
    </div>
  );
}
