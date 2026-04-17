import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import styles from '@/styles/auth.module.css';

const COMMERCE_API = process.env.COMMERCE_API_URL || 'http://localhost:4000/api/v1';

async function getProfile(token: string) {
  const res = await fetch(`${COMMERCE_API}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!res.ok) return null;
  return res.json();
}

async function getOrders(token: string) {
  const res = await fetch(`${COMMERCE_API}/users/orders`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.orders?.data || [];
}

export default async function AccountPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('commerce_access_token')?.value;

  if (!token) {
    redirect('/login');
  }

  const profileData = await getProfile(token);
  if (!profileData) {
    redirect('/login');
  }

  const orders = await getOrders(token);

  return (
    <div className={styles.page}>
      <div className={styles.container} style={{ maxWidth: '900px', margin: '40px auto' }}>
        <h1 className={styles.title} style={{ textAlign: 'left', marginBottom: '8px' }}>My Account</h1>
        <p style={{ color: '#64748b', marginBottom: '32px' }}>
          Welcome back, <strong>{profileData.user.full_name}</strong> ({profileData.user.email})
        </p>

        <div className={styles.card} style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0, color: '#0f172a' }}>Order History</h2>
          </div>
          
          {orders.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
              <p>You haven't placed any orders yet.</p>
              <Link href="/category/all" style={{ color: '#7c3aed', fontWeight: 'bold' }}>Start shopping</Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.875rem' }}>
                    <th style={{ padding: '16px 24px', fontWeight: 600 }}>Order ID</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600 }}>Total</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600 }}>Tracking</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order: any) => {
                    const attrs = order.attributes;
                    const date = new Date(attrs.createdAt).toLocaleDateString();
                    const statusColor = attrs.status === 'processing' ? '#0ea5e9' : 
                                        attrs.status === 'confirmed' ? '#16a34a' :
                                        attrs.status === 'cancelled' ? '#ef4444' : '#f59e0b';
                                        
                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '16px 24px', fontWeight: 500 }}>#{order.id}</td>
                        <td style={{ padding: '16px 24px', color: '#64748b' }}>{date}</td>
                        <td style={{ padding: '16px 24px', fontWeight: 500 }}>Tk {attrs.totalAmount}</td>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{ 
                            background: `${statusColor}22`, 
                            color: statusColor,
                            padding: '4px 12px',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase'
                          }}>
                            {attrs.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          {attrs.tracking_code ? (
                            <Link 
                              href={`/track?trackingCode=${encodeURIComponent(attrs.tracking_code)}`}
                              style={{ color: '#7c3aed', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              Track ↗
                            </Link>
                          ) : (
                            <span style={{ color: '#cbd5e1', fontSize: '0.875rem' }}>Unavailable</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
