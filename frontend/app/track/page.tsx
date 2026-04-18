'use client'

import { useState, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from '@/styles/auth.module.css';

const COMMERCE_API = process.env.NEXT_PUBLIC_COMMERCE_API_URL || 'http://localhost:4000/api/v1';

function TrackingView() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const trackingCode = searchParams.get('trackingCode');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<any>(null);

  const handleFetch = async (queryCode: string) => {
    setLoading(true);
    setError('');
    setStatus(null);
    try {
      const res = await fetch(`${COMMERCE_API}/shipping/tracking/${encodeURIComponent(queryCode)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch status');
      setStatus(json.tracking || 'No status returned');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (trackingCode) {
      handleFetch(trackingCode);
    }
  }, [trackingCode]);

  return (
    <div className={styles.container} style={{ maxWidth: '600px', margin: '40px auto' }}>
      <h1 className={styles.title}>Track Package</h1>
      
      {!trackingCode && (
        <div style={{
          background: 'var(--bg-tertiary)', padding: '24px',
          border: '1px solid var(--border-color)', marginBottom: '24px',
        }}>
          <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
            Enter your Steadfast/Packzy tracking number to view real-time delivery status.
          </p>
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              id="mcQuery"
              placeholder="Enter Tracking Code..." 
              className={styles.input} 
              style={{ margin: 0 }}
            />
            <button 
              className="btn-primary"
              style={{ whiteSpace: 'nowrap' }}
              onClick={() => {
                 const code = (document.getElementById('mcQuery') as HTMLInputElement).value;
                 if (code) handleFetch(code);
              }}
            >
              Track
            </button>
          </div>
        </div>
      )}

      {loading && <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>Connecting to Courier...</p>}
      
      {error && <div className={styles.error}>{error}</div>}

      {status && (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          padding: '24px', borderTop: '2px solid var(--text-primary)',
        }}>
          <h2 style={{
            fontSize: '0.7rem', marginBottom: '16px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-display)',
          }}>Courier Status</h2>
          
          <div style={{ background: 'var(--bg-tertiary)', padding: '16px', border: '1px solid var(--border-color)' }}>
             {typeof status === 'string' ? (
               <p style={{ margin: 0, fontWeight: 600 }}>{status}</p>
             ) : (
               <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                 {JSON.stringify(status, null, 2)}
               </pre>
             )}
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: '16px', textAlign: 'center' }}>
            Status updates are provided in real-time by Steadfast API.
          </p>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <div className={styles.page}>
      <Suspense fallback={<div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-tertiary)' }}>Loading...</div>}>
         <TrackingView />
      </Suspense>
    </div>
  );
}
