import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSessionToken, clearSessionCookie } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const token = getSessionToken(request);
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const session = await prisma.session.findUnique({
        where: { tokenHash },
      });
      if (session) {
        await prisma.session.delete({ where: { id: session.id } });
        await logAudit({
          action: 'LOGOUT',
          userId: session.userId,
        });
      }
    }

    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  }
}
