import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { withAdmin } from '@/lib/auth/middleware';
import { hashPassword } from '@/lib/auth/password';
import { logAudit } from '@/lib/audit';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// POST /api/admin/users/[id]/reset-password — 重設使用者密碼
export const POST = withAdmin(async (
  request: NextRequest,
  session,
) => {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.length - 2]; // .../[id]/reset-password

  try {
    // 允許管理員自訂密碼，或自動產生
    let newPassword: string;
    try {
      const body = await request.json();
      newPassword = body.newPassword && body.newPassword.length >= 6
        ? body.newPassword
        : generateTempPassword();
    } catch {
      // 沒有 body 或解析失敗 → 自動產生
      newPassword = generateTempPassword();
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

    return NextResponse.json({ success: true, temporaryPassword: newPassword });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
