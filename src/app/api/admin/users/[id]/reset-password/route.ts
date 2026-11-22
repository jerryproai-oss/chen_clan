import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { withAdmin } from '@/lib/auth/middleware';
import { hashPassword } from '@/lib/auth/password';
import { logAudit } from '@/lib/audit';

// POST /api/admin/users/[id]/reset-password — 重設使用者密碼
export const POST = withAdmin(async (
  request: NextRequest,
  session,
) => {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.length - 2]; // .../[id]/reset-password

  try {
    const { newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: '新密碼至少需要 6 個字元' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json({ error: '使用者不存在' }, { status: 404 });
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    // 刪除該使用者所有 session（強制重新登入）
    await prisma.session.deleteMany({
      where: { userId: id },
    });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    await logAudit({
      action: 'PASSWORD_RESET_BY_ADMIN',
      userId: session.user.id,
      details: {
        targetUserId: id,
        targetUsername: user.username,
      },
      ip,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
