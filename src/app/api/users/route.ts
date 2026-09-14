import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireCurrentUser } from '@/lib/session';
import { handleApiError } from '@/server/apiError';

export async function GET() {
  try {
    await requireCurrentUser();
    const users = await db.user.findMany({
      select: { id: true, name: true, email: true, roles: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(users.map((u) => ({ ...u, roles: JSON.parse(u.roles) })));
  } catch (err) {
    return handleApiError(err);
  }
}
