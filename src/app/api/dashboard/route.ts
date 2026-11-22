import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { withAuth, hasGlobalView } from '@/lib/auth/middleware';

// GET /api/dashboard — 儀表板統計數據（依角色）
export const GET = withAuth(async (_request: NextRequest, session) => {
  try {
    const { role, assignments } = session.user;

    // 建立區域篩選條件（ADMIN 和 CHAIRMAN 看全部）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let areaWhere: Record<string, any> = {};
    if (!hasGlobalView(role)) {
      if (assignments.length === 0) {
        return NextResponse.json({
          totalMembers: 0,
          byStatus: {},
          byCity: [],
          recentActivity: [],
          myProgress: role === 'VOLUNTEER' ? { total: 0, surveyed: 0 } : undefined,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const areaFilters: Record<string, any>[] = assignments.map((a) => {
        const filter: Record<string, any> = { city: a.city };
        if (a.district) {
          filter.district = a.district;
        }
        return filter;
      });
      areaWhere = { OR: areaFilters };
    }

    // 總人數
    const totalMembers = await prisma.member.count({ where: areaWhere });

    // 各狀態計數
    const statusCounts = await prisma.member.groupBy({
      by: ['surveyStatus'],
      where: areaWhere,
      _count: { _all: true },
    });

    const byStatus: Record<string, number> = {};
    for (const s of statusCounts) {
      byStatus[s.surveyStatus] = s._count._all;
    }

    // 依縣市統計
    const cityCounts = await prisma.member.groupBy({
      by: ['city'],
      where: areaWhere,
      _count: { _all: true },
    });

    // 已普查的（非 PENDING）依縣市統計
    const cityCompletedCounts = await prisma.member.groupBy({
      by: ['city'],
      where: {
        ...areaWhere,
        surveyStatus: { not: 'PENDING' },
      },
      _count: { _all: true },
    });

    const completedMap: Record<string, number> = {};
    for (const c of cityCompletedCounts) {
      completedMap[c.city] = c._count._all;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byCity = cityCounts.map((c: any) => ({
      city: c.city,
      total: c._count._all,
      surveyed: completedMap[c.city] || 0,
    }));

    // 最近普查活動（最近 10 筆）
    const recentActivity = await prisma.member.findMany({
      where: {
        ...areaWhere,
        surveyedAt: { not: null },
      },
      orderBy: { surveyedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        city: true,
        district: true,
        surveyStatus: true,
        surveyedAt: true,
        surveyedBy: {
          select: { id: true, displayName: true },
        },
      },
    });

    // 基本回傳
    const result: Record<string, unknown> = {
      totalMembers,
      byStatus,
      byCity,
      recentActivity,
    };

    // ADMIN / CHAIRMAN: 加入各區負責人
    if (hasGlobalView(role)) {
      const assignedUsers = await prisma.userAssignment.findMany({
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              role: true,
              status: true,
            },
          },
        },
        orderBy: [{ city: 'asc' }, { district: 'asc' }],
      });
      result.assignedUsers = assignedUsers;
    }

    // VOLUNTEER: 加入自己的普查進度
    if (role === 'VOLUNTEER') {
      const myTotal = await prisma.member.count({ where: areaWhere });
      const mySurveyed = await prisma.member.count({
        where: {
          ...areaWhere,
          surveyedById: session.user.id,
        },
      });
      result.myProgress = { total: myTotal, surveyed: mySurveyed };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Dashboard GET error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
