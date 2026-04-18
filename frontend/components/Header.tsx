import Link from 'next/link';
import { cookies } from 'next/headers';
import { getCart } from '@/app/actions/cart';
import { logoutUser } from '@/app/actions/auth';
import styles from './Header.module.css';

export default async function Header() {
  // Cart count
  let items: any[] = [];
  try {
    const cart = await getCart();
    items = cart?.attributes?.cartItems || [];
  } catch (err) {
    console.error('Silent Cart Failure:', err);
  }
  const totalQuantity = items.reduce((acc: number, item: any) => acc + item.quantity, 0);

  // Auth state (from non-httpOnly auth_user cookie set on login)
  let authUser: { id: number; email: string; full_name: string } | null = null;
  try {
    const userCookie = cookies().get('auth_user')?.value;
    if (userCookie) authUser = JSON.parse(userCookie);
  } catch {}

  const firstName = authUser?.full_name?.split(' ')[0] || '';

  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerContainer}`}>
        <Link href="/" className={styles.logo}>PREMIUM.</Link>

        <nav className={styles.nav}>
          <Link href="/"             className={styles.navLink}>Home</Link>
          <Link href="/category/all" className={styles.navLink}>Shop</Link>
          <Link href="/about"        className={styles.navLink}>About</Link>
        </nav>

        <div className={styles.actions}>
          {authUser ? (
            <>
              <div className={styles.profileMenu}>
                <button className={styles.navLink} style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingBottom: '16px', marginBottom: '-16px' }}>
                  {firstName} ▾
                </button>
                <div className={styles.profileDropdown}>
                  <Link href="/account" className={styles.dropdownItem}>My Account</Link>
                  <Link href="/wishlist" className={styles.dropdownItem}>My Wishlist</Link>
                  <form action={logoutUser}>
                    <button type="submit" className={`${styles.dropdownItem} ${styles.logoutBtn}`}>Log Out</button>
                  </form>
                </div>
              </div>
              <span style={{ color: 'var(--text-tertiary)' }}>|</span>
              <Link href="/cart" className={styles.cartBtn}>
                Cart ({totalQuantity})
              </Link>
            </>
          ) : (
            <>
              <Link href="/login"    className={styles.navLink}>Sign In</Link>
              <Link href="/register" className={styles.navLink}
                style={{ border: '1px solid var(--text-primary)', padding: '6px 14px' }}>
                Register
              </Link>
              <Link href="/cart" className={styles.cartBtn}>Cart ({totalQuantity})</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
