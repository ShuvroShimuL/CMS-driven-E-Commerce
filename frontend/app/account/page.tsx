import { cookies } from 'next/headers';
import { redirect }  from 'next/navigation';
import Link           from 'next/link';
import LogoutButton   from '@/components/LogoutButton';
import styles         from './page.module.css';

const COMMERCE_API = process.env.COMMERCE_API_URL || 'http://localhost:4000/api/v1';

type Order = {
  id: number;
  attributes: {
    totalAmount: number;
    cartItems: any[];
    createdAt: string;
    fullName?: string;
    email?: string;
  };
};

async function getUserOrders(accessToken: string): Promise<Order[]> {
  try {
    const res = await fetch(`${COMMERCE_API}/users/orders`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store'
    });
    if (!res.ok) return [];
    const { orders } = await res.json();
    return orders || [];
  } catch { return []; }
}

function statusBadge(items: any[]) {
  // Strapi orders don't have a status field in the current schema, so derive from context
  return <span className={`${styles.badge} ${styles.badgePaid}`}>Confirmed</span>;
}

export default async function AccountPage() {
  const store        = cookies();
  const userCookie   = store.get('auth_user')?.value;
  const accessToken  = store.get('commerce_access_token')?.value;

  if (!userCookie) redirect('/login?redirect=/account');

  let user: any = {};
  try { user = JSON.parse(userCookie); } catch {}

  const orders = accessToken ? await getUserOrders(accessToken) : [];
  const initials = (user.full_name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase();

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Welcome Banner */}
        <div className={styles.welcome}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.welcomeText}>
            <h1>Hello, {user.full_name?.split(' ')[0] || 'there'}!</h1>
            <p>{user.email}</p>
          </div>
        </div>

        <div className={styles.grid}>
          {/* Profile Sidebar */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>My Profile</div>
            <div className={styles.profileRow}>
              <div className={styles.profileItem}>
                <label>Full Name</label>
                <span>{user.full_name || '—'}</span>
              </div>
              <div className={styles.profileItem}>
                <label>Email</label>
                <span>{user.email}</span>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '1.25rem 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Link href="/category/all"
                style={{ fontSize: '0.875rem', color: '#7c3aed', fontWeight: 600, textDecoration: 'none' }}>
                🛍️ Continue Shopping
              </Link>
              <LogoutButton />
            </div>
          </div>

          {/* Order History */}
          <div className={styles.ordersCard}>
            <div className={styles.cardTitle}>Order History ({orders.length})</div>

            {orders.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📦</div>
                <p>No orders yet.</p>
                <Link href="/category/all" style={{ color: '#7c3aed', fontWeight: 600 }}>
                  Start Shopping →
                </Link>
              </div>
            ) : (
              orders.map((order) => {
                const attr  = order.attributes;
                const date  = new Date(attr.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'short', day: 'numeric'
                });
                const items = attr.cartItems || [];
                const summary = items.map((i: any) => `${i.title} ×${i.quantity}`).join(', ');

                return (
                  <div key={order.id} className={styles.orderItem}>
                    <div className={styles.orderHeader}>
                      <span className={styles.orderId}>
                        #{String(order.id).padStart(5, '0')}
                      </span>
                      {statusBadge(items)}
                      <span className={styles.orderTotal}>
                        ${parseFloat(String(attr.totalAmount || 0)).toFixed(2)}
                      </span>
                      <span className={styles.orderDate}>{date}</span>
                    </div>
                    {summary && (
                      <div className={styles.orderItems}>🛒 {summary}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
