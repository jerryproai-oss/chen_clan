import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { withAdmin } from '@/lib/auth/middleware';
import { logAudit } from '@/lib/audit';

// GET /api/admin/users/[id] — 取得單一使用者
export const GET = withAdmin(async (
  _request: NextRequest,
  session,
) => {
  // Extract id from URL
  const url = new URL(_request.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.length - 1];

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      status: true,
      fontSize: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      assignments: {
        select: {
          id: true,
          city: true,
          district: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: '使用者不存在' }, { status: 404 });
  }

  return NextResponse.json({ user });
});

// PATCH /api/admin/users/[id] — 更新使用者
export const PATCH = withAdmin(async (
  request: NextRequest,
  session,
) => {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.length - 1];

  try {
    const body = await request.json();
    const { displayName, role, status, assignments } = body;

    // 檢查使用者是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: '使用者不存在' }, { status: 404 });
    }

    // 防止停用自己
    if (status === 'INACTIVE' && id === session.user.id) {
      return NextResponse.json(
        { error: '無法停用自己的帳號' },
        { status: 400 }
      );
    }

    // 更新使用者基本資料
    const updateData: Record<string, unknown> = {};
    if (displayName !== undefined) updateData.displayName = displayName.trim();
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // 更新區域分配
    if (assignments !== undefined) {
      // 先刪除所有現有分配
      await prisma.userAssignment.deleteMany({
        where: { userId: id },
      });

      // 建立新的分配
      if (assignments.length > 0) {
        await prisma.userAssignment.createMany({
          data: assignments.map((a: { city: string; district?: string }) => ({
            userId: id,
            city: a.city,
            district: a.district || null,
          })),
        });
      }
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    await logAudit({
      action: 'USER_UPDATED',
      userId: session.user.id,
      details: {
        targetUserId: id,
        changes: body,
      },
      ip,
    });

    // 重新取得完整資料
    const result = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        status: true,
        assignments: {
          select: {
            id: true,
            city: true,
            district: true,
          },
        },
      },
    });

    return NextResponse.json({ user: result });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});

// DELETE /api/admin/users/[id] — 刪除使用者
export const DELETE = withAdmin(async (
  request: NextRequest,
  session,
) => {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.length - 1];

  // 防止刪除自己
  if (id === session.user.id) {
    return NextResponse.json(
      { error: '無法刪除自己的帳號' },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return NextResponse.json({ error: '使用者不存在' }, { status: 404 });
  }

  await prisma.user.delete({ where: { id } });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  await logAudit({
    action: 'USER_DELETED',
    userId: session.user.id,
    details: {
      targetUserId: id,
      targetUsername: user.username,
    },
    ip,
  });

  return NextResponse.json({ success: true });
});
