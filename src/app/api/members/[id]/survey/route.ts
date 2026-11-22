import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { withAuth, hasGlobalView } from '@/lib/auth/middleware';
import { logAudit } from '@/lib/audit';

// POST /api/members/[id]/survey — 更新普查狀態
export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    const url = new URL(request.url);
    // URL: /api/members/[id]/survey → extract [id]
    const segments = url.pathname.split('/');
    const surveyIdx = segments.indexOf('survey');
    const id = segments[surveyIdx - 1];

    const existing = await prisma.member.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: '找不到此宗親' }, { status: 404 });
    }

    // 檢查區域權限（ADMIN 和 CHAIRMAN 有全局權限）
    if (!hasGlobalView(session.user.role)) {
      const hasAccess = session.user.assignments.some((a) => {
        if (a.city !== existing.city) return false;
        if (a.district && a.district !== existing.district) return false;
        return true;
      });
      if (!hasAccess) {
        return NextResponse.json({ error: '無此區域權限' }, { status: 403 });
      }
    }

    const body = await request.json();
    const { surveyStatus, surveyNote } = body;

    if (!surveyStatus) {
      return NextResponse.json(
        { error: '請提供普查狀態' },
        { status: 400 }
      );
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'UPDATED', 'NOT_FOUND', 'WRONG_ADDRESS', 'MOVED', 'NEW'];
    if (!validStatuses.includes(surveyStatus)) {
      return NextResponse.json(
        { error: '無效的普查狀態' },
        { status: 400 }
      );
    }

    const member = await prisma.member.update({
      where: { id },
      data: {
        surveyStatus,
        surveyNote: surveyNote ?? null,
        surveyedById: session.user.id,
        surveyedAt: new Date(),
        version: { increment: 1 },
      },
      include: {
        surveyedBy: {
          select: { id: true, displayName: true },
        },
      },
    });

    await logAudit({
      action: 'SURVEY_UPDATED',
      userId: session.user.id,
      details: {
        memberId: member.id,
        name: member.name,
        surveyStatus,
        surveyNote: surveyNote || null,
      },
    });

    return NextResponse.json({ member });
  } catch (error) {
    console.error('Survey POST error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
