import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { withAuth, hasGlobalView } from '@/lib/auth/middleware';

// GET /api/members/cities — 取得所有城市列表（供篩選用）
export const GET = withAuth(async (_request, session) => {
  try {
    const { role, assignments } = session.user;

    let cities: { city: string }[];

    if (hasGlobalView(role)) {
      // ADMIN / CHAIRMAN / EDITOR 可看全部城市
      cities = await prisma.member.findMany({
        select: { city: true },
        distinct: ['city'],
        orderBy: { city: 'asc' },
      });
    } else {
      // MANAGER / VOLUNTEER 只看分配到的城市
      const assignedCities = [...new Set(assignments.map((a) => a.city))];
      cities = assignedCities.sort().map((c) => ({ city: c }));
    }

    return NextResponse.json({ cities: cities.map((c) => c.city) });
  } catch (error) {
    console.error('Cities GET error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
