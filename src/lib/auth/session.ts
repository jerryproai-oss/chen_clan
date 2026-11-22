import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

const COOKIE_NAME = 'clan_session';
const SESSION_IDLE_SECONDS = parseInt(process.env.SESSION_IDLE_SECONDS || '1800');
const SESSION_MAX_SECONDS = parseInt(process.env.SESSION_MAX_SECONDS || '86400');

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const idleAt = new Date(now.getTime() + SESSION_IDLE_SECONDS * 1000);
  const expiresAt = new Date(now.getTime() + SESSION_MAX_SECONDS * 1000);

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      idleAt,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function validateSession(token: string) {
  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          assignments: true,
        },
      },
    },
  });

  if (!session) return null;

  const now = new Date();
  if (now > session.expiresAt || now > session.idleAt) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  // Slide idle timeout
  const newIdleAt = new Date(now.getTime() + SESSION_IDLE_SECONDS * 1000);
  if (newIdleAt < session.expiresAt) {
    await prisma.session.update({
      where: { id: session.id },
      data: { idleAt: newIdleAt },
    });
  }

  return session;
}

export function getSessionToken(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value || null;
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function getSessionFromCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return validateSession(token);
}
