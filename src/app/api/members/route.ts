import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { withAuth, hasGlobalView } from '@/lib/auth/middleware';
import { logAudit } from '@/lib/audit';

// GET /api/members — 列表查詢（依角色篩選區域）
export const GET = withAuth(async (request: NextRequest, session) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const city = searchParams.get('city') || '';
    const district = searchParams.get('district') || '';
    const status = searchParams.get('status') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    // 搜尋條件
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (city) {
      where.city = city;
    }

    if (district) {
      where.district = district;
    }

    if (status) {
      where.surveyStatus = status;
    }

    // 依角色篩選區域（ADMIN 和 CHAIRMAN 可看全部）
    const { role, assignments } = session.user;
    if (!hasGlobalView(role)) {
      // MANAGER / VOLUNTEER 只能看自己被分配的區域
      if (assignments.length === 0) {
        return NextResponse.json({ members: [], total: 0, page, totalPages: 0 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const areaFilters: Record<string, any>[] = assignments.map((a) => {
        const filter: Record<string, any> = { city: a.city };
        if (a.district) {
          filter.district = a.district;
        }
        return filter;
      });

      where.AND = [{ OR: areaFilters }];
    }

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ city: 'asc' }, { district: 'asc' }, { serialNumber: 'asc' }],
        include: {
          surveyedBy: {
            select: { id: true, displayName: true },
          },
        },
      }),
      prisma.member.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ members, total, page, totalPages });
  } catch (error) {
    console.error('Members GET error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});

// POST /api/members — 新增宗親
export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    const body = await request.json();
    const { name, city, district, village, address, postalCode, phone, note, serialNumber } = body;

    // 必填驗證
    if (!name || !city || !address) {
      return NextResponse.json(
        { error: '姓名、縣市、地址為必填欄位' },
        { status: 400 }
      );
    }

    // 組合完整地址
    const fullAddress = [postalCode, city, district, village, address]
      .filter(Boolean)
      .join('');

    const member = await prisma.member.create({
      data: {
        name: name.trim(),
        city: city.trim(),
        district: district?.trim() || null,
        village: village?.trim() || null,
        address: address.trim(),
        fullAddress,
        postalCode: postalCode?.trim() || null,
        phone: phone?.trim() || null,
        note: note?.trim() || null,
        serialNumber: serialNumber ? parseInt(serialNumber, 10) : null,
      },
    });

    await logAudit({
      action: 'MEMBER_CREATED',
      userId: session.user.id,
      details: { memberId: member.id, name: member.name },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error('Members POST error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
