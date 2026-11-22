import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { withEditor } from '@/lib/auth/middleware';
import { logAudit } from '@/lib/audit';

interface UpdateItem {
  id: string;
  version: number;
  [key: string]: unknown;
}

interface ResultItem {
  id: string;
  status: 'ok' | 'conflict';
  currentVersion?: number;
  data?: unknown;
}

// POST /api/members/batch — 批次更新宗親資料
export const POST = withEditor(async (request: NextRequest, session) => {
  try {
    const body = await request.json();
    const { updates } = body as { updates: UpdateItem[] };

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: '需要提供 updates 陣列' },
        { status: 400 }
      );
    }

    if (updates.length > 100) {
      return NextResponse.json(
        { error: '單次最多更新 100 筆' },
        { status: 400 }
      );
    }

    const results: ResultItem[] = [];

    for (const update of updates) {
      const { id, version, ...fields } = update;

      if (!id || version === undefined || version === null) {
        results.push({ id: id || 'unknown', status: 'conflict' });
        continue;
      }

      // 查詢目前記錄，檢查 version
      const existing = await prisma.member.findUnique({
        where: { id },
        select: { id: true, version: true },
      });

      if (!existing) {
        results.push({ id, status: 'conflict' });
        continue;
      }

      // Optimistic locking: version 不匹配就是衝突
      if (existing.version !== version) {
        results.push({
          id,
          status: 'conflict',
          currentVersion: existing.version,
        });
        continue;
      }

      // 建立要更新的資料（過濾掉不合法的欄位）
      const allowedFields = [
        'name', 'postalCode', 'city', 'district', 'village',
        'address', 'phone', 'note', 'serialNumber',
        'surveyStatus', 'surveyNote',
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key in fields) {
          if (key === 'serialNumber') {
            data[key] = fields[key] ? parseInt(String(fields[key]), 10) : null;
          } else if (typeof fields[key] === 'string') {
            data[key] = (fields[key] as string).trim() || null;
          } else {
            data[key] = fields[key];
          }
        }
      }

      // 如果有地址相關欄位改變，重組 fullAddress
      if (data.city !== undefined || data.district !== undefined || data.village !== undefined || data.address !== undefined || data.postalCode !== undefined) {
        const full = await prisma.member.findUnique({ where: { id } });
        if (full) {
          const updatedPostalCode = data.postalCode !== undefined ? data.postalCode : full.postalCode;
          const updatedCity = data.city !== undefined ? data.city : full.city;
          const updatedDistrict = data.district !== undefined ? data.district : full.district;
          const updatedVillage = data.village !== undefined ? data.village : full.village;
          const updatedAddress = data.address !== undefined ? data.address : full.address;
          data.fullAddress = [updatedPostalCode, updatedCity, updatedDistrict, updatedVillage, updatedAddress]
            .filter(Boolean)
            .join('');
        }
      }

      // 更新，version + 1
      const updated = await prisma.member.update({
        where: { id },
        data: {
          ...data,
          version: { increment: 1 },
        },
      });

      results.push({
        id,
        status: 'ok',
        data: updated,
      });

      await logAudit({
        action: 'MEMBER_BATCH_UPDATED',
        userId: session.user.id,
        details: { memberId: id, updatedFields: Object.keys(data) },
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Batch update error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
