import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ForbiddenError } from '@/lib/rbac';

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof Error) {
    // Domain guard errors (state machine, approval, template) are surfaced as 409/400 rather than 500,
    // so the UI can show them as validation feedback rather than a crash.
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
}
