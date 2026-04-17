'use client'

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginUser } from '@/app/actions/auth';
import styles from '@/styles/auth.module.css';

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirect     = searchParams.get('redirect') || '/account';

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result   = await loginUser(formData);

    if (result.success) {
      router.replace(redirect);
      router.refresh();
    } else if (result.needsVerification) {
      router.push(`/verify-otp?email=${encodeURIComponent(result.email as string)}`);
    } else {
      setError(result.error || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.logoMark}>PREMIUM.</div>
      <h1 className={styles.title}>Welcome back</h1>
      <p className={styles.subtitle}>Sign in to your account</p>

      {error && <div className={styles.error}>{error}</div>}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="email">Email Address</label>
          <input id="email" name="email" type="email" required
            placeholder="you@example.com" className={styles.input} autoFocus />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required
            placeholder="Your password" className={styles.input} />
        </div>
        <div style={{ textAlign: 'right', marginTop: '-0.5rem' }}>
          <Link href="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            Forgot password?
          </Link>
        </div>
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <hr className={styles.divider} />
      <p className={styles.footer}>
        New to Premium Store? <Link href="/register">Create an account</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <Suspense fallback={<div className={styles.card} style={{textAlign:'center'}}>Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
