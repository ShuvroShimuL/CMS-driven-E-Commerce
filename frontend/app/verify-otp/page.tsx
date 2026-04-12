'use client'

import { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyOTP, resendOTP } from '@/app/actions/auth';
import styles from '@/styles/auth.module.css';

function VerifyOTPForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const email        = searchParams.get('email') || '';

  const [otp, setOtp]         = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [resent, setResent]   = useState(false);
  const inputRefs             = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0)
      inputRefs.current[idx - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    if (digits.length === 0) return;
    const next = ['', '', '', '', '', ''];
    digits.forEach((d, i) => { next[i] = d; });
    setOtp(next);
    // Focus the box after the last pasted digit (or the last box)
    const focusIdx = Math.min(digits.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter all 6 digits'); return; }
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.set('email', email);
    formData.set('otp', code);
    const result = await verifyOTP(formData);
    if (result.success) {
      router.replace('/account');
      router.refresh();
    } else {
      setError(result.error || 'Verification failed');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResent(false);
    await resendOTP(email);
    setResent(true);
    setResending(false);
    setOtp(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
  };

  return (
    <div className={styles.card}>
      <div className={styles.logoMark}>PREMIUM.</div>
      <h1 className={styles.title}>Check your email</h1>
      <p className={styles.subtitle}>
        We sent a 6-digit code to <strong>{email || 'your email'}</strong>
      </p>

      {error  && <div className={styles.error}>{error}</div>}
      {resent && <div className={styles.success}>✓ New OTP sent! Check your inbox.</div>}

      <div className={styles.infoBox}>Code expires in 10 minutes</div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.otpGrid}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e)  => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className={styles.otpInput}
              autoFocus={i === 0}
            />
          ))}
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Verifying…' : 'Verify Email'}
        </button>
      </form>

      <hr className={styles.divider} />
      <p className={styles.footer}>
        Didn&apos;t receive it?{' '}
        <button
          onClick={handleResend}
          disabled={resending}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
                   color: '#7c3aed', fontWeight: 600, fontSize: '0.875rem' }}
        >
          {resending ? 'Sending…' : 'Resend OTP'}
        </button>
      </p>
    </div>
  );
}

export default function VerifyOTPPage() {
  return (
    <div className={styles.page}>
      <Suspense fallback={<div className={styles.card} style={{textAlign:'center'}}>Loading…</div>}>
        <VerifyOTPForm />
      </Suspense>
    </div>
  );
}
