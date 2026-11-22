import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { withAuth, hasGlobalView } from '@/lib/auth/middleware';

// 台灣縣市由北到南排序
const NORTH_TO_SOUTH_ORDER: Record<string, number> = {
  '基隆市': 1,
  '台北市': 2, '臺北市': 2,
  '新北市': 3,
  '桃園市': 4,
  '新竹市': 5,
  '新竹縣': 6,
  '苗栗縣': 7,
  '台中市': 8, '臺中市': 8,
  '彰化縣': 9,
  '南投縣': 10,
  '雲林縣': 11,
  '嘉義市': 12,
  '嘉義縣': 13,
  '台南市': 14, '臺南市': 14,
  '高雄市': 15,
  '屏東縣': 16,
  '宜蘭縣': 17,
  '花蓮縣': 18,
  '台東縣': 19, '臺東縣': 19,
  '澎湖縣': 20,
  '金門縣': 21,
  '連江縣': 22,
};

// GET /api/members/cities — 取得所有城市列表（含筆數，供篩選用）
export const GET = withAuth(async (_request, session) => {
  try {
    const { role, assignments } = session.user;

    if (hasGlobalView(role)) {
      // ADMIN / CHAIRMAN / EDITOR 可看全部城市
      const cityCounts = await prisma.member.groupBy({
        by: ['city'],
        _count: { city: true },
        orderBy: { _count: { city: 'desc' } },
      });

      const cities = cityCounts.map((c) => ({
        name: c.city,
        count: c._count.city,
        geoOrder: NORTH_TO_SOUTH_ORDER[c.city] ?? 99,
      }));

      return NextResponse.json({ cities });
    } else {
      // MANAGER / VOLUNTEER 只看分配到的城市
      const assignedCities = [...new Set(assignments.map((a) => a.city))];

      // 取得每個城市的筆數
      const cityCounts = await prisma.member.groupBy({
        by: ['city'],
        _count: { city: true },
        where: { city: { in: assignedCities } },
        orderBy: { _count: { city: 'desc' } },
      });

      const cities = cityCounts.map((c) => ({
        name: c.city,
        count: c._count.city,
        geoOrder: NORTH_TO_SOUTH_ORDER[c.city] ?? 99,
      }));

      return NextResponse.json({ cities });
    }
  } catch (error) {
    console.error('Cities GET error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
