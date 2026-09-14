import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { TopNav } from '@/components/TopNav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopNav user={user} />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>{children}</main>
    </div>
  );
}
