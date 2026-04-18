import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';

const COMMERCE_API = process.env.COMMERCE_API_URL || 'http://localhost:4000/api/v1';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***@***';
  const visible = local.slice(0, 3);
  return `${visible}***@${domain}`;
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return '****';
  return phone.slice(0, 4) + '****' + phone.slice(-3);
}

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

  if (!token) redirect('/login');

  const profileData = await getProfile(token);
  if (!profileData) redirect('/login');

  const orders = await getOrders(token);

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '80vh', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700,
          letterSpacing: '-1px', marginBottom: '8px', color: 'var(--text-primary)',
        }}>My Account</h1>
        <p style={{ color: 'var(--text-tertiary)', marginBottom: '16px', fontSize: '0.9rem' }}>
          Welcome back, <strong style={{ color: 'var(--text-primary)' }}>{profileData.user.full_name}</strong> · {maskEmail(profileData.user.email)}
          {profileData.user.phone && <> · {maskPhone(profileData.user.phone)}</>}
        </p>

        <Link href="/wishlist" style={{
          display: 'inline-block', marginBottom: '32px', fontSize: '0.8rem',
          color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'none',
          border: '1px solid var(--border-color)', padding: '8px 16px',
          transition: 'border-color 0.2s',
        }}>
          ♡ View Wishlist →
        </Link>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{
            padding: '16px 24px', borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
          }}>
            <h2 style={{
              fontSize: '0.7rem', margin: 0, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-display)',
            }}>Order History</h2>
          </div>
          
          {orders.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <p>You haven&apos;t placed any orders yet.</p>
              <Link href="/category/all" style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Start shopping →</Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)' }}>
                    {['Order ID', 'Date', 'Total', 'Status', 'Tracking'].map(h => (
                      <th key={h} style={{
                        padding: '14px 24px', fontWeight: 700, fontSize: '0.65rem',
                        textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-tertiary)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order: any) => {
                    const attrs = order.attributes;
                    const date = new Date(attrs.createdAt).toLocaleDateString();
                    const statusColor = attrs.status === 'processing' ? '#0ea5e9' : 
                                        attrs.status === 'confirmed' ? '#4ade80' :
                                        attrs.status === 'cancelled' ? '#f87171' : '#fbbf24';
                                        
                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '14px 24px', fontWeight: 500, fontFamily: 'var(--font-display)' }}>#{order.id}</td>
                        <td style={{ padding: '14px 24px', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>{date}</td>
                        <td style={{ padding: '14px 24px', fontWeight: 500, fontFamily: 'var(--font-display)' }}>Tk {attrs.totalAmount}</td>
                        <td style={{ padding: '14px 24px' }}>
                          <span style={{ 
                            background: `${statusColor}22`, color: statusColor,
                            padding: '4px 12px', fontSize: '0.65rem', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.5px',
                          }}>
                            {attrs.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 24px' }}>
                          {attrs.tracking_code ? (
                            <Link 
                              href={`/track?trackingCode=${encodeURIComponent(attrs.tracking_code)}`}
                              style={{ color: 'var(--text-primary)', fontWeight: 600, textDecoration: 'none', fontSize: '0.8rem' }}
                            >
                              Track →
                            </Link>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>—</span>
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
