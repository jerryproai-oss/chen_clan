import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { withAuth, hasGlobalView, hasDeleteAccess } from '@/lib/auth/middleware';
import { logAudit } from '@/lib/audit';

type RouteContext = { params: Promise<{ id: string }> };

// 檢查使用者是否有該成員所在區域的權限
function hasAreaAccess(
  session: { user: { role: string; assignments: { city: string; district: string | null }[] } },
  member: { city: string; district: string | null }
): boolean {
  if (hasGlobalView(session.user.role)) return true;

  return session.user.assignments.some((a) => {
    if (a.city !== member.city) return false;
    if (a.district && a.district !== member.district) return false;
    return true;
  });
}

// GET /api/members/[id] — 取得單筆宗親
export const GET = withAuth(async (request: NextRequest, session) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop()!;

    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        surveyedBy: {
          select: { id: true, displayName: true },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: '找不到此宗親' }, { status: 404 });
    }

    if (!hasAreaAccess(session, member)) {
      return NextResponse.json({ error: '無此區域權限' }, { status: 403 });
    }

    return NextResponse.json({ member });
  } catch (error) {
    console.error('Member GET error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});

// PATCH /api/members/[id] — 更新宗親資料
export const PATCH = withAuth(async (request: NextRequest, session) => {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop()!;

    const existing = await prisma.member.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: '找不到此宗親' }, { status: 404 });
    }

    if (!hasAreaAccess(session, existing)) {
      return NextResponse.json({ error: '無此區域權限' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name, city, district, village, address,
      postalCode, phone, note, serialNumber,
    } = body;

    // 重新組合完整地址
    const updatedCity = city ?? existing.city;
    const updatedDistrict = district !== undefined ? district : existing.district;
    const updatedVillage = village !== undefined ? village : existing.village;
    const updatedAddress = address ?? existing.address;
    const updatedPostalCode = postalCode !== undefined ? postalCode : existing.postalCode;

    const fullAddress = [updatedPostalCode, updatedCity, updatedDistrict, updatedVillage, updatedAddress]
      .filter(Boolean)
      .join('');

    const member = await prisma.member.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(city !== undefined && { city: city.trim() }),
        ...(district !== undefined && { district: district?.trim() || null }),
        ...(village !== undefined && { village: village?.trim() || null }),
        ...(address !== undefined && { address: address.trim() }),
        ...(postalCode !== undefined && { postalCode: postalCode?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(note !== undefined && { note: note?.trim() || null }),
        ...(serialNumber !== undefined && { serialNumber: serialNumber ? parseInt(serialNumber, 10) : null }),
        fullAddress,
        version: { increment: 1 },
      },
      include: {
        surveyedBy: {
          select: { id: true, displayName: true },
        },
      },
    });

    await logAudit({
      action: 'MEMBER_UPDATED',
      userId: session.user.id,
      details: { memberId: member.id, name: member.name },
    });

    return NextResponse.json({ member });
  } catch (error) {
    console.error('Member PATCH error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});


// DELETE /api/members/[id] — 刪除宗親
export const DELETE = withAuth(async (request: NextRequest, session) => {
  try {
    if (!hasDeleteAccess(session.user.role)) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.pathname.split('/').pop()!;

    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) {
      return NextResponse.json({ error: '找不到此宗親' }, { status: 404 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    await logAudit({
      action: 'MEMBER_DELETED',
      userId: session.user.id,
      details: {
        memberId: member.id,
        name: member.name,
        city: member.city,
        district: member.district,
      },
      ip,
    });

    await prisma.member.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Member DELETE error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
