'use client'

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { registerUser } from '@/app/actions/auth';
import styles from '@/styles/auth.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    if (formData.get('password') !== formData.get('confirmPassword')) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    const result = await registerUser(formData);
    if (result.success) {
      router.push(`/verify-otp?email=${encodeURIComponent(result.email as string)}`);
    } else {
      setError(result.error || 'Registration failed');
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoMark}>PREMIUM.</div>
        <h1 className={styles.title}>Create account</h1>
        <p className={styles.subtitle}>Join us and start shopping smarter</p>

        {error && <div className={styles.error}>{error}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="full_name">Full Name *</label>
            <input id="full_name" name="full_name" type="text" required
              placeholder="Shuvro Shimul" className={styles.input} />
          </div>
          <div className={styles.field}>
            <label htmlFor="email">Email Address *</label>
            <input id="email" name="email" type="email" required
              placeholder="you@example.com" className={styles.input} />
          </div>
          <div className={styles.field}>
            <label htmlFor="phone">Phone Number</label>
            <input id="phone" name="phone" type="tel"
              placeholder="+880 1700 000000" className={styles.input} />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">Password *</label>
            <input id="password" name="password" type="password" required
              placeholder="At least 8 characters" minLength={8} className={styles.input} />
          </div>
          <div className={styles.field}>
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <input id="confirmPassword" name="confirmPassword" type="password" required
              placeholder="Repeat your password" minLength={8} className={styles.input} />
          </div>
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <hr className={styles.divider} />
        <p className={styles.footer}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
