import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken, validateSession } from './session';

type SessionUser = {
  user: {
    id: string;
    username: string;
    displayName: string;
    role: string;
    status: string;
    assignments: {
      id: string;
      userId: string;
      city: string;
      district: string | null;
    }[];
  };
};

type AuthHandler = (
  request: NextRequest,
  session: SessionUser
) => Promise<NextResponse>;

function validateOrigin(request: NextRequest): boolean {
  if (request.method === 'GET') return true;
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return true;
  const originHost = new URL(origin).host;
  return originHost === host;
}

export function withAuth(handler: AuthHandler) {
  return async (request: NextRequest) => {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: '非法來源' }, { status: 403 });
    }

    const token = getSessionToken(request);
    if (!token) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const session = await validateSession(token);
    if (!session || session.user.status !== 'ACTIVE') {
      return NextResponse.json({ error: '登入已過期' }, { status: 401 });
    }

    return handler(request, session);
  };
}

/** 僅限管理員 */
export function withAdmin(handler: AuthHandler) {
  return withAuth(async (request, session) => {
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }
    return handler(request, session);
  });
}

/** 管理員 或 總幹事 */
export function withManager(handler: AuthHandler) {
  return withAuth(async (request, session) => {
    if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }
    return handler(request, session);
  });
}

/**
 * 判斷是否有全局檢視權限（可看所有區域資料）
 * ADMIN、CHAIRMAN、EDITOR 都具有全局檢視權
 */
export function hasGlobalView(role: string): boolean {
  return role === 'ADMIN' || role === 'CHAIRMAN' || role === 'EDITOR';
}

/**
 * 判斷是否有行內編輯權限（批次更新等）
 * 僅 EDITOR
 */
export function hasInlineEditAccess(role: string): boolean {
  return role === 'EDITOR';
}

/**
 * 判斷是否有刪除權限
 * ADMIN 和 EDITOR
 */
export function hasDeleteAccess(role: string): boolean {
  return role === 'ADMIN' || role === 'EDITOR';
}

/**
 * 判斷是否有管理權限（使用者管理、系統設定）
 * 僅 ADMIN
 */
export function hasAdminAccess(role: string): boolean {
  return role === 'ADMIN';
}

/** 管理員 或 編輯員 */
export function withEditor(handler: AuthHandler) {
  return withAuth(async (request, session) => {
    if (session.user.role !== 'ADMIN' && session.user.role !== 'EDITOR') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }
    return handler(request, session);
  });
}

export function requireAuth(handler: AuthHandler) {
  return withAuth(handler);
}
