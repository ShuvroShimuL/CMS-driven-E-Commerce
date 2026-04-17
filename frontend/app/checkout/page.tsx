'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { processCheckout, sendCodOtp, verifyCodOtp } from '@/app/actions/checkout';
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

  // COD OTP
  const [otpStep, setOtpStep]       = useState(false);
  const [otpCode, setOtpCode]       = useState('');
  const [otpEmail, setOtpEmail]     = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError]     = useState<string | null>(null);
  const [otpSent, setOtpSent]       = useState(false);

  // Coupon state
  const [couponCode, setCouponCode]         = useState('');
  const [couponLoading, setCouponLoading]   = useState(false);
  const [couponError, setCouponError]       = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess]   = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Form ref
  const [formRef, setFormRef] = useState<HTMLFormElement | null>(null);

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

  // ─── COD OTP Flow ───
  const handleSendOtp = async () => {
    if (!formRef) return;
    const fd = new FormData(formRef);
    const email = fd.get('email') as string;
    if (!email) { setOtpError('Please fill in your email address first.'); return; }

    setOtpLoading(true);
    setOtpError(null);
    setOtpEmail(email);

    const result = await sendCodOtp(email);
    if (result.success) {
      setOtpSent(true);
      setOtpStep(true);
    } else {
      setOtpError(result.error || 'Failed to send OTP');
    }
    setOtpLoading(false);
  };

  const handleVerifyAndSubmit = async () => {
    if (otpCode.length < 6) { setOtpError('Enter the 6-digit code'); return; }
    setOtpLoading(true);
    setOtpError(null);

    const result = await verifyCodOtp(otpEmail, otpCode);
    if (result.success) {
      // OTP verified — now submit the actual form
      if (formRef) {
        const event = new Event('submit', { bubbles: true, cancelable: true });
        // Set a flag so handleSubmit knows OTP is verified
        formRef.dataset.otpVerified = 'true';
        formRef.dispatchEvent(event);
      }
    } else {
      setOtpError(result.error || 'Invalid OTP');
    }
    setOtpLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // If COD and OTP not yet verified, send OTP first
    if (paymentMethod === 'cod' && !otpStep && e.currentTarget.dataset.otpVerified !== 'true') {
      await handleSendOtp();
      return;
    }

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

  const ds = {
    panel: { margin: '1.5rem 0', padding: '1.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' } as React.CSSProperties,
    label: { display: 'block' as const, marginBottom: '12px', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '1px', textTransform: 'uppercase' as const, color: 'var(--text-secondary)' },
    methodBtn: (active: boolean, accent?: string) => ({
      flex: 1, padding: '14px 16px',
      border: active ? `2px solid ${accent || 'var(--text-primary)'}` : '2px solid var(--border-color)',
      background: active ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
      cursor: 'pointer', display: 'flex' as const, alignItems: 'center' as const, gap: '10px',
      transition: 'all 0.2s', color: 'var(--text-primary)',
    }),
    row: { display: 'flex' as const, justifyContent: 'space-between' as const, marginBottom: '12px' },
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Secure Checkout</h1>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
        <form
          ref={(el) => setFormRef(el)}
          className={styles.checkoutForm}
          onSubmit={handleSubmit}
          style={{ margin: 0 }}
        >
          <div className={styles.formGrid}>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label>Full Name *</label>
              <input name="fullName" type="text" required className={styles.input} placeholder="Your full name" />
            </div>

            <div className={styles.field}>
              <label>Email Address *</label>
              <input name="email" type="email" required className={styles.input} placeholder="you@example.com" />
            </div>

            <div className={styles.field}>
              <label>Phone Number *</label>
              <input name="phone" type="tel" required className={styles.input} placeholder="+880 1XX XXX XXXX" />
            </div>

            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label>Full Address *</label>
              <textarea name="fullAddress" required rows={3} className={styles.input}></textarea>
            </div>

            <div className={styles.field}>
              <label>Division *</label>
              <input name="division" type="text" required className={styles.input} placeholder="e.g. Dhaka" />
            </div>

            <div className={styles.field}>
              <label>District *</label>
              <input
                name="district" type="text" required className={styles.input}
                value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g. Dhaka"
              />
            </div>

            <div className={styles.field}>
              <label>Thana *</label>
              <input name="thana" type="text" required className={styles.input} placeholder="e.g. Mirpur" />
            </div>
          </div>

          {/* ─── Coupon ─── */}
          <div style={ds.panel}>
            <label style={ds.label}>🎟️ Coupon Code</label>
            {couponSuccess ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '0.85rem' }}>{couponSuccess}</span>
                <button type="button" onClick={handleRemoveCoupon}
                  style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                  Remove
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code" className={styles.input}
                  style={{ margin: 0, flex: 1, textTransform: 'uppercase' }} />
                <button type="button" onClick={handleApplyCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  style={{
                    background: 'var(--text-primary)', color: 'var(--bg-primary)', border: 'none',
                    padding: '0 20px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap',
                    fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px',
                    opacity: couponLoading || !couponCode.trim() ? 0.4 : 1
                  }}>
                  {couponLoading ? '...' : 'Apply'}
                </button>
              </div>
            )}
            {couponError && <p style={{ color: '#f87171', fontSize: '0.8rem', margin: '8px 0 0' }}>{couponError}</p>}
          </div>

          {/* ─── Payment Method ─── */}
          <div style={ds.panel}>
            <label style={ds.label}>💳 Payment Method</label>
            <div style={{ display: 'flex', gap: '12px', marginBottom: paymentMethod === 'bkash' ? '16px' : 0 }}>
              <button type="button" onClick={() => { setPaymentMethod('cod'); setOtpStep(false); setOtpSent(false); setOtpCode(''); }}
                style={ds.methodBtn(paymentMethod === 'cod')}>
                <span style={{ fontSize: '1.3rem' }}>🚚</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Cash on Delivery</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Pay when you receive</div>
                </div>
              </button>

              <button type="button" onClick={() => { setPaymentMethod('bkash'); setOtpStep(false); setOtpSent(false); setOtpCode(''); }}
                style={ds.methodBtn(paymentMethod === 'bkash', '#e2136e')}>
                <img src="/images/bkash-logo.png" alt="bKash" style={{ height: '24px', width: 'auto' }} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>bKash</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Send money manually</div>
                </div>
              </button>
            </div>

            {/* bKash Panel */}
            {paymentMethod === 'bkash' && (
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(226,19,110,0.3)', padding: '16px' }}>
                <div style={{ marginBottom: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  <strong style={{ color: '#e2136e' }}>Steps:</strong>
                  <ol style={{ margin: '8px 0 0 16px', padding: 0 }}>
                    <li>Open your bKash app → <strong>Send Money</strong></li>
                    <li>Send <strong>Tk {orderTotal.toFixed(2)}</strong> to:</li>
                  </ol>
                </div>

                <div style={{
                  background: 'rgba(226,19,110,0.08)', padding: '12px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px',
                  border: '1px solid rgba(226,19,110,0.2)',
                }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>bKash Number</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#e2136e', letterSpacing: '1px', fontFamily: 'var(--font-display)' }}>
                      {BKASH_NUMBER}
                    </div>
                  </div>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(BKASH_NUMBER); }}
                    style={{
                      background: '#e2136e', color: '#fff', border: 'none',
                      padding: '6px 14px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                    }}>
                    Copy
                  </button>
                </div>

                <div style={{ marginBottom: '4px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Transaction ID *
                  </label>
                  <input type="text" value={bkashTxnId} onChange={(e) => setBkashTxnId(e.target.value)}
                    placeholder="e.g. Trx1234Abcd" required={paymentMethod === 'bkash'}
                    className={styles.input} style={{ margin: 0, borderColor: 'rgba(226,19,110,0.3)' }} />
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    Find this in your bKash app → Transaction History
                  </p>
                </div>
              </div>
            )}
          </div>

          {paymentMethod === 'cod' && !otpStep && (
            <div className={styles.paymentNotice}>
              🚚 Cash on Delivery — Email OTP verification required
            </div>
          )}

          {/* ─── COD OTP Modal ─── */}
          {paymentMethod === 'cod' && otpStep && (
            <div style={{
              ...ds.panel,
              border: '1px solid rgba(34,197,94,0.3)',
              background: 'var(--bg-secondary)',
            }}>
              <label style={{ ...ds.label, color: '#4ade80' }}>✉️ Email Verification</label>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                A 6-digit code has been sent to <strong style={{ color: 'var(--text-primary)' }}>{otpEmail}</strong>.
                Enter it below to confirm your order.
              </p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000" maxLength={6}
                  className={styles.input}
                  style={{ margin: 0, flex: 1, textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '8px', fontFamily: 'var(--font-display)' }}
                />
              </div>
              {otpError && <p style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: '8px' }}>{otpError}</p>}
              <button type="button" onClick={handleVerifyAndSubmit} disabled={otpLoading || otpCode.length < 6}
                style={{
                  width: '100%', padding: '12px', background: '#4ade80', color: '#0a0a0a',
                  border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  opacity: otpLoading || otpCode.length < 6 ? 0.5 : 1,
                }}>
                {otpLoading ? 'Verifying...' : 'Verify & Place Order'}
              </button>
              <button type="button" onClick={handleSendOtp} disabled={otpLoading}
                style={{
                  width: '100%', marginTop: '8px', padding: '8px', background: 'none',
                  color: 'var(--text-tertiary)', border: 'none', cursor: 'pointer', fontSize: '0.8rem',
                }}>
                Resend Code
              </button>
            </div>
          )}

          {!otpStep && (
            <button type="submit" className={`btn-primary ${styles.submitBtn}`} disabled={loading || otpLoading}
              style={{
                opacity: loading ? 0.7 : 1,
                background: paymentMethod === 'bkash' ? '#e2136e' : undefined,
                borderColor: paymentMethod === 'bkash' ? '#e2136e' : undefined,
              }}>
              {loading
                ? 'Processing Order...'
                : paymentMethod === 'bkash'
                  ? `Confirm bKash Payment • Tk ${orderTotal.toFixed(2)}`
                  : `Verify Email & Place Order • Tk ${orderTotal.toFixed(2)}`
              }
            </button>
          )}
        </form>

        {/* ─── Order Summary ─── */}
        <div style={{
          background: 'var(--bg-secondary)', padding: '24px',
          border: '1px solid var(--border-color)', height: 'fit-content',
          position: 'sticky' as const, top: '88px',
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '24px', fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-tertiary)' }}>Order Summary</h3>
          <div style={ds.row}>
            <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
            <span>Tk {subtotal.toFixed(2)}</span>
          </div>
          <div style={{ ...ds.row, color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            <span>Shipping ({shippingCost === 60 ? 'Inside Dhaka' : 'Outside Dhaka'})</span>
            <span>Tk {shippingCost}</span>
          </div>
          {discountAmount > 0 && (
            <div style={{ ...ds.row, color: '#4ade80', fontWeight: 600 }}>
              <span>Coupon Discount</span>
              <span>– Tk {discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div style={{ ...ds.row, color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
            <span>Payment</span>
            <span>{paymentMethod === 'bkash' ? 'bKash' : 'Cash on Delivery'}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem',
            borderTop: '1px solid var(--border-color)', paddingTop: '16px', fontFamily: 'var(--font-display)',
          }}>
            <span>Total</span>
            <span>Tk {orderTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
