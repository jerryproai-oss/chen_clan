import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { withAuth } from '@/lib/auth/middleware';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { logAudit } from '@/lib/audit';

export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: '請輸入目前密碼和新密碼' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: '新密碼至少需要 6 個字元' },
        { status: 400 }
      );
    }

    if (newPassword.length > 128) {
      return NextResponse.json(
        { error: '密碼長度超出限制' },
        { status: 400 }
      );
    }

    // 取得使用者完整資料
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: '使用者不存在' }, { status: 404 });
    }

    // 驗證目前密碼
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      await logAudit({
        action: 'PASSWORD_CHANGE_FAILED',
        userId: user.id,
        details: { reason: 'wrong_current_password' },
      });
      return NextResponse.json({ error: '目前密碼錯誤' }, { status: 401 });
    }

    // 更新密碼
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    await logAudit({
      action: 'PASSWORD_CHANGED',
      userId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
