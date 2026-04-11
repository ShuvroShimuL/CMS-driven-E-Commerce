import Link from 'next/link';
import styles from './Header.module.css';

export default function Header() {
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
          <button className={styles.cartBtn}>Cart (0)</button>
        </div>
      </div>
    </header>
  );
}
