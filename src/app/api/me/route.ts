import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';

export const GET = withAuth(async (_request, session) => {
  return NextResponse.json({
    user: {
      id: session.user.id,
      username: session.user.username,
      displayName: session.user.displayName,
      role: session.user.role,
      assignments: session.user.assignments,
    },
  });
});
