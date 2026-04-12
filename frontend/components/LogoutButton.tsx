'use client'

import { useRouter } from 'next/navigation';
import { logoutUser } from '@/app/actions/auth';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await logoutUser();
    router.push('/');
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.875rem',
        color: '#ef4444',
        fontWeight: 600,
        padding: 0,
        textAlign: 'left'
      }}
    >
      🚪 Sign Out
    </button>
  );
}
