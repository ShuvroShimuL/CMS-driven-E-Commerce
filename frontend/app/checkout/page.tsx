'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { processCheckout } from '@/app/actions/checkout';
import styles from './page.module.css';
import { getCart } from '@/app/actions/cart';

export default function CheckoutPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [district, setDistrict] = useState('');
  const [shippingCost, setShippingCost] = useState(60); 
  const [subtotal, setSubtotal] = useState(0);
  const router = useRouter();

  // Load subtotal on mount
  useEffect(() => {
    async function loadCart() {
      const cart = await getCart();
      const items = cart?.attributes?.cartItems || [];
      const st = items.reduce((acc: number, item: any) => acc + (parseFloat(item.price) * item.quantity), 0);
      setSubtotal(st);
    }
    loadCart();
  }, []);

  // Recalculate shipping when district changes
  useEffect(() => {
    const d = district.trim().toLowerCase();
    if (d === 'dhaka' || d === 'dhaka city') setShippingCost(60);
    else if (d.length > 0) setShippingCost(120);
    else setShippingCost(60);
  }, [district]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set('shippingCost', shippingCost.toString());
    formData.set('district', district); // Ensure it's passed
    
    const result = await processCheckout(formData);

    if (result.success && result.orderId) {
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '32px' }}>
        <form className={styles.checkoutForm} onSubmit={handleSubmit} style={{ margin: 0 }}>
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
              <input 
                name="district" 
                type="text" 
                required 
                className={styles.input} 
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Dhaka"
              />
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
            {loading ? 'Processing Order...' : `Place Order • Tk ${subtotal + shippingCost}`}
          </button>
        </form>

        <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', height: 'fit-content' }}>
          <h3 style={{ marginTop: 0, marginBottom: '24px' }}>Order Summary</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span>Subtotal</span>
            <span>Tk {subtotal}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', color: '#64748b' }}>
            <span>Shipping ({shippingCost === 60 ? 'Inside Dhaka' : 'Outside Dhaka'})</span>
            <span>Tk {shippingCost}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2rem', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <span>Total</span>
            <span>Tk {subtotal + shippingCost}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
