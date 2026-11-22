import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { withAdmin } from '@/lib/auth/middleware';
import { hashPassword } from '@/lib/auth/password';
import { logAudit } from '@/lib/audit';

// GET /api/admin/users — 取得使用者清單
export const GET = withAdmin(async (_request, session) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      assignments: {
        select: {
          id: true,
          city: true,
          district: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ users });
});

// POST /api/admin/users — 建立新使用者
export const POST = withAdmin(async (request: NextRequest, session) => {
  try {
    const body = await request.json();
    const { username, password, displayName, role, assignments } = body;

    // 驗證必填欄位
    if (!username || !password || !displayName) {
      return NextResponse.json(
        { error: '帳號、密碼和顯示名稱為必填' },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 30) {
      return NextResponse.json(
        { error: '帳號長度須為 3-30 個字元' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '密碼至少需要 6 個字元' },
        { status: 400 }
      );
    }

    // 驗證角色
    const validRoles = ['ADMIN', 'CHAIRMAN', 'EDITOR', 'MANAGER', 'VOLUNTEER'];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: '無效的角色' },
        { status: 400 }
      );
    }

    // 檢查帳號是否已存在
    const existing = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: '此帳號已存在' },
        { status: 409 }
      );
    }

    // 建立使用者
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase().trim(),
        passwordHash,
        displayName: displayName.trim(),
        role: role || 'VOLUNTEER',
        mustChangePassword: true,
        assignments: assignments?.length > 0 ? {
          create: assignments.map((a: { city: string; district?: string }) => ({
            city: a.city,
            district: a.district || null,
          })),
        } : undefined,
      },
      include: {
        assignments: true,
      },
    });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    await logAudit({
      action: 'USER_CREATED',
      userId: session.user.id,
      details: {
        targetUserId: user.id,
        targetUsername: user.username,
        role: user.role,
      },
      ip,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        assignments: user.assignments,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
