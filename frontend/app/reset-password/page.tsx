'use client'

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { resetPassword } from '@/app/actions/auth';
import styles from '@/styles/auth.module.css';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token        = searchParams.get('token') || '';
  const email        = searchParams.get('email') || '';

  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  if (!token || !email) {
    return (
      <div className={styles.card}>
        <div className={styles.logoMark}>PREMIUM.</div>
        <div className={styles.error}>
          Invalid or missing reset link. Please{' '}
          <Link href="/forgot-password">request a new one</Link>.
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (formData.get('newPassword') !== formData.get('confirmPassword')) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError(null);
    formData.set('token', token);
    formData.set('email', email);
    const result = await resetPassword(formData);
    if (result.success) {
      setDone(true);
    } else {
      setError(result.error || 'Reset failed');
    }
    setLoading(false);
  };

  return (
    <div className={styles.card}>
      <div className={styles.logoMark}>PREMIUM.</div>
      <h1 className={styles.title}>Set new password</h1>
      <p className={styles.subtitle}>Choose a strong password for your account</p>

      {error && <div className={styles.error}>{error}</div>}

      {done ? (
        <div>
          <div className={styles.success}>
            ✓ Password changed successfully! You can now sign in with your new password.
          </div>
          <hr className={styles.divider} />
          <p className={styles.footer}><Link href="/login">Go to Sign In →</Link></p>
        </div>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="newPassword">New Password</label>
            <input id="newPassword" name="newPassword" type="password" required
              placeholder="At least 8 characters" minLength={8} className={styles.input} autoFocus />
          </div>
          <div className={styles.field}>
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" required
              placeholder="Repeat new password" minLength={8} className={styles.input} />
          </div>
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Saving…' : 'Reset Password'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className={styles.page}>
      <Suspense fallback={<div className={styles.card} style={{textAlign:'center'}}>Loading…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
