import Link from 'next/link';
import { getCart } from '@/app/actions/cart';
import styles from './Header.module.css';

export default async function Header() {
  const cart = await getCart();
  const items = cart?.attributes?.cartItems || [];
  const totalQuantity = items.reduce((acc: number, item: any) => acc + item.quantity, 0);
  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerContainer}`}>
        <Link href="/" className={styles.logo}>
          PREMIUM.
        </Link>
        <nav className={styles.nav}>
          <Link href="/" className={styles.navLink}>Home</Link>
          <Link href="/category/all" className={styles.navLink}>Shop</Link>
          <Link href="/about" className={styles.navLink}>About</Link>
        </nav>
        <div className={styles.actions}>
          <Link href="/cart" className={styles.cartBtn}>Cart ({totalQuantity})</Link>
        </div>
      </div>
    </header>
  );
}
