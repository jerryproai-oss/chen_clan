import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { logAudit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    // CSRF Origin 驗證
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json({ error: '非法來源' }, { status: 403 });
      }
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    // Rate limit 檢查
    const rateLimitResult = checkRateLimit(ip);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: `登入嘗試過於頻繁，請 ${rateLimitResult.retryAfterSeconds} 秒後再試` },
        { status: 429 }
      );
    }

    // 解析輸入
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: '無效的請求格式' }, { status: 400 });
    }

    const { username, password } = body as { username?: string; password?: string };

    if (!username || !password) {
      return NextResponse.json({ error: '請輸入帳號和密碼' }, { status: 400 });
    }

    if (username.length > 30 || password.length > 128) {
      return NextResponse.json({ error: '帳號或密碼長度超出限制' }, { status: 400 });
    }

    // 查找使用者
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() },
    });

    if (!user || user.status !== 'ACTIVE') {
      await logAudit({
        action: 'LOGIN_FAILED',
        details: { username, reason: user ? 'inactive' : 'not_found' },
        ip,
      });
      return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 });
    }

    // 驗證密碼
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await logAudit({
        action: 'LOGIN_FAILED',
        userId: user.id,
        details: { reason: 'wrong_password' },
        ip,
      });
      return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 });
    }

    // 建立 session
    const session = await createSession(user.id);

    // 更新最近登入時間
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await logAudit({
      action: 'LOGIN_SUCCESS',
      userId: user.id,
      ip,
    });

    // 回應
    const responseBody: {
      user: {
        id: string;
        username: string;
        displayName: string;
        role: string;
      };
      requirePasswordChange?: boolean;
    } = {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    };

    if (user.mustChangePassword) {
      responseBody.requirePasswordChange = true;
    }

    const response = NextResponse.json(responseBody);
    setSessionCookie(response, session.token);
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
