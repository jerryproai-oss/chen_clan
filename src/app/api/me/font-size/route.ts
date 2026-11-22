import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { withAuth } from '@/lib/auth/middleware';

const VALID_FONT_SIZES = ['16', '18', '20', '22', '24'];

// PATCH /api/me/font-size — 更新字體大小偏好
export const PATCH = withAuth(async (request: NextRequest, session) => {
  try {
    const body = await request.json();
    const { fontSize } = body;

    if (!fontSize || !VALID_FONT_SIZES.includes(fontSize)) {
      return NextResponse.json(
        { error: `字體大小須為以下其中之一：${VALID_FONT_SIZES.join('、')}` },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { fontSize },
    });

    return NextResponse.json({ fontSize });
  } catch (error) {
    console.error('Font size PATCH error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
