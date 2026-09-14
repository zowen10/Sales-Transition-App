'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('alex.director@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError('Invalid email or password.');
      return;
    }
    router.push('/transitions');
    router.refresh();
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={onSubmit} className="card" style={{ width: 380, padding: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--teal)', textTransform: 'uppercase' }}>
          Manhattan Associates · Flow Builder
        </div>
        <h1 style={{ fontSize: 22, margin: '8px 0 20px' }}>Handoff</h1>

        <label htmlFor="email" style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--muted)' }}>
          Email
        </label>
        <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ marginBottom: 12 }} />

        <label htmlFor="password" style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--muted)' }}>
          Password
        </label>
        <input id="password" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ marginBottom: 16 }} />

        {error && (
          <div role="alert" style={{ color: '#b42318', fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 16, lineHeight: 1.5 }}>
          Dev fixture accounts (password <code>password123</code>): alex.director, sam.sponsor, tim.templates, admin,
          pat.sales @example.com
        </div>
      </form>
    </div>
  );
}
