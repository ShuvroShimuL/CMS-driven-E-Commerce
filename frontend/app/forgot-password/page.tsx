'use client'

import { useState } from 'react';
import Link from 'next/link';
import { forgotPassword } from '@/app/actions/auth';
import styles from '@/styles/auth.module.css';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    await forgotPassword(formData);
    setSent(true);
    setLoading(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoMark}>PREMIUM.</div>
        <h1 className={styles.title}>Forgot password?</h1>
        <p className={styles.subtitle}>
          Enter your email and we&apos;ll send you a reset link
        </p>

        {sent ? (
          <div>
            <div className={styles.success}>
              ✓ If an account exists for that email, a reset link has been sent.
              Check your inbox (and spam folder).
            </div>
            <hr className={styles.divider} />
            <p className={styles.footer}><Link href="/login">Back to Sign In</Link></p>
          </div>
        ) : (
          <>
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label htmlFor="email">Email Address</label>
                <input id="email" name="email" type="email" required
                  placeholder="you@example.com" className={styles.input} autoFocus />
              </div>
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
            <hr className={styles.divider} />
            <p className={styles.footer}><Link href="/login">Back to Sign In</Link></p>
          </>
        )}
      </div>
    </div>
  );
}
