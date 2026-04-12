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

  // We rely on backend fetching order ID to get tracking code, but right now
  // commerce-api /shipping/tracking/:code accepts the courier's tracking code.
  // Wait, if we only have orderId, our frontend doesn't know the code.
  // Actually, wait, tracking via API requires tracking Code.
  // The user Account page passes `?orderId=...`. But we also want users with 
  // just the email link to track it.
  // Let's implement fetch logic.
  
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
        <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', marginBottom: '24px' }}>
          <p style={{ margin: 0, color: '#475569' }}>
            Please enter your Steadfast/Packzy tracking number to view real-time delivery status.
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

      {loading && <p style={{ textAlign: 'center', padding: '24px' }}>Connecting to Courier...</p>}
      
      {error && <div className={styles.errorBox}>{error}</div>}

      {status && (
        <div className={styles.card} style={{ borderTop: '4px solid #7c3aed' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Courier Status</h2>
          
          <div style={{ background: '#f1f5f9', padding: '16px', borderRadius: '8px' }}>
             {typeof status === 'string' ? (
               <p style={{ margin: 0, fontWeight: 600 }}>{status}</p>
             ) : (
               <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                 {JSON.stringify(status, null, 2)}
               </pre>
             )}
          </div>
          <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '16px', textAlign: 'center' }}>
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
      <Suspense fallback={<div style={{ textAlign: 'center', marginTop: '40px' }}>Loading...</div>}>
         <TrackingView />
      </Suspense>
    </div>
  );
}
