'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const STAGES = [
  { slug: '', label: 'Overview' },
  { slug: 'intake', label: 'Intake' },
  { slug: 'classification', label: 'Classification' },
  { slug: 'estimate', label: 'Estimate' },
  { slug: 'scenarios', label: 'Scenarios' },
  { slug: 'review', label: 'Review & Approval' },
  { slug: 'outputs', label: 'Outputs' },
];

export function TransitionStepper({ transitionId }: { transitionId: string }) {
  const pathname = usePathname();
  const base = `/transitions/${transitionId}`;

  return (
    <nav aria-label="Transition stages" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
      {STAGES.map((s, i) => {
        const href = s.slug ? `${base}/${s.slug}` : base;
        const active = pathname === href;
        return (
          <Link
            key={s.slug}
            href={href}
            aria-current={active ? 'step' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              border: '1px solid var(--line)',
              background: active ? 'var(--teal)' : 'white',
              color: active ? 'white' : 'var(--ink)',
            }}
          >
            <span style={{ opacity: 0.7 }}>{i + 1}.</span> {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
