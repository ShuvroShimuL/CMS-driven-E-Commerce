import Link from 'next/link';
import { getCart } from '@/app/actions/cart';
import styles from './page.module.css';

export default async function CartPage() {
  let cart = null;
  try {
    cart = await getCart();
  } catch (err) {
    console.error("Cart Fetch Failed on CartPage:", err);
  }
  const items = cart?.attributes?.cartItems || [];

  const subtotal = items.reduce((acc: number, item: any) => acc + (parseFloat(item.price) * item.quantity), 0);

  return (
    <div className={`container ${styles.cartContainer}`}>
      <h1 style={{ marginBottom: '2rem', fontSize: '2.5rem', fontWeight: 800 }}>Your Cart</h1>
      
      {items.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
          <h2 style={{ marginBottom: '1rem' }}>Cart is empty</h2>
          <Link href="/category/all" className="btn-primary">Browse Products</Link>
        </div>
      ) : (
        <div className={styles.cartGrid}>
          <div className={styles.cartItems}>
            {items.map((item: any, idx: number) => (
              <div key={idx} className={styles.cartItem}>
                <img src={item.image} alt={item.title} className={styles.itemImage} />
                <div className={styles.itemInfo}>
                  <Link href={`/product/${item.slug}`} className={styles.itemTitle}>{item.title}</Link>
                  <div className={styles.itemPrice}>
                    ${parseFloat(item.price).toFixed(2)} x {item.quantity}
                  </div>
                </div>
                <div style={{ fontWeight: 600, fontSize: '1.25rem', display: 'flex', alignItems: 'center' }}>
                  ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          
          <div className={styles.summary}>
            <h3>Order Summary</h3>
            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Shipping</span>
              <span>Calculated at checkout</span>
            </div>
            <div className={styles.summaryTotal}>
              <span>Total</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            
            <Link href="/checkout" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              Proceed to Checkout &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
