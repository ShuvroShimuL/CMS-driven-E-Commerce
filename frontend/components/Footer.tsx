import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.footerGrid}>
          <div className={styles.footerCol}>
            <h4>PREMIUM.</h4>
            <p style={{ color: 'var(--text-secondary)' }}>
              Curated quality products for your modern lifestyle.
            </p>
          </div>
          <div className={styles.footerCol}>
            <h4>Shop</h4>
            <ul className={styles.footerLinks}>
              <li><Link href="/category/all">All Products</Link></li>
              <li><Link href="/category/new">New Arrivals</Link></li>
              <li><Link href="/category/sale">On Sale</Link></li>
            </ul>
          </div>
          <div className={styles.footerCol}>
            <h4>Customer Service</h4>
            <ul className={styles.footerLinks}>
              <li><Link href="/contact">Contact Us</Link></li>
              <li><Link href="/shipping">Shipping Policy</Link></li>
              <li><Link href="/faq">FAQ</Link></li>
            </ul>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>&copy; {new Date().getFullYear()} Premium Store. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
