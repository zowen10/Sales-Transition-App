import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { ForbiddenError, type UserRole } from './rbac';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user;
}

/** Use in API routes: throws (caught by the route's error handler) if unauthenticated. */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError('Sign in required.');
  return user;
}
