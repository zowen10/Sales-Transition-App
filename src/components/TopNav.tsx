'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { CurrentUser } from '@/lib/session';

const LINKS = [
  { href: '/transitions', label: 'My Transitions' },
  { href: '/transitions/new', label: 'New Transition' },
  { href: '/templates', label: 'Templates' },
  { href: '/approvals', label: 'Approvals' },
];

export function TopNav({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const isAdmin = user.roles.includes('ADMINISTRATOR');

  return (
    <header style={{ borderBottom: '1px solid var(--line)', background: 'white' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>
          Sales Transition App <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· Flow Builder</span>
        </div>
        <nav style={{ display: 'flex', gap: 4, flex: 1 }} aria-label="Primary">
          {LINKS.concat(isAdmin ? [{ href: '/admin', label: 'Administration' }] : []).map((l) => {
            const active = pathname === l.href || (l.href !== '/transitions' && pathname?.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: active ? 'var(--teal-dark)' : 'var(--muted)',
                  background: active ? 'rgba(15,157,143,0.1)' : 'transparent',
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>{user.name}</span>
          <button className="btn" onClick={() => signOut({ callbackUrl: '/login' })}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
