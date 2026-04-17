'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { processCheckout } from '@/app/actions/checkout';
import styles from './page.module.css';
import { getCart } from '@/app/actions/cart';

const COMMERCE_API = process.env.NEXT_PUBLIC_COMMERCE_API_URL || 'https://cms-driven-e-commerce-api.onrender.com/api/v1';
const BKASH_NUMBER = '01910717957';

export default function CheckoutPage() {
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [district, setDistrict]         = useState('');
  const [shippingCost, setShippingCost] = useState(60);
  const [subtotal, setSubtotal]         = useState(0);

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bkash'>('cod');
  const [bkashTxnId, setBkashTxnId]       = useState('');

  // Coupon state
  const [couponCode, setCouponCode]         = useState('');
  const [couponLoading, setCouponLoading]   = useState(false);
  const [couponError, setCouponError]       = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess]   = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  const router = useRouter();

  useEffect(() => {
    async function loadCart() {
      const cart = await getCart();
      const items = cart?.attributes?.cartItems || [];
      const st = items.reduce((acc: number, item: any) => acc + (parseFloat(item.price) * item.quantity), 0);
      setSubtotal(st);
    }
    loadCart();
  }, []);

  useEffect(() => {
    const d = district.trim().toLowerCase();
    if (d === 'dhaka' || d === 'dhaka city') setShippingCost(60);
    else if (d.length > 0) setShippingCost(120);
    else setShippingCost(60);
    if (discountAmount > 0) {
      setDiscountAmount(0);
      setCouponSuccess(null);
      setCouponError('District changed — please re-apply coupon');
    }
  }, [district]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError(null);
    setCouponSuccess(null);
    setDiscountAmount(0);

    try {
      const orderTotal = subtotal + shippingCost;
      const res = await fetch(`${COMMERCE_API}/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), orderTotal }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCouponError(json.error || 'Invalid coupon');
      } else {
        setDiscountAmount(json.discountAmount);
        setCouponSuccess(`✓ "${json.coupon.code}" applied — you save Tk ${json.discountAmount.toFixed(2)}!`);
      }
    } catch {
      setCouponError('Could not validate coupon. Please try again.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setDiscountAmount(0);
    setCouponSuccess(null);
    setCouponError(null);
  };

  const orderTotal = subtotal + shippingCost - discountAmount;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate bKash TxnID if bKash selected
    if (paymentMethod === 'bkash' && bkashTxnId.trim().length < 4) {
      setError('Please enter a valid bKash Transaction ID');
      setLoading(false);
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set('district', district);
    formData.set('paymentMethod', paymentMethod);
    if (paymentMethod === 'bkash') formData.set('bkashTxnId', bkashTxnId.trim());
    if (couponCode.trim()) formData.set('couponCode', couponCode.trim().toUpperCase());

    const result = await processCheckout(formData);

    if (result.success && result.orderId) {
      let successUrl = `/order-success?id=${(result.orderId as string).slice(0, 8).toUpperCase()}&method=${paymentMethod}`;
      if (discountAmount > 0) successUrl += `&coupon=${couponCode.trim().toUpperCase()}&saved=${discountAmount.toFixed(2)}`;
      router.replace(successUrl);

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

          {/* ─── Coupon Field ─── */}
          <div style={{ margin: '24px 0', padding: '20px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 600, fontSize: '0.9rem' }}>
              🎟️ Coupon Code
            </label>
            {couponSuccess ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem' }}>{couponSuccess}</span>
                <button type="button" onClick={handleRemoveCoupon}
                  style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  Remove
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className={styles.input}
                  style={{ margin: 0, flex: 1, textTransform: 'uppercase' }}
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  style={{
                    background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px',
                    padding: '0 20px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                    opacity: couponLoading || !couponCode.trim() ? 0.6 : 1
                  }}
                >
                  {couponLoading ? '...' : 'Apply'}
                </button>
              </div>
            )}
            {couponError && <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '8px 0 0' }}>{couponError}</p>}
          </div>

          {/* ─── Payment Method Selector ─── */}
          <div style={{ margin: '0 0 24px', padding: '20px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', marginBottom: '14px', fontWeight: 600, fontSize: '0.9rem' }}>
              💳 Payment Method
            </label>

            <div style={{ display: 'flex', gap: '12px', marginBottom: paymentMethod === 'bkash' ? '16px' : 0 }}>
              {/* COD Option */}
              <button
                type="button"
                onClick={() => setPaymentMethod('cod')}
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: paymentMethod === 'cod' ? '2px solid #121212' : '2px solid #e2e8f0',
                  background: paymentMethod === 'cod' ? '#f1f5f9' : '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>🚚</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Cash on Delivery</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Pay when you receive</div>
                </div>
              </button>

              {/* bKash Option */}
              <button
                type="button"
                onClick={() => setPaymentMethod('bkash')}
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: paymentMethod === 'bkash' ? '2px solid #e2136e' : '2px solid #e2e8f0',
                  background: paymentMethod === 'bkash' ? '#fdf2f8' : '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: '1.3rem', color: '#e2136e', fontWeight: 800 }}>b</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>bKash</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Send money manually</div>
                </div>
              </button>
            </div>

            {/* ─── bKash Instructions Panel ─── */}
            {paymentMethod === 'bkash' && (
              <div style={{
                background: '#fff',
                border: '1px solid #f9a8d4',
                borderRadius: '10px',
                padding: '16px',
              }}>
                <div style={{ marginBottom: '12px', fontSize: '0.875rem', color: '#4a4a4a', lineHeight: 1.7 }}>
                  <strong style={{ color: '#e2136e' }}>Steps:</strong>
                  <ol style={{ margin: '8px 0 0 16px', padding: 0 }}>
                    <li>Open your bKash app → <strong>Send Money</strong></li>
                    <li>Send <strong>Tk {orderTotal.toFixed(2)}</strong> to:</li>
                  </ol>
                </div>

                <div style={{
                  background: '#fdf2f8',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '2px' }}>bKash Number</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e2136e', letterSpacing: '1px' }}>
                      {BKASH_NUMBER}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(BKASH_NUMBER); }}
                    style={{
                      background: '#e2136e', color: '#fff', border: 'none', borderRadius: '6px',
                      padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                    }}
                  >
                    Copy
                  </button>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.85rem', color: '#4a4a4a' }}>
                    Your bKash Transaction ID *
                  </label>
                  <input
                    type="text"
                    value={bkashTxnId}
                    onChange={(e) => setBkashTxnId(e.target.value.toUpperCase())}
                    placeholder="e.g. TRX1234ABCD"
                    required={paymentMethod === 'bkash'}
                    className={styles.input}
                    style={{ margin: 0, textTransform: 'uppercase', borderColor: '#f9a8d4' }}
                  />
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>
                    Find this in your bKash app → Transaction History
                  </p>
                </div>
              </div>
            )}
          </div>

          {paymentMethod === 'cod' && (
            <div className={styles.paymentNotice}>
              🚚 Cash on Delivery — Pay when your order arrives
            </div>
          )}

          <button
            type="submit"
            className={`btn-primary ${styles.submitBtn}`}
            disabled={loading}
            style={{
              opacity: loading ? 0.7 : 1,
              background: paymentMethod === 'bkash' ? '#e2136e' : undefined,
            }}
          >
            {loading
              ? 'Processing Order...'
              : paymentMethod === 'bkash'
                ? `Confirm bKash Payment • Tk ${orderTotal.toFixed(2)}`
                : `Place Order (COD) • Tk ${orderTotal.toFixed(2)}`
            }
          </button>
        </form>

        {/* ─── Order Summary ─── */}
        <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', height: 'fit-content' }}>
          <h3 style={{ marginTop: 0, marginBottom: '24px' }}>Order Summary</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span>Subtotal</span>
            <span>Tk {subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', color: '#64748b' }}>
            <span>Shipping ({shippingCost === 60 ? 'Inside Dhaka' : 'Outside Dhaka'})</span>
            <span>Tk {shippingCost}</span>
          </div>
          {discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', color: '#16a34a', fontWeight: 600 }}>
              <span>Coupon Discount</span>
              <span>– Tk {discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', color: '#64748b', fontSize: '0.85rem' }}>
            <span>Payment</span>
            <span>{paymentMethod === 'bkash' ? 'bKash' : 'Cash on Delivery'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2rem', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <span>Total</span>
            <span>Tk {orderTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
